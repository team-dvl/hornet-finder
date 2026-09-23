"""API of the traps module: referentials, traps, journal and photos."""

import logging
import uuid

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models as db_models, transaction
from django.db.models import Prefetch, ProtectedError
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from drf_spectacular.types import OpenApiTypes

from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication

from . import trap_permissions as perms
from .images import processed_image
from .models import BeekeeperGroup, Species, Tag, Trap, TrapEvent, TrapPhoto, TrapType, User
from .serializers import (
    CatchSerializer, PublicTrapSerializer, SpeciesSerializer, TrapDetailSerializer, TrapEventSerializer,
    TrapPhotoSerializer, TrapSerializer, TrapTypeSerializer,
)
from .views import GeographicFilterMixin, geographic_list_schema

logger = logging.getLogger(__name__)


def _group_label(path: str) -> str:
    """Human-readable name derived from a Keycloak group path."""
    return path.strip('/').replace('/', ' / ')


def _group_for_path(path: str) -> BeekeeperGroup:
    """Local row mirroring a Keycloak group, created on first use."""
    group, _ = BeekeeperGroup.objects.get_or_create(
        path=path, defaults={'name': _group_label(path)},
    )
    return group


def _store_photo(target, file_field, thumb_field, uploaded):
    """Resize an upload and store it in the given image fields of `target`."""
    try:
        basename, full, thumbnail = processed_image(uploaded)
    except DjangoValidationError as exc:
        # A rejected upload is a bad request, not a server error
        raise DRFValidationError({'photo': exc.messages}) from exc
    getattr(target, file_field).save(f"{basename}.jpg", full, save=False)
    getattr(target, thumb_field).save(f"{basename}_thumb.jpg", thumbnail, save=False)


def _delete_files(*image_fields):
    """Remove the files backing image fields, ignoring already-missing ones."""
    for field in image_fields:
        if field:
            field.delete(save=False)


class ReferentialViewSet(viewsets.ModelViewSet):
    """
    Read-only for authenticated users, writable by platform admins.

    Referential entries carry an optional illustration (`photo` plus
    `photo_thumbnail`), replaced by sending a `photo` file with the form.
    """

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        if getattr(self, 'action', None) in ('list', 'retrieve'):
            return [HasAnyRole(['volunteer', 'beekeeper', 'admin'])]
        return [HasAnyRole(['admin'])]

    def perform_create(self, serializer):
        self._attach_photo(serializer.save())

    def perform_update(self, serializer):
        self._attach_photo(serializer.save())

    def _attach_photo(self, instance):
        uploaded = self.request.FILES.get('photo')
        if not uploaded:
            return
        _delete_files(instance.photo, instance.photo_thumbnail)
        _store_photo(instance, 'photo', 'photo_thumbnail', uploaded)
        instance.save(update_fields=['photo', 'photo_thumbnail'])


