"""API of the traps module: referentials, traps, journal and photos."""

import logging
import uuid

from django.db import models as db_models, transaction
from django.db.models import Exists, F, Max, OuterRef, Prefetch, ProtectedError
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from drf_spectacular.types import OpenApiTypes

from hornet_finder_api import utils as keycloak
from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication
from hornet_finder_api.roles import APP_ROLES, BEEKEEPER, TRAPPER
from audit import recorder as audit

from . import trap_permissions as perms
from .invitation_views import BEEKEEPERS_ROOT, _sort_key
from .images import delete_files as _delete_files, store_photo as _store_photo
from .models import BeekeeperGroup, Species, Tag, Trap, TrapEvent, TrapPhoto, TrapType, User
from .serializers import (
    CatchSerializer, PublicTrapSerializer, SpeciesSerializer, TrapDetailSerializer, TrapEventSerializer,
    TrapPhotoSerializer, TrapSerializer, TrapTypeSerializer,
)
from .views import GeographicFilterMixin, geographic_list_schema

logger = logging.getLogger(__name__)

# Sort keys of the trap manager, mapped to the queryset field they order by
MANAGED_ORDERINGS = {
    'last_event_at': 'last_event',
    'hornet_catch_count': 'hornet_catch_count',
    'installed_at': 'installed_at',
    'address': 'address',
    'id': 'id',
}


class ManagedTrapPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


def _group_label(path: str) -> str:
    """Human-readable name derived from a Keycloak group path."""
    return path.strip('/').replace('/', ' / ')


def _keycloak_group_name(path: str):
    """Display name of the Keycloak group at `path`; None if unknown or Keycloak is down."""
    try:
        group = keycloak.get_group_by_path(path)
    except Exception as exc:
        logger.warning("Could not read Keycloak group %s: %s", path, exc)
        return None
    return keycloak.group_display_name(group) if group else None


def _group_choices(paths, extra=()):
    """
    Groups offered in a picker, as `{path, name}` sorted by name, named as in
    Keycloak (its description, else the group name).

    `paths=None` stands for "any group" (platform admin): every beekeeper
    association is then offered, plus the `extra` paths (the current choice).
    When Keycloak cannot be reached, names fall back on the paths and "any
    group" on the groups already known locally.
    """
    if paths is None:
        try:
            groups = [{'path': g['path'], 'name': keycloak.group_display_name(g)}
                      for g in keycloak.get_child_groups(BEEKEEPERS_ROOT)
                      if perms.is_beekeeper_group(g.get('path'))]
        except Exception as exc:
            logger.warning("Could not list Keycloak groups: %s", exc)
            groups = [{'path': g.path, 'name': g.name} for g in BeekeeperGroup.objects.all()
                      if perms.is_beekeeper_group(g.path)]
        known = {g['path'] for g in groups}
        paths = [p for p in extra if p and p not in known]
    else:
        groups = []
    groups += [{'path': p, 'name': _keycloak_group_name(p) or _group_label(p)} for p in paths]
    return sorted(groups, key=lambda g: (_sort_key(g['name']), g['path']))


