"""
API of the visits: a visit to an apiary with one inspection per colony looked
at, its participants and its photos. Access rules: `permissions.py`.

What a visit says of a colony also updates it: the count of bars (or boxes)
after the latest visit is the colony's, and eggs seen in a colony raising a
queen mean the new queen lays (the end of the brood break).
"""

import re
import uuid

from django.db import transaction
from django.db.models import Prefetch
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from audit import recorder as audit
from hornet.group_views import _full_name
from hornet.images import delete_files, store_photo
from hornet.invitation_views import _sort_key
from hornet.models import ApiaryGroupPermission, User
from hornet.trap_permissions import local_user
from hornet.trap_views import _group_choices
from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication

from . import colony_rules as rules
from . import permissions as perms
from .models import Inspection, Visit, VisitPhoto
from .serializers import InspectionSerializer, VisitSerializer
from .views import HiveViewSet, _apiary_label

MAX_PHOTOS_PER_REQUEST = 10
VISIT_FILE_RE = re.compile(r'^visits/(?P<visit_id>[0-9a-f-]{36})/[^/]+$')


def can_read_visit_file(request, path) -> bool:
    """The media view's check for `visits/<visit id>/…` (see `apps.py`)."""
    match = VISIT_FILE_RE.match(path)
    if not match:
        return False
    visit = Visit.objects.filter(pk=match.group('visit_id')).select_related('apiary').first()
    return visit is not None and perms.can_read_visit(request, visit)


def _visit_refs(visit, inspections) -> list:
    refs = [audit.ref('apiary', visit.apiary_id)] if visit.apiary_id else []
    for inspection in inspections:
        if inspection.hive_id:
            refs.append(audit.ref('hive', inspection.hive_id))
        if inspection.colony_id:
            refs.append(audit.ref('colony', inspection.colony_id))
    refs += [audit.ref('user', user.pk) for user in visit.participants.all()]
    return list(dict.fromkeys(refs))


def _inspection_summary(inspection) -> dict:
    return {'hive': audit.json_value(inspection.hive_id), 'colony': audit.json_value(inspection.colony_id),
            'bars': inspection.bars, 'eggs_seen': inspection.eggs_seen, 'feeding': inspection.feeding}


class VisitPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = 'page_size'
    max_page_size = 100


class VisitViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin,
                   mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Visits to the apiaries, newest first."""

    serializer_class = VisitSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    pagination_class = VisitPagination

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        return [HasAnyRole(['beekeeper', 'admin'])]

    def get_queryset(self):
        return Visit.objects.select_related('apiary', 'created_by').prefetch_related(
            'participants', 'photos',
            Prefetch('apiary__apiarygrouppermission_set',
                     queryset=ApiaryGroupPermission.objects.select_related('group')),
            Prefetch('inspections', queryset=Inspection.objects.select_related(
                'hive', 'hive__hive_type', 'hive__owner_group', 'hive__apiary', 'colony')),
        )

    def get_object(self):
        try:
            pk = uuid.UUID(str(self.kwargs['pk']))
        except ValueError:
            raise NotFound()
        visit = self.get_queryset().filter(pk=pk).first()
        # 404 rather than 403: the existence of a visit is private
        if visit is None or not perms.can_read_visit(self.request, visit):
            raise NotFound()
        return visit

    def _fresh(self, visit, status_code=status.HTTP_200_OK):
        return Response(self.get_serializer(self.get_queryset().get(pk=visit.pk)).data, status=status_code)

    # -- reading -------------------------------------------------------------

    @extend_schema(parameters=[
        OpenApiParameter(name='apiary', type=OpenApiTypes.INT, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='hive', type=OpenApiTypes.UUID, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='colony', type=OpenApiTypes.UUID, location=OpenApiParameter.QUERY, required=False),
    ])
    def list(self, request, *args, **kwargs):
        """The visits the requester may see, newest first, paginated."""
        params = request.query_params
        ids = Visit.objects.filter(perms.readable_visits_q(request))
        try:
            if params.get('apiary'):
                ids = ids.filter(apiary_id=int(params['apiary']))
            if params.get('hive'):
                ids = ids.filter(inspections__hive_id=uuid.UUID(params['hive']))
            if params.get('colony'):
                ids = ids.filter(inspections__colony_id=uuid.UUID(params['colony']))
        except ValueError:
            raise ValidationError({'detail': "Invalid filter."})
        queryset = self.get_queryset().filter(pk__in=ids.values('pk')).order_by('-started_at')
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return self._fresh(self.get_object())

    # -- writing -------------------------------------------------------------

    def _participants(self, guids):
        """The accounts named as participants: oneself, or members of one's associations."""
        if guids is None:
            return None
        if not isinstance(guids, list):
            raise ValidationError({'participants': "Expected a list of identifiers."})
        allowed = perms.owner_group_choices(self.request)
        me = str(getattr(self.request.user, 'guid', ''))
        users = []
        for raw in guids:
            try:
                guid = str(uuid.UUID(str(raw)))
            except ValueError:
                raise ValidationError({'participants': "Expected a list of identifiers."})
            user = User.objects.filter(guid=guid).first()
            if guid != me and allowed is not None and not self._shares_group(user, guid, allowed):
                raise ValidationError({'participants': "Only members of your associations take part."})
            users.append(user or User.objects.create(guid=guid))
        return users

    @staticmethod
    def _shares_group(user, guid, allowed) -> bool:
        """A member of one of `allowed`: by the mirror of their groups, else by the Keycloak rosters."""
        paths = (user.group_paths or []) if user else []
        if any(path == group or path.startswith(group + '/') for path in paths for group in allowed):
            return True
        # Someone who never signed in here: only Keycloak knows their groups
        return any(guid in HiveViewSet._roster(group, allowed) for group in allowed)

    def _inspections(self, visit, items):
        """Validate the inspections sent: each of a hive standing in the visited apiary."""
        if items is None:
            return None
        if not isinstance(items, list):
            raise ValidationError({'inspections': "Expected a list."})
        known = {inspection.pk: inspection for inspection in visit.inspections.all()} if visit.pk else {}
        validated, colonies = [], set()
        for item in items:
            existing = known.get(item.get('id')) if isinstance(item, dict) else None
            serializer = InspectionSerializer(existing, data=item)
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data
            hive, colony = data['hive'], data.get('colony')
            if existing is None or existing.hive_id != hive.pk:
                if hive.apiary_id != visit.apiary_id:
                    raise ValidationError({'inspections': f"The hive {hive} does not stand in this apiary."})
            if colony is not None:
                if colony.pk in colonies:
                    raise ValidationError({'inspections': "A colony is inspected once per visit."})
                colonies.add(colony.pk)
            validated.append((existing, data))
        return validated

    def _apply(self, request, visit, validated):
        """Write the inspections, and what they tell of the colonies."""
        kept = []
        for existing, data in validated:
            inspection = existing or Inspection(visit=visit)
            for name, value in data.items():
                if name != 'id':
                    setattr(inspection, name, value)
            inspection.hive_label = str(inspection.hive)[:160]
            inspection.colony_label = str(inspection.colony)[:160] if inspection.colony_id else ''
            inspection.compartment = inspection.colony.compartment if inspection.colony_id else 1
            inspection.save()
            kept.append(inspection.pk)
            if inspection.colony_id:
                self._update_colony(request, visit, inspection)
        visit.inspections.exclude(pk__in=kept).delete()

    @staticmethod
    def _latest_for(colony, visit) -> bool:
        """No later visit of the colony: this one says what it is now."""
        return not Inspection.objects.filter(colony=colony, visit__started_at__gt=visit.started_at).exists()

    def _update_colony(self, request, visit, inspection):
        colony = inspection.colony
        if colony.ended_on is not None or not self._latest_for(colony, visit):
            return
        day = visit.started_at.date()
        if inspection.bars is not None and inspection.bars != colony.bars and colony.hive_id == inspection.hive_id:
            with audit.track(request, 'colony.updated', colony, fields=['bars']) as tracked:
                rules.check_place(colony.hive, colony.compartment, inspection.bars, exclude=[colony])
                colony.bars = inspection.bars
                colony.save(update_fields=['bars', 'updated_at'])
                tracked.refs = [audit.ref('apiary_visit', visit.pk), audit.ref('hive', colony.hive_id)]
        if (inspection.eggs_seen and colony.requeening_since and not colony.laying_since
                and day >= colony.requeening_since):
            with audit.track(request, 'colony.laying', colony, fields=['laying_since']) as tracked:
                colony.laying_since = day
                colony.save(update_fields=['laying_since', 'updated_at'])
                tracked.refs = [audit.ref('apiary_visit', visit.pk), audit.ref('hive', colony.hive_id)]

    @extend_schema(
        request={'application/json': {'type': 'object', 'properties': {
            'id': {'type': 'string', 'format': 'uuid'}, 'apiary': {'type': 'integer'},
            'started_at': {'type': 'string', 'format': 'date-time'}, 'duration_minutes': {'type': 'integer'},
            'title': {'type': 'string'}, 'kinds': {'type': 'array', 'items': {'type': 'string'}},
            'report': {'type': 'string'}, 'guest_names': {'type': 'string'},
            'participants': {'type': 'array', 'items': {'type': 'string', 'format': 'uuid'}},
            'inspections': {'type': 'array', 'items': {'type': 'object'}},
        }, 'required': ['apiary', 'started_at']}},
        responses={201: VisitSerializer, 200: VisitSerializer},
    )
    def create(self, request, *args, **kwargs):
        """A visit that took place. Sent again with the same `id`, it is not created twice."""
        client_id = request.data.get('id')
        if client_id:
            existing = self.get_queryset().filter(pk=client_id).first() if HiveViewSet._is_uuid(client_id) else None
            if existing is not None:
                if not perms.can_read_visit(request, existing):
                    raise ValidationError({'id': "This identifier is already used."})
                return self._fresh(existing)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        apiary = serializer.validated_data.get('apiary')
        if apiary is None:
            raise ValidationError({'apiary': "This field is required."})
        if not perms.can_record_visit(request, apiary):
            raise PermissionDenied("You cannot record a visit to this apiary.")
        participants = self._participants(request.data.get('participants', []))
        with transaction.atomic():
            visit = serializer.save(created_by=local_user(request), apiary_label=_apiary_label(apiary))
            visit.participants.set(participants)
            self._apply(request, visit, self._inspections(visit, request.data.get('inspections', [])))
            inspections = list(visit.inspections.all())
            audit.record(request, 'apiary_visit.created', visit, changes={
                **audit.snapshot(visit), 'participants': [str(user.pk) for user in participants],
                'inspections': [_inspection_summary(i) for i in inspections],
            }, refs=_visit_refs(visit, inspections))
        return self._fresh(visit, status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        visit = self.get_object()
        if not perms.can_edit_visit(request, visit):
            raise PermissionDenied("You cannot edit this visit.")
        serializer = self.get_serializer(visit, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        participants = self._participants(request.data.get('participants'))
        validated = self._inspections(visit, request.data.get('inspections'))
        before = [_inspection_summary(i) for i in visit.inspections.all()]
        with audit.track(request, 'apiary_visit.updated', visit) as tracked:
            serializer.save()
            if participants is not None:
                tracked.extra['participants'] = [[str(u.pk) for u in visit.participants.all()],
                                                 [str(u.pk) for u in participants]]
                visit.participants.set(participants)
            if validated is not None:
                self._apply(request, visit, validated)
                after = [_inspection_summary(i) for i in visit.inspections.all()]
                if after != before:
                    tracked.extra['inspections'] = [before, after]
            tracked.refs = _visit_refs(visit, visit.inspections.all())
        return self._fresh(visit)

    def destroy(self, request, *args, **kwargs):
        visit = self.get_object()
        if not perms.can_edit_visit(request, visit):
            raise PermissionDenied("You cannot delete this visit.")
        files = [(photo.image, photo.thumbnail) for photo in visit.photos.all()]
        with transaction.atomic():
            inspections = list(visit.inspections.all())
            changes = {**audit.snapshot(visit), 'inspections': [_inspection_summary(i) for i in inspections],
                       'photos': len(files)}
            refs, label, pk = _visit_refs(visit, inspections), audit.label_of(visit), visit.pk
            visit.delete()
            audit.record(request, 'apiary_visit.deleted', ('apiary_visit', pk), changes=changes, label=label,
                         refs=refs)
        for image, thumbnail in files:
            delete_files(image, thumbnail)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # -- photos --------------------------------------------------------------

    @extend_schema(
        request={'multipart/form-data': {'type': 'object', 'properties': {
            'photos': {'type': 'array', 'items': {'type': 'string', 'format': 'binary'}},
            'inspection': {'type': 'integer', 'description': 'The colony the photos show'}}}},
        responses={200: VisitSerializer},
    )
    @action(detail=True, methods=['post'])
    def photos(self, request, pk=None):
        """Add one or more photos (`photos` files) to a visit."""
        visit = self.get_object()
        if not perms.can_edit_visit(request, visit):
            raise PermissionDenied("You cannot change the photos of this visit.")
        uploaded = request.FILES.getlist('photos')
        if not uploaded:
            raise ValidationError({'photos': "No file received."})
        if len(uploaded) > MAX_PHOTOS_PER_REQUEST:
            raise ValidationError({'photos': f"At most {MAX_PHOTOS_PER_REQUEST} photos at a time."})
        inspection = None
        if request.data.get('inspection'):
            inspection = visit.inspections.filter(pk=request.data.get('inspection')).first()
            if inspection is None:
                raise ValidationError({'inspection': "Unknown inspection."})
        user, stored = local_user(request), []
        try:
            with transaction.atomic():
                for upload in uploaded:
                    photo = VisitPhoto(visit=visit, inspection=inspection, uploaded_by=user)
                    store_photo(photo, 'image', 'thumbnail', upload)
                    stored.append(photo)
                    photo.save()
                audit.record(request, 'apiary_visit.photo_added', visit, changes={'count': len(stored)},
                             refs=_visit_refs(visit, visit.inspections.all()))
        except Exception:
            for photo in stored:
                delete_files(photo.image, photo.thumbnail)
            raise
        return self._fresh(visit)

    @extend_schema(request=None, responses={200: VisitSerializer})
    @action(detail=True, methods=['delete'], url_path=r'photos/(?P<photo_id>\d+)')
    def delete_photo(self, request, pk=None, photo_id=None):
        """Remove one photo of a visit."""
        visit = self.get_object()
        if not perms.can_edit_visit(request, visit):
            raise PermissionDenied("You cannot change the photos of this visit.")
        photo = visit.photos.filter(pk=photo_id).first()
        if photo is None:
            raise NotFound()
        with transaction.atomic():
            audit.record(request, 'apiary_visit.photo_removed', visit, changes={
                'photo': photo.pk, 'uploaded_by': audit.json_value(photo.uploaded_by_id)})
            photo.delete()
        delete_files(photo.image, photo.thumbnail)
        return self._fresh(visit)

    # -- participants --------------------------------------------------------

    @extend_schema(
        parameters=[OpenApiParameter(name='group_path', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY,
                                     required=False, description='The association whose members are listed')],
        responses={200: OpenApiResponse(description='{groups: [{path, name}], members?: [{guid, name}]}')},
    )
    @action(detail=False, methods=['get'])
    def participants(self, request):
        """
        Who may be named as a participant: the members of one's associations
        (first and last name, never an email). Without `group_path`, the
        associations only.
        """
        allowed = perms.owner_group_choices(request)
        data = {'groups': _group_choices(allowed)}
        group_path = request.query_params.get('group_path', '').strip()
        if group_path:
            roster = HiveViewSet._roster(group_path, allowed)
            data['members'] = sorted(
                ({'guid': guid, 'name': _full_name(user)} for guid, user in roster.users.items()),
                key=lambda member: _sort_key(member['name'] or '~'),
            )
        return Response(data)