class TrapTypeViewSet(ReferentialViewSet):
    serializer_class = TrapTypeSerializer
    queryset = TrapType.objects.all()

    def get_queryset(self):
        return TrapType.objects.annotate(trap_count=db_models.Count('traps'))

    @extend_schema(responses={204: OpenApiResponse(description='Deleted'),
                              409: OpenApiResponse(description='Trap type still in use')})
    def destroy(self, request, *args, **kwargs):
        trap_type = self.get_object()
        try:
            _delete_files(trap_type.photo, trap_type.photo_thumbnail)
            trap_type.delete()
        except ProtectedError:
            count = Trap.objects.filter(trap_type=trap_type).count()
            return Response(
                {'error': f"This trap type is used by {count} trap(s) and cannot be deleted.",
                 'trap_count': count},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class SpeciesViewSet(ReferentialViewSet):
    serializer_class = SpeciesSerializer
    queryset = Species.objects.all()

    def get_queryset(self):
        return Species.objects.annotate(event_count=db_models.Count('trap_events'))

    def _attach_photo(self, instance):
        # A replaced picture must not keep the credit of the Wikipedia one
        if self.request.FILES.get('photo') and 'photo_credit' not in self.request.data:
            instance.photo_credit = ''
            instance.photo_source_url = ''
            instance.save(update_fields=['photo_credit', 'photo_source_url'])
        super()._attach_photo(instance)

    @extend_schema(responses={204: OpenApiResponse(description='Deleted'),
                              409: OpenApiResponse(description='Species still in use')})
    def destroy(self, request, *args, **kwargs):
        species = self.get_object()
        try:
            with transaction.atomic():
                species.delete()
            _delete_files(species.photo, species.photo_thumbnail)
        except ProtectedError:
            count = TrapEvent.objects.filter(species=species).count()
            return Response(
                {'error': f"This species is used by {count} event(s) and cannot be deleted.",
                 'event_count': count},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class TrapViewSet(GeographicFilterMixin, viewsets.ModelViewSet):
    """
    Traps, their journal and their delegation.

    Reading a public trap needs no authentication; everything else does. The
    rules themselves live in `trap_permissions.py`.
    """

    queryset = Trap.objects.select_related('trap_type', 'owner', 'group').prefetch_related(
        Prefetch('tags', queryset=Tag.objects.filter(revoked_at__isnull=True),
                 to_attr='active_tags'),
    )
    serializer_class = TrapSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    # -- authentication & permissions ---------------------------------------

    def get_authenticators(self):
        # `list` and `retrieve` stay open to anonymous visitors (public traps)
        return super().get_authenticators()

    def get_permissions(self):
        action_name = getattr(self, 'action', None)
        if action_name in ('list', 'retrieve'):
            return []
        if action_name in ('create', 'my'):
            return [HasAnyRole(['volunteer', 'beekeeper'])]
        return [HasAnyRole(['volunteer', 'beekeeper', 'admin'])]

    # -- querysets -----------------------------------------------------------

    def _readable_queryset(self, request):
        """Traps the requester may see: public ones, their own, their groups'."""
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return self.queryset.filter(visibility=Trap.VISIBILITY_PUBLIC)
        if perms.is_platform_admin(user):
            return self.queryset
        membership = perms.membership_paths(request)
        readable = db_models.Q(visibility=Trap.VISIBILITY_PUBLIC)
        readable |= db_models.Q(owner__guid=getattr(user, 'guid', None))
        for path in membership:
            # A membership of `/beekeepers/ena/admin` also grants the parent
            readable |= db_models.Q(group__path=path)
            for parent in _ancestors(path):
                readable |= db_models.Q(group__path=parent)
        return self.queryset.filter(readable).distinct()

    @geographic_list_schema()
    @extend_schema(parameters=[
        OpenApiParameter(name='active', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY,
                         required=False, description="'true', 'false' or 'all' (default)"),
        OpenApiParameter(name='mine', type=OpenApiTypes.BOOL, location=OpenApiParameter.QUERY,
                         required=False),
    ])
    def list(self, request, *args, **kwargs):
        queryset, error_response = self.get_geographic_queryset(request)
        if error_response:
            return error_response
        queryset = queryset.filter(pk__in=self._readable_queryset(request).values('pk'))

        active = request.query_params.get('active', 'all')
        if active == 'true':
            queryset = queryset.filter(active=True)
        elif active == 'false':
            queryset = queryset.filter(active=False)

        if request.query_params.get('mine') in ('true', '1'):
            queryset = queryset.filter(owner__guid=getattr(request.user, 'guid', None))

        serializer_class = self._serializer_for(request)
        serializer = serializer_class(queryset, many=True)
        return Response(serializer.data)

    def _serializer_for(self, request, detail=False):
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return PublicTrapSerializer
        return TrapDetailSerializer if detail else TrapSerializer

    @extend_schema(responses={200: TrapSerializer(many=True)})
    @action(detail=False, methods=['get'])
    def my(self, request):
        queryset = self.queryset.filter(owner__guid=getattr(request.user, 'guid', None))
        return Response(TrapSerializer(queryset, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        trap = self.get_object()
        if not perms.can_read_trap(request, trap):
            raise PermissionDenied("You do not have permission to view this trap.")
        serializer_class = self._serializer_for(request, detail=True)
        return Response(serializer_class(trap).data)

    # -- write operations ----------------------------------------------------

    def perform_create(self, serializer):
        owner = perms.local_user(self.request)
        trap = serializer.save(owner=owner)

        uploaded = self.request.FILES.get('photo')
        if uploaded:
            _store_photo(trap, 'photo', 'photo_thumbnail', uploaded)
            trap.save(update_fields=['photo', 'photo_thumbnail'])

        # Putting a trap in place is itself an intervention: open the journal
        event = TrapEvent.objects.create(
            trap=trap,
            kind=TrapEvent.KIND_INSTALLATION,
            performed_at=timezone.make_aware(
                timezone.datetime.combine(trap.installed_at, timezone.datetime.min.time())
            ),
            performed_by=owner,
        )
        # The installation is what puts the trap in service, here as anywhere else
        trap.apply_event_side_effects(event)
        self._created_trap = trap

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        # Re-serialise so the response carries the photo URLs and the journal
        response.data = TrapDetailSerializer(self._created_trap).data
        return response

    def update(self, request, *args, **kwargs):
        if not perms.can_edit_trap(request, self.get_object()):
            raise PermissionDenied("You do not have permission to modify this trap.")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not perms.can_edit_trap(request, self.get_object()):
            raise PermissionDenied("You do not have permission to modify this trap.")
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        trap = self.get_object()
        if not perms.can_edit_trap(request, trap):
            raise PermissionDenied("You do not have permission to delete this trap.")
        for photo in trap.photos.all():
            _delete_files(photo.image, photo.thumbnail)
        _delete_files(trap.photo, trap.photo_thumbnail)
        return super().destroy(request, *args, **kwargs)

    @extend_schema(
        request={'multipart/form-data': {'type': 'object',
                                         'properties': {'photo': {'type': 'string',
                                                                  'format': 'binary'}}}},
        responses={200: TrapSerializer},
    )
    @action(detail=True, methods=['post', 'delete'], url_path='photo')
    def photo(self, request, pk=None):
        trap = self.get_object()
        if not perms.can_edit_trap(request, trap):
            raise PermissionDenied("You do not have permission to modify this trap.")

        _delete_files(trap.photo, trap.photo_thumbnail)
        if request.method == 'DELETE':
            trap.photo = None
            trap.photo_thumbnail = None
        else:
            uploaded = request.FILES.get('photo')
            if not uploaded:
                raise DRFValidationError({'photo': "No file received."})
            _store_photo(trap, 'photo', 'photo_thumbnail', uploaded)
        trap.save(update_fields=['photo', 'photo_thumbnail'])
        return Response(TrapSerializer(trap).data)

    # -- journal -------------------------------------------------------------

    @extend_schema(responses={200: TrapEventSerializer(many=True)})
    @action(detail=True, methods=['get', 'post'], url_path='events')
    def events(self, request, pk=None):
        trap = self.get_object()

        if request.method == 'GET':
            if not perms.can_read_trap(request, trap):
                raise PermissionDenied("You do not have permission to view this trap.")
            if not getattr(request.user, 'is_authenticated', False):
                raise PermissionDenied("The journal of a trap is reserved to registered users.")
            return Response(TrapEventSerializer(trap.events.all(), many=True).data)

        if not perms.can_act_on_trap(request, trap):
            raise PermissionDenied(
                "Only the owner and the members of the group in charge can record an event."
            )
        serializer = TrapEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = serializer.save(trap=trap, performed_by=perms.local_user(request))

        for uploaded in request.FILES.getlist('photos'):
            photo = TrapPhoto(trap=trap, event=event, uploaded_by=event.performed_by)
            _store_photo(photo, 'image', 'thumbnail', uploaded)
            photo.save()

        trap.apply_event_side_effects(event)
        return Response(TrapEventSerializer(event).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        request={'multipart/form-data': {
            'type': 'object',
            'properties': {
                'performed_at': {'type': 'string', 'format': 'date-time'},
                'comments': {'type': 'string'},
                'items': {'type': 'string',
                          'description': 'JSON list of {"species_slug", "quantity"}'},
                'photo_0': {'type': 'string', 'format': 'binary',
                            'description': 'Optional photo of item 0 (photo_1 for item 1, ...)'},
            },
        }, 'application/json': CatchSerializer},
        responses={201: TrapEventSerializer(many=True)},
    )
    @action(detail=True, methods=['post'], url_path='catches')
    def catches(self, request, pk=None):
        """Record one visit's catches: one event per species, sharing a batch."""
        trap = self.get_object()
        if not perms.can_act_on_trap(request, trap):
            raise PermissionDenied(
                "Only the owner and the members of the group in charge can record an event."
            )
        serializer = CatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        performed_by = perms.local_user(request)
        batch = uuid.uuid4()

        events, stored = [], []
        try:
            with transaction.atomic():
                for index, item in enumerate(data['items']):
                    event = TrapEvent.objects.create(
                        trap=trap, kind=TrapEvent.KIND_CATCH, performed_at=data['performed_at'],
                        performed_by=performed_by, species=item['species'],
                        quantity=item['quantity'], batch=batch,
                        # Said once for the whole visit, not repeated per species
                        comments=data['comments'] if index == 0 else '',
                    )
                    uploaded = request.FILES.get(f'photo_{index}')
                    if uploaded:
                        photo = TrapPhoto(trap=trap, event=event, uploaded_by=performed_by)
                        _store_photo(photo, 'image', 'thumbnail', uploaded)
                        stored.append(photo)
                        photo.save()
                    events.append(event)
                trap.recompute_hornet_catch_count()
        except Exception:
            # The rows are rolled back, the files written so far are not
            for photo in stored:
                _delete_files(photo.image, photo.thumbnail)
            raise

        return Response(TrapEventSerializer(events, many=True).data,
                        status=status.HTTP_201_CREATED)

    @extend_schema(responses={204: OpenApiResponse(description='Deleted'),
                              404: OpenApiResponse(description='Unknown batch')})
    @action(detail=True, methods=['delete'], url_path=r'catches/(?P<batch>[0-9a-f-]{36})')
    def delete_catches(self, request, pk=None, batch=None):
        """Remove every catch event recorded together, or none of them."""
        trap = self.get_object()
        events = list(trap.events.filter(batch=batch).select_related('trap'))
        if not events:
            return Response({'error': "Unknown batch."}, status=status.HTTP_404_NOT_FOUND)
        if not all(perms.can_delete_event(request, event) for event in events):
            raise PermissionDenied("You do not have permission to delete these events.")

        photos = list(TrapPhoto.objects.filter(event__in=events))
        with transaction.atomic():
            TrapEvent.objects.filter(pk__in=[event.pk for event in events]).delete()
            trap.recompute_hornet_catch_count()
        for photo in photos:
            _delete_files(photo.image, photo.thumbnail)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # -- delegation ----------------------------------------------------------

    @extend_schema(
        request={'application/json': {'type': 'object',
                                      'properties': {'group_path': {'type': 'string'},
                                                     'visibility': {'type': 'string'}}}},
        responses={200: TrapSerializer},
    )
    @action(detail=True, methods=['get', 'put', 'delete'], url_path='delegation')
    def delegation(self, request, pk=None):
        trap = self.get_object()

        if request.method == 'GET':
            if not perms.can_read_trap(request, trap):
                raise PermissionDenied("You do not have permission to view this trap.")
            allowed = perms.allowed_delegation_groups(request, trap)
            return Response({
                'group': ({'path': trap.group.path, 'name': trap.group.name}
                          if trap.group else None),
                'can_set_delegation': allowed is None or bool(allowed),
                'allowed_groups': (
                    None if allowed is None
                    else [{'path': p, 'name': _group_label(p)} for p in sorted(allowed)]
                ),
            })

        if not perms.can_set_delegation(request, trap):
            raise PermissionDenied(
                "Only the owner, an administrator of one of their groups or a platform "
                "administrator can change the delegation of this trap."
            )

        if request.method == 'DELETE':
            trap.group = None
            # A trap with no group cannot stay restricted to that group
            trap.visibility = Trap.VISIBILITY_PUBLIC
            trap.save(update_fields=['group', 'visibility', 'updated_at'])
            return Response(TrapSerializer(trap).data)

        group_path = request.data.get('group_path')
        if not group_path:
            raise DRFValidationError({'group_path': "This field is required."})
        allowed = perms.allowed_delegation_groups(request, trap)
        if allowed is not None and group_path not in allowed:
            raise PermissionDenied(f"You cannot delegate this trap to {group_path}.")

        trap.group = _group_for_path(group_path)
        visibility = request.data.get('visibility')
        if visibility in (Trap.VISIBILITY_PUBLIC, Trap.VISIBILITY_GROUP):
            trap.visibility = visibility
        trap.save(update_fields=['group', 'visibility', 'updated_at'])
        return Response(TrapSerializer(trap).data)

    @extend_schema(
        request={'application/json': {'type': 'object',
                                      'properties': {'owner_guid': {'type': 'string'}}}},
        responses={200: TrapSerializer},
    )
    @action(detail=True, methods=['put'], url_path='owner')
    def owner(self, request, pk=None):
        """Reassign a bequeathed trap. Administration task, platform admins only."""
        trap = self.get_object()
        if not perms.can_change_owner(request):
            raise PermissionDenied("Only a platform administrator can change the owner.")

        owner_guid = request.data.get('owner_guid')
        if not owner_guid:
            raise DRFValidationError({'owner_guid': "This field is required."})
        new_owner = User.objects.filter(guid=owner_guid).first()
        if new_owner is None:
            raise DRFValidationError({'owner_guid': "Unknown user."})

        previous = trap.owner_id
        trap.owner = new_owner
        trap.save(update_fields=['owner', 'updated_at'])
        logger.info("Trap %s reassigned from %s to %s", trap.id, previous, new_owner.guid)
        return Response(TrapSerializer(trap).data)


def _ancestors(path: str):
    """All parent group paths of `path`, e.g. `/a/b/c` -> `/a/b`, `/a`."""
    segments = path.strip('/').split('/')
    for i in range(len(segments) - 1, 0, -1):
        yield '/' + '/'.join(segments[:i])


class TrapEventViewSet(viewsets.GenericViewSet):
    """Individual journal entries: read, correct or remove one."""

    queryset = TrapEvent.objects.select_related('trap', 'species', 'performed_by')
    serializer_class = TrapEventSerializer

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        return [HasAnyRole(['volunteer', 'beekeeper', 'admin'])]

    def retrieve(self, request, *args, **kwargs):
        event = self.get_object()
        if not perms.can_read_trap(request, event.trap):
            raise PermissionDenied("You do not have permission to view this trap.")
        return Response(TrapEventSerializer(event).data)

    def partial_update(self, request, *args, **kwargs):
        event = self.get_object()
        if not perms.can_edit_event(request, event):
            raise PermissionDenied("You do not have permission to modify this event.")
        data = request.data.copy()
        # The kind drives the side effects already applied to the trap
        data.pop('kind', None)
        serializer = TrapEventSerializer(event, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        event = serializer.save()
        if event.kind == TrapEvent.KIND_CATCH:
            event.trap.recompute_hornet_catch_count()
        return Response(TrapEventSerializer(event).data)

    def destroy(self, request, *args, **kwargs):
        event = self.get_object()
        if not perms.can_delete_event(request, event):
            raise PermissionDenied("You do not have permission to delete this event.")
        trap, was_catch = event.trap, event.kind == TrapEvent.KIND_CATCH
        for photo in event.photos.all():
            _delete_files(photo.image, photo.thumbnail)
        event.delete()
        if was_catch:
            trap.recompute_hornet_catch_count()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TrapPhotoViewSet(viewsets.GenericViewSet):
    """Deleting a single photo of a journal entry."""

    queryset = TrapPhoto.objects.select_related('trap', 'event')
    serializer_class = TrapPhotoSerializer

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        return [HasAnyRole(['volunteer', 'beekeeper', 'admin'])]

    def destroy(self, request, *args, **kwargs):
        photo = self.get_object()
        allowed = (
            perms.can_delete_event(request, photo.event) if photo.event_id
            else (perms.can_edit_trap(request, photo.trap)
                  or perms.is_platform_admin(request.user))
        )
        if not allowed:
            raise PermissionDenied("You do not have permission to delete this photo.")
        _delete_files(photo.image, photo.thumbnail)
        photo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