def _group_for_path(path: str) -> BeekeeperGroup:
    """Local row mirroring a Keycloak group, created on first use, renamed as in Keycloak."""
    name = _keycloak_group_name(path) or _group_label(path)
    # The local name is unique: never steal the one of another group
    if BeekeeperGroup.objects.filter(name=name).exclude(path=path).exists():
        name = _group_label(path)
    group, created = BeekeeperGroup.objects.get_or_create(path=path, defaults={'name': name})
    if not created and group.name != name:
        group.name = name
        group.save(update_fields=['name'])
    return group


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
            return [HasAnyRole(list(APP_ROLES))]
        return [HasAnyRole(['admin'])]

    def perform_create(self, serializer):
        with transaction.atomic():
            instance = serializer.save()
            self._attach_photo(instance)
            kind = audit.type_of(instance)
            audit.record(self.request, f"{kind}.created", instance, changes=audit.snapshot(instance))

    def perform_update(self, serializer):
        kind = audit.type_of(serializer.instance)
        with audit.track(self.request, f"{kind}.updated", serializer.instance):
            self._attach_photo(serializer.save())

    def _record_deletion(self, request, instance, pk):
        kind = audit.type_of(instance)
        audit.record(request, f"{kind}.deleted", (kind, pk), changes=audit.snapshot(instance),
                     label=audit.label_of(instance))

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
        pk = trap_type.pk
        try:
            with transaction.atomic():
                trap_type.delete()
                self._record_deletion(request, trap_type, pk)
            # Only once deleted: a trap type still in use keeps its photo
            _delete_files(trap_type.photo, trap_type.photo_thumbnail)
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

    @extend_schema(
        request={'application/json': {'type': 'object', 'properties': {
            'ids': {'type': 'array', 'items': {'type': 'integer'}}}, 'required': ['ids']}},
        responses={204: OpenApiResponse(description='Reordered'),
                   400: OpenApiResponse(description='ids is not the list of every species')},
    )
    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Set the display order to the given list of species ids (first = top)."""
        ids = request.data.get('ids')
        current = set(Species.objects.values_list('id', flat=True))
        if (not isinstance(ids, list) or len(ids) != len(set(ids))
                or not all(isinstance(pk, int) and not isinstance(pk, bool) for pk in ids)
                or set(ids) != current):
            raise DRFValidationError({'ids': 'Must list every species exactly once.'})
        # Renumber everything: existing sort_order values are often all equal
        with transaction.atomic():
            for position, pk in enumerate(ids):
                Species.objects.filter(pk=pk).update(sort_order=position)
            audit.record(request, 'species.reordered', ('species', None), changes={'order': ids},
                         refs=[audit.ref('species', pk) for pk in ids])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(responses={204: OpenApiResponse(description='Deleted'),
                              409: OpenApiResponse(description='Species still in use')})
    def destroy(self, request, *args, **kwargs):
        species = self.get_object()
        pk = species.pk
        try:
            with transaction.atomic():
                species.delete()
                self._record_deletion(request, species, pk)
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
        # Traps belong to trappers and beekeepers; the rest is decided per trap
        if action_name in ('create', 'my'):
            return [HasAnyRole([TRAPPER, BEEKEEPER])]
        return [HasAnyRole(list(APP_ROLES))]

    # -- querysets -----------------------------------------------------------

    def _readable_queryset(self, request):
        """Traps the requester may see: public ones, their own, their groups'."""
        return perms.readable_traps(request, self.queryset)

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

    @extend_schema(
        parameters=[
            OpenApiParameter(name='scope', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY,
                             required=False,
                             description="'mine' (default), 'delegated' or 'all' (platform admins)"),
            OpenApiParameter(name='active', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY,
                             required=False, description="'true' (default), 'false' or 'all'"),
            OpenApiParameter(name='group', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY,
                             required=False, description="Path of the delegated group"),
            OpenApiParameter(name='trap_type', type=OpenApiTypes.STR,
                             location=OpenApiParameter.QUERY, required=False,
                             description="Slug of the trap type"),
            OpenApiParameter(name='has_tag', type=OpenApiTypes.STR,
                             location=OpenApiParameter.QUERY, required=False,
                             description="'true' or 'false'"),
            OpenApiParameter(name='q', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY,
                             required=False,
                             description="Number, address, comments or tag code"),
            OpenApiParameter(name='ordering', type=OpenApiTypes.STR,
                             location=OpenApiParameter.QUERY, required=False,
                             description=("One of " + ', '.join(sorted(MANAGED_ORDERINGS))
                                          + ", prefixed with '-' for descending order. "
                                          "No ordering by distance")),
            OpenApiParameter(name='page', type=OpenApiTypes.INT, location=OpenApiParameter.QUERY,
                             required=False),
            OpenApiParameter(name='page_size', type=OpenApiTypes.INT,
                             location=OpenApiParameter.QUERY, required=False),
        ],
        responses={200: TrapSerializer(many=True)},
    )
    @action(detail=False, methods=['get'])
    def managed(self, request):
        """
        The trap manager: traps the caller owns (`mine`), traps delegated to one
        of their groups (`delegated`), or every trap (`all`, platform admins).

        Unlike the map listing there is no radius: the scope already limits the
        result to traps the caller manages. Filtered, sorted and paginated here,
        since a group or the whole platform can hold thousands of traps.
        """
        params = request.query_params
        guid = getattr(request.user, 'guid', None)
        scope = params.get('scope', 'mine')
        queryset = self.queryset
        if scope == 'mine':
            queryset = queryset.filter(owner__guid=guid)
        elif scope == 'delegated':
            queryset = queryset.filter(
                group__path__in=perms.member_group_paths(request),
            ).exclude(owner__guid=guid)
        elif scope == 'all':
            if not perms.is_platform_admin(request.user):
                raise PermissionDenied("Only a platform administrator can list every trap.")
        else:
            raise DRFValidationError({'scope': "Expected 'mine', 'delegated' or 'all'."})

        active = params.get('active', 'true')
        if active in ('true', 'false'):
            queryset = queryset.filter(active=(active == 'true'))
        if params.get('group'):
            queryset = queryset.filter(group__path=params['group'])
        if params.get('trap_type'):
            queryset = queryset.filter(trap_type__slug=params['trap_type'])
        if params.get('has_tag') in ('true', 'false'):
            live_tag = Exists(Tag.objects.filter(trap=OuterRef('pk'), revoked_at__isnull=True))
            queryset = queryset.filter(live_tag if params['has_tag'] == 'true' else ~live_tag)
        search = params.get('q', '').strip().lstrip('#')
        if search:
            match = (db_models.Q(address__icontains=search)
                     | db_models.Q(comments__icontains=search)
                     | Exists(Tag.objects.filter(trap=OuterRef('pk'), revoked_at__isnull=True,
                                                 value__icontains=search)))
            if search.isdigit():
                match |= db_models.Q(pk=int(search))
            queryset = queryset.filter(match)

        # One aggregate instead of a query per trap in the serializer
        queryset = queryset.annotate(last_event=Max('events__performed_at'))

        ordering = params.get('ordering', 'last_event_at')
        field = ordering.lstrip('-')
        descending = ordering.startswith('-')
        if field not in MANAGED_ORDERINGS:
            raise DRFValidationError({'ordering': f"Unknown ordering '{ordering}'."})
        expression = F(MANAGED_ORDERINGS[field])
        # Never visited traps are the most overdue: first in ascending order
        expression = (expression.desc(nulls_last=True) if descending
                      else expression.asc(nulls_first=True))
        queryset = queryset.order_by(expression, '-id')

        paginator = ManagedTrapPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        # Owners repeat across a page: resolve each display name once
        serializer = TrapSerializer(page, many=True, context={'user_summaries': {}})
        return paginator.get_paginated_response(serializer.data)

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
        audit.record(self.request, 'trap.created', trap, changes=audit.snapshot(trap),
                     refs=[audit.ref('trap_event', event.pk)])
        self._created_trap = trap

    def perform_update(self, serializer):
        with audit.track(self.request, 'trap.updated', serializer.instance):
            serializer.save()

    def create(self, request, *args, **kwargs):
        with transaction.atomic():
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
        files = [(photo.image, photo.thumbnail) for photo in trap.photos.all()]
        files.append((trap.photo, trap.photo_thumbnail))
        with transaction.atomic():
            changes = {**audit.snapshot(trap), 'events': trap.events.count(),
                       'hornet_catch_count': trap.hornet_catch_count}
            refs = audit.default_refs(trap)
            response = super().destroy(request, *args, **kwargs)
            audit.record(request, 'trap.deleted', ('trap', trap.pk), changes=changes, refs=refs,
                         label=audit.label_of(trap))
        for image, thumbnail in files:
            _delete_files(image, thumbnail)
        return response

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

        uploaded = request.FILES.get('photo')
        if request.method != 'DELETE' and not uploaded:
            raise DRFValidationError({'photo': "No file received."})
        action = 'trap.photo_removed' if request.method == 'DELETE' else 'trap.photo_set'
        with audit.track(request, action, trap, fields=['photo']):
            _delete_files(trap.photo, trap.photo_thumbnail)
            if request.method == 'DELETE':
                trap.photo = None
                trap.photo_thumbnail = None
            else:
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
        uploads = request.FILES.getlist('photos')
        with transaction.atomic():
            event = serializer.save(trap=trap, performed_by=perms.local_user(request))

            for uploaded in uploads:
                photo = TrapPhoto(trap=trap, event=event, uploaded_by=event.performed_by)
                _store_photo(photo, 'image', 'thumbnail', uploaded)
                photo.save()

            trap.apply_event_side_effects(event)
            # A catch gets its quantity derived by the side effects
            event.refresh_from_db()
            audit.record(request, 'trap.event_recorded', event,
                         changes={**audit.snapshot(event), 'photos': len(uploads)})
        return Response(TrapEventSerializer(event).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        request={'multipart/form-data': {
            'type': 'object',
            'properties': {
                'performed_at': {'type': 'string', 'format': 'date-time'},
                'comments': {'type': 'string'},
                'items': {'type': 'string',
                          'description': 'JSON list of {"species_slug", "quantity"}, '
                                         'quantity being what the trap holds'},
                'bycatch_counted': {'type': 'boolean',
                                    'description': 'Whether the other species were counted'},
                'emptied': {'type': 'boolean',
                            'description': 'Whether the trap was emptied, required when '
                                           'its type accumulates'},
                'actions': {'type': 'string',
                            'description': 'JSON list of actions done during the visit: '
                                           '"cleaning", "refill", "repair"'},
                'photo_0': {'type': 'string', 'format': 'binary',
                            'description': 'Optional photo of item 0 (photo_1 for item 1, ...)'},
            },
        }, 'application/json': CatchSerializer},
        responses={201: TrapEventSerializer(many=True)},
    )
    @action(detail=True, methods=['post'], url_path='catches')
    def catches(self, request, pk=None):
        """Record one visit: one catch event per species, then one event per
        action done at the same time, all sharing a batch. The catches of the
        reading are derived from what the trap held (`Trap.recompute_catches`)."""
        trap = self.get_object()
        if not perms.can_act_on_trap(request, trap):
            raise PermissionDenied(
                "Only the owner and the members of the group in charge can record an event."
            )
        serializer = CatchSerializer(data=request.data, context={'trap': trap})
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
                        # Derived below, once the reading is in the journal
                        quantity=item['quantity'], observed_quantity=item['quantity'],
                        emptied=data['emptied'], batch=batch,
                        bycatch_counted=data['bycatch_counted'],
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
                for kind in data['actions']:
                    event = TrapEvent.objects.create(
                        trap=trap, kind=kind, performed_at=data['performed_at'],
                        performed_by=performed_by, batch=batch,
                    )
                    events.append(event)
                trap.recompute_catches()
                audit.record(request, 'trap.visit_recorded', trap, changes={
                    'batch': str(batch),
                    'performed_at': audit.json_value(data['performed_at']),
                    'items': [{'species': item['species'].slug, 'observed': item['quantity']}
                              for item in data['items']],
                    'actions': list(data['actions']),
                    'emptied': data['emptied'],
                    'bycatch_counted': data['bycatch_counted'],
                    'photos': len(stored),
                }, refs=[audit.ref('visit', batch)] + [audit.ref('trap_event', e.pk) for e in events])
        except Exception:
            # The rows are rolled back, the files written so far are not
            for photo in stored:
                _delete_files(photo.image, photo.thumbnail)
            raise

        # Read back with their derived quantities, in the order they were created
        events = TrapEvent.objects.filter(pk__in=[event.pk for event in events]).order_by('id')
        return Response(TrapEventSerializer(events, many=True).data,
                        status=status.HTTP_201_CREATED)

    @extend_schema(responses={204: OpenApiResponse(description='Deleted'),
                              404: OpenApiResponse(description='Unknown batch')})
    @action(detail=True, methods=['delete'], url_path=r'catches/(?P<batch>[0-9a-f-]{36})')
    def delete_catches(self, request, pk=None, batch=None):
        """Remove every event of a visit (catches and actions), or none of them."""
        trap = self.get_object()
        events = list(trap.events.filter(batch=batch).select_related('trap'))
        if not events:
            return Response({'error': "Unknown batch."}, status=status.HTTP_404_NOT_FOUND)
        if not all(perms.can_delete_event(request, event) for event in events):
            raise PermissionDenied("You do not have permission to delete these events.")

        photos = list(TrapPhoto.objects.filter(event__in=events))
        with transaction.atomic():
            removed = [audit.snapshot(event) for event in events]
            TrapEvent.objects.filter(pk__in=[event.pk for event in events]).delete()
            trap.recompute_catches()
            audit.record(request, 'trap.visit_deleted', trap,
                         changes={'batch': batch, 'events': removed, 'photos': len(photos)},
                         refs=[audit.ref('visit', batch)] + [audit.ref('trap_event', e.pk) for e in events])
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
                # Always a list: a platform admin picks among every association
                'allowed_groups': _group_choices(
                    allowed, extra=[trap.group.path] if trap.group else []),
            })

        if not perms.can_set_delegation(request, trap):
            raise PermissionDenied(
                "Only the owner, an administrator of one of their groups or a platform "
                "administrator can change the delegation of this trap."
            )

        delegation_fields = ['group', 'visibility']
        previous_group = trap.group.path if trap.group else None
        if request.method == 'DELETE':
            with audit.track(request, 'trap.undelegated', trap, fields=delegation_fields) as tracked:
                if previous_group:
                    tracked.extra = {'group_path': [previous_group, None]}
                    tracked.refs = [audit.ref('group', previous_group)]
                trap.group = None
                # A trap with no group cannot stay restricted to that group
                trap.visibility = Trap.VISIBILITY_PUBLIC
                trap.save(update_fields=['group', 'visibility', 'updated_at'])
            return Response(TrapSerializer(trap).data)

        group_path = request.data.get('group_path')
        if not group_path:
            raise DRFValidationError({'group_path': "This field is required."})
        # Beekeeper associations only, platform admins included
        if not perms.can_delegate_to(request, trap, group_path):
            raise PermissionDenied(f"You cannot delegate this trap to {group_path}.")

        with audit.track(request, 'trap.delegated', trap, fields=delegation_fields) as tracked:
            trap.group = _group_for_path(group_path)
            visibility = request.data.get('visibility')
            if visibility in (Trap.VISIBILITY_PUBLIC, Trap.VISIBILITY_GROUP):
                trap.visibility = visibility
            trap.save(update_fields=['group', 'visibility', 'updated_at'])
            if previous_group != group_path:
                tracked.extra = {'group_path': [previous_group, group_path]}
            tracked.refs = [audit.ref('group', path) for path in (previous_group, group_path) if path]
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
        with audit.track(request, 'trap.owner_changed', trap, fields=['owner']) as tracked:
            tracked.refs = [audit.ref('user', guid) for guid in (previous, new_owner.guid) if guid]
            trap.owner = new_owner
            trap.save(update_fields=['owner', 'updated_at'])
        logger.info("Trap %s reassigned from %s to %s", trap.id, previous, new_owner.guid)
        return Response(TrapSerializer(trap).data)


class TrapEventViewSet(viewsets.GenericViewSet):
    """Individual journal entries: read, correct or remove one."""

    queryset = TrapEvent.objects.select_related('trap', 'species', 'performed_by')
    serializer_class = TrapEventSerializer

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        return [HasAnyRole(list(APP_ROLES))]

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
        # The derived quantity is not the correction: only what was typed is compared
        fields = [name for name in audit.FIELDS['trap_event'] if name != 'quantity']
        with audit.track(request, 'trap.event_corrected', event, fields=fields):
            event = serializer.save()
            # A reading or an installation moved or changed shifts the catches after it
            if event.kind in TrapEvent.BASELINE_KINDS:
                event.trap.recompute_catches()
                event.refresh_from_db()
        return Response(TrapEventSerializer(event).data)

    def destroy(self, request, *args, **kwargs):
        event = self.get_object()
        if not perms.can_delete_event(request, event):
            raise PermissionDenied("You do not have permission to delete this event.")
        trap, shifts = event.trap, event.kind in TrapEvent.BASELINE_KINDS
        photos = list(event.photos.all())
        with transaction.atomic():
            changes = {**audit.snapshot(event), 'photos': len(photos)}
            pk = event.pk
            event.delete()
            if shifts:
                trap.recompute_catches()
            audit.record(request, 'trap.event_deleted', ('trap_event', pk), changes=changes,
                         label=trap.address,
                         refs=[audit.ref('trap', trap.pk)])
        for photo in photos:
            _delete_files(photo.image, photo.thumbnail)
        return Response(status=status.HTTP_204_NO_CONTENT)


class TrapPhotoViewSet(viewsets.GenericViewSet):
    """Deleting a single photo of a journal entry."""

    queryset = TrapPhoto.objects.select_related('trap', 'event')
    serializer_class = TrapPhotoSerializer

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        return [HasAnyRole(list(APP_ROLES))]

    def destroy(self, request, *args, **kwargs):
        photo = self.get_object()
        allowed = (
            perms.can_delete_event(request, photo.event) if photo.event_id
            else (perms.can_edit_trap(request, photo.trap)
                  or perms.is_platform_admin(request.user))
        )
        if not allowed:
            raise PermissionDenied("You do not have permission to delete this photo.")
        with transaction.atomic():
            refs = [audit.ref('trap', photo.trap_id)]
            if photo.event_id:
                refs.append(audit.ref('trap_event', photo.event_id))
            audit.record(request, 'trap.journal_photo_removed', ('trap_photo', photo.pk),
                         label=photo.trap.address, changes={
                'event': photo.event_id, 'uploaded_by': audit.json_value(photo.uploaded_by_id),
                'uploaded_at': audit.json_value(photo.created_at),
            }, refs=refs)
            photo.delete()
        _delete_files(photo.image, photo.thumbnail)
        return Response(status=status.HTTP_204_NO_CONTENT)
