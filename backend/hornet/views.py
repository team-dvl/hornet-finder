import logging
import uuid

from django.contrib.gis.measure import D
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.utils import timezone

from django.db import transaction
from django.db.models import Q

from rest_framework import viewsets
from rest_framework.decorators import action, api_view
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError as DRFValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from . import nest_alerts
from . import nest_permissions as nest_perms
from . import pending
from .group_views import _Roster, _full_name
from .invitation_views import _keycloak, _sort_key
from .images import delete_files, store_photo
from .models import Apiary, Hornet, Nest, NestEvent, NestPhoto, User
from .stats.periods import PeriodError, resolve_archive_period
from .serializers import (
    HornetSerializer, NestEventInputSerializer, NestSerializer, PublicHornetSerializer, PublicNestSerializer,
)
from .trap_permissions import TRAPPERS_ROOT
from hornet_finder_api import utils as keycloak
from hornet_finder_api.authentication import JWTBearerAuthentication, HasAnyRole
from hornet_finder_api.roles import ADMIN, APP_ROLES, BEEKEEPER, HUNTER
from audit import recorder as audit
from rest_framework import status

logger = logging.getLogger(__name__)


class GeographicFilterMixin:
    def get_geographic_queryset(self, request, default_radius=5):
        """
        Filter the queryset by geographic distance

        :param request: The HTTP request
        :type request: HttpRequest
        :param default_radius: The default radius in km
        :type default_radius: float
        :return: tuple of (filtered_queryset, error_response_or_None)
        :rtype: tuple
        """
        lat = request.query_params.get('lat')
        lon = request.query_params.get('lon')
        radius = request.query_params.get('radius', default_radius)
        
        if not lat or not lon:
            return None, Response({"error": "lat and lon parameters are required"}, status=400)
        
        try:
            lat = float(lat)
            lon = float(lon)
            radius = float(radius)
        except ValueError:
            return None, Response({"error": "lat, lon and radius must be valid numbers"}, status=400)

        if radius > 5 and (not request.user or not request.user.is_authenticated or 'admin' not in getattr(request.user, 'roles', [])):
            return None, Response({"error": "You can only search within a radius of 5 km unless you are an admin"}, status=403)

        center = Point(lon, lat, srid=4326)
        queryset = self.queryset.annotate(distance=Distance('point', center)).filter(distance__lte=D(km=radius))
        
        return queryset, None


class ArchiveFilterMixin:
    """Mixin adding `year`/`archived` query param filtering and archive/archive_candidates/bulk_archive actions."""

    def apply_archive_year_filters(self, queryset, request):
        """
        Apply the `year` and `archived` query param filters to a queryset.

        `year`: filters on created_at's year. Defaults to the current year. Use 'all' to disable.
        `archived`: 'false' (default, excludes archived), 'true' (only archived), 'all' (no filter).
        """
        year = request.query_params.get('year')
        if year is None:
            queryset = queryset.filter(created_at__year=timezone.now().year)
        elif year != 'all':
            queryset = queryset.filter(created_at__year=year)

        archived = request.query_params.get('archived', 'false')
        if archived == 'false':
            queryset = queryset.filter(archived=False)
        elif archived == 'true':
            queryset = queryset.filter(archived=True)

        return queryset

    @extend_schema(
        responses={200: OpenApiResponse(description='Archived object')},
    )
    @action(detail=True, methods=['post'], permission_classes=[HasAnyRole(['admin'])])
    def archive(self, request, pk=None):
        obj = self.get_object()
        with transaction.atomic():
            obj.archived = True
            obj.archived_at = timezone.now()
            obj.save()
            audit.record(request, f"{audit.type_of(obj)}.archived", obj)
        serializer = self.get_serializer(obj)
        return Response(serializer.data)

    def archivable(self, request):
        """
        The objects still to archive in the period asked (whole season or year
        that is over), and that period; or an error response.
        """
        try:
            period = resolve_archive_period(request.query_params)
        except PeriodError as error:
            return None, None, Response({"error": str(error)}, status=400)
        queryset = self.queryset.filter(
            created_at__gte=period.start_dt, created_at__lt=period.end_dt, archived=False
        )
        return queryset, period, None

    ARCHIVE_PARAMETERS = [
        OpenApiParameter(name='period', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False,
                         enum=['season', 'year'], description="`year` (default) or `season`"),
        OpenApiParameter(name='season', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False,
                         enum=['spring', 'summer', 'late'], description="Required with `period=season`"),
        OpenApiParameter(name='year', type=OpenApiTypes.INT, location=OpenApiParameter.QUERY, required=True),
    ]

    @extend_schema(
        parameters=ARCHIVE_PARAMETERS,
        responses={200: OpenApiResponse(description='Number of objects an archiving of the period would archive')},
    )
    @action(detail=False, methods=['get'], permission_classes=[HasAnyRole(['admin'])])
    def archive_candidates(self, request):
        queryset, period, error = self.archivable(request)
        if error:
            return error
        return Response({"count": queryset.count(), "period": period.as_dict()})

    @extend_schema(
        parameters=ARCHIVE_PARAMETERS,
        responses={200: OpenApiResponse(description='Number of archived objects')},
    )
    @action(detail=False, methods=['post'], permission_classes=[HasAnyRole(['admin'])])
    def bulk_archive(self, request):
        queryset, period, error = self.archivable(request)
        if error:
            return error
        kind = audit.TYPES[queryset.model._meta.model_name]
        with transaction.atomic():
            ids = list(queryset.values_list('pk', flat=True))
            updated_count = queryset.model.objects.filter(pk__in=ids).update(
                archived=True, archived_at=timezone.now())
            audit.record(request, f"{kind}.bulk_archived", (kind, None),
                         changes={'count': updated_count, 'period': period.as_dict()},
                         refs=[audit.ref(kind, pk) for pk in ids])
        return Response({"archived_count": updated_count, "period": period.as_dict()})


def geographic_list_schema(default_radius=5):
    """Decorator to extend schema for geographic filtering in list actions.
    
    :param default_radius: The default radius in km
    :type default_radius: float
    :return: Decorator for extending schema
    :rtype: function
    """
    return extend_schema(
        parameters=[
            OpenApiParameter(name='lat', type=OpenApiTypes.FLOAT, location=OpenApiParameter.QUERY, 
                           required=True),
            OpenApiParameter(name='lon', type=OpenApiTypes.FLOAT, location=OpenApiParameter.QUERY, 
                           required=True),
            OpenApiParameter(name='radius', type=OpenApiTypes.FLOAT, location=OpenApiParameter.QUERY,  
                           required=False, default=default_radius),
        ]
    )


class HornetViewSet(ArchiveFilterMixin, GeographicFilterMixin, viewsets.ModelViewSet):
    queryset = Hornet.objects.all()
    serializer_class = HornetSerializer

    @geographic_list_schema() # The permissions and authentication for this action are handled in the get_authenticators and get_permissions methods
    def list(self, request, *args, **kwargs):
        queryset, error_response = self.get_geographic_queryset(request)
        if error_response:
            return error_response
        
        queryset = self.apply_archive_year_filters(queryset, request)
        # The reporter's name is personal data: shown to the roles that see every nest with its author,
        # not to anonymous visitors nor to trappers
        serializer_class = HornetSerializer if nest_perms.sees_all_nests(request) else PublicHornetSerializer
        serializer = serializer_class(queryset, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @extend_schema(
        responses={200: HornetSerializer(many=True)},
    )
    @action(detail=False, methods=['get'])
    def my(self, request):
        user_guid = getattr(request.user, 'guid', None)
        user_obj = User.objects.filter(guid=user_guid).first()
        queryset = Hornet.objects.filter(created_by=user_obj)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    # Anyone may list the sightings (without their author unless the role sees every nest); only nest hunters
    # (trained, hence members of /hunters) and admins record them; only admins retrieve, update, archive and delete
    def get_authenticators(self): # This method is used here because we can not use the @authentication_classes decorator on the herited actions
        # list, create, retrieve, update, partial_update, destroy are the names of the actions that are automatically created by the ModelViewSet
        # Each action corresponds to a method in the viewset, e.g. list corresponds to the GET /hornets/ endpoint.
        # if hasattr(self, 'action') and self.action in ['list', 'retrieve', 'update', 'partial_update', 'destroy']:
        # Allow public access to list action (viewing hornets)
        if hasattr(self, 'action') and self.action in ['retrieve', 'create', 'update', 'partial_update', 'destroy', 'my', 'archive', 'archive_candidates', 'bulk_archive']:
            return [JWTBearerAuthentication()]
        return super().get_authenticators()

    def get_permissions(self): # This method is used here because we can not use the @permission_classes decorator on the herited actions
        # Allow public access to list action (viewing hornets)
        # Sightings and releases are the work of the (trained) nest hunters
        if hasattr(self, 'action') and self.action in ('create', 'my'):
            return [HasAnyRole([HUNTER, ADMIN])]
        elif hasattr(self, 'action') and self.action in ['retrieve', 'update', 'partial_update', 'destroy', 'archive', 'archive_candidates', 'bulk_archive']:
            return [HasAnyRole(['admin'])]
        return super().get_permissions()
    
    def perform_create(self, serializer):
        user_guid = getattr(self.request.user, 'guid', None)
        user_obj = User.objects.filter(guid=user_guid).first()
        with transaction.atomic():
            hornet = serializer.save(created_by=user_obj, linked_nest=None)
            audit.record(self.request, 'hornet.reported', hornet, changes=audit.snapshot(hornet))

    def perform_update(self, serializer):
        with audit.track(self.request, 'hornet.updated', serializer.instance,
                         resolve=lambda changes: audit.flip_action('hornet', changes, None)):
            serializer.save()

    def perform_destroy(self, instance):
        with transaction.atomic():
            changes, label = audit.snapshot(instance), audit.label_of(instance)
            pk = instance.pk
            instance.delete()
            audit.record(self.request, 'hornet.deleted', ('hornet', pk), changes=changes, label=label)

# Photos accepted in one request (creation or addition)
MAX_NEST_PHOTOS_PER_REQUEST = 10

PHOTOS_REQUEST_SCHEMA = {
    'multipart/form-data': {
        'type': 'object',
        'properties': {'photos': {'type': 'array', 'items': {'type': 'string', 'format': 'binary'}}},
    },
}


# Orderings of the nest list of the module (`?ordering=`)
NEST_ORDERINGS = ('-created_at', 'created_at', '-last_event_at', 'last_event_at', '-id', 'id')
# Longest section of "À traiter": the rest is in the list
TODO_SECTION_MAX = 100


class NestPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class NestViewSet(ArchiveFilterMixin, GeographicFilterMixin, viewsets.ModelViewSet):
    queryset = Nest.objects.select_related('created_by', 'owner').prefetch_related('photos')
    serializer_class = NestSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    # Actions answering one nest with its journal
    JOURNAL_ACTIONS = ('retrieve', 'create', 'update', 'partial_update', 'events', 'delete_event',
                       'add_photos', 'delete_photo')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['with_events'] = getattr(self, 'action', None) in self.JOURNAL_ACTIONS
        return context

    def _readable(self, pk):
        """The nest `pk` if the requester may see it in full; 404 otherwise, as if it did not exist."""
        nest = self.get_queryset().prefetch_related('events__performed_by', 'events__photos').filter(pk=pk).first()
        if nest is None or not nest_perms.can_read_nest(self.request, nest):
            raise NotFound("Nid introuvable.")
        return nest

    def retrieve(self, request, *args, **kwargs):
        return Response(self.get_serializer(self._readable(kwargs['pk'])).data)

    @geographic_list_schema() # The permissions and authentication for this action are handled in the get_authenticators and get_permissions methods
    def list(self, request, *args, **kwargs):
        queryset, error_response = self.get_geographic_queryset(request)
        if error_response:
            return error_response
        
        queryset = self.apply_archive_year_filters(queryset, request)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @geographic_list_schema() # Public endpoint for destroyed nests only
    @action(detail=False, methods=['get'])
    def destroyed(self, request, *args, **kwargs):
        queryset, error_response = self.get_geographic_queryset(request)
        if error_response:
            return error_response
        
        # Filter only destroyed nests
        queryset = queryset.filter(destroyed=True)
        queryset = self.apply_archive_year_filters(queryset, request)
        
        # Use public serializer to exclude sensitive information like created_by
        serializer = PublicNestSerializer(queryset, many=True)
        return Response(serializer.data)

    @geographic_list_schema()
    @action(detail=False, methods=['get'])
    def my(self, request, *args, **kwargs):
        """The nests the requester owns, with the filters of `list`: what a trapper sees besides the destroyed ones."""
        queryset, error_response = self.get_geographic_queryset(request)
        if error_response:
            return error_response
        queryset = queryset.filter(owner__guid=getattr(request.user, 'guid', None))
        queryset = self.apply_archive_year_filters(queryset, request)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    # Everyone may report a nest and see their own; every nest, with its author, is for
    # nest hunters, beekeepers and admins. The content of a nest (fields, photos) is
    # managed by admins and by the administrators of the nest hunters (`/hunters/admin`),
    # checked per action below; only admins archive and delete (see nest_permissions.py)
    def get_authenticators(self):
        # Allow public access to destroyed action (viewing destroyed nests)
        if hasattr(self, 'action') and self.action == 'destroyed':
            return super().get_authenticators()
        # Require authentication for all other nest operations
        return [JWTBearerAuthentication()]
    
    def get_permissions(self):
        # Allow public access to destroyed action (viewing destroyed nests)
        if hasattr(self, 'action') and self.action == 'destroyed':
            return super().get_permissions()
        if hasattr(self, 'action') and self.action in (
            'create', 'my', 'update', 'partial_update', 'add_photos', 'delete_photo', 'nearby_apiaries',
            'retrieve', 'events', 'delete_event', 'managed', 'todo', 'owner',
        ):
            return [HasAnyRole(list(APP_ROLES))]
        if hasattr(self, 'action') and self.action == 'list':
            return [HasAnyRole([HUNTER, BEEKEEPER, ADMIN])]
        return [HasAnyRole(['admin'])]

    def _uploaded_photos(self):
        """The `photos` files of the request, checked for their number."""
        uploaded = self.request.FILES.getlist('photos')
        if len(uploaded) > MAX_NEST_PHOTOS_PER_REQUEST:
            raise DRFValidationError(
                {'photos': f"At most {MAX_NEST_PHOTOS_PER_REQUEST} photos at a time."}
            )
        return uploaded

    def _store_photos(self, nest, uploaded, user, event=None):
        """Store the photos of a nest. Files already written are removed if one is rejected."""
        stored = []
        try:
            for upload in uploaded:
                photo = NestPhoto(nest=nest, uploaded_by=user, event=event)
                store_photo(photo, 'image', 'thumbnail', upload)
                stored.append(photo)
                photo.save()
        except Exception:
            for photo in stored:
                delete_files(photo.image, photo.thumbnail)
            raise

    def _fresh(self, nest):
        """The nest reloaded with its photos (and journal), for the response."""
        return self.get_queryset().prefetch_related('events__performed_by', 'events__photos').get(pk=nest.pk)

    def _requester(self):
        return User.objects.filter(guid=getattr(self.request.user, 'guid', None)).first()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded = self._uploaded_photos()
        user = self._requester()
        state = serializer.validated_data.pop('state', NestEvent.OUTCOME_UNKNOWN)
        # Clients before the journal may report a nest already destroyed
        destroyed = serializer.validated_data.pop('destroyed', False)
        destroyed_at = serializer.validated_data.pop('destroyed_at', None)
        with transaction.atomic():
            nest = serializer.save(created_by=user, owner=user, destroyed=False, destroyed_at=None)
            NestEvent.objects.create(nest=nest, kind=NestEvent.KIND_REPORT, performed_at=nest.created_at,
                                     performed_by=user, outcome=state)
            if destroyed:
                NestEvent.objects.create(nest=nest, kind=NestEvent.KIND_DESTRUCTION, actor='unknown',
                                         performed_at=destroyed_at or nest.created_at, performed_by=user)
            nest.recompute_status()
            self._store_photos(nest, uploaded, user)
            audit.record(request, 'nest.reported', nest,
                         changes={**audit.snapshot(nest), 'state': state, 'photos': len(uploaded)})
        return Response(self.get_serializer(self._fresh(nest)).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        nest = self.get_object()
        if not nest_perms.can_edit_nest(request, nest):
            raise PermissionDenied("You do not have permission to update this nest.")
        was_destroyed, was_destroyed_at = nest.destroyed, nest.destroyed_at
        with audit.track(request, 'nest.updated', nest,
                         resolve=lambda changes: audit.flip_action('nest', changes, None)):
            response = super().update(request, *args, **kwargs)
            self._journal_destroyed_flag(Nest.objects.get(pk=nest.pk), was_destroyed, was_destroyed_at)
        # Photos are managed through their own actions, the response shows them all
        response.data = self.get_serializer(self._fresh(nest)).data
        return response

    def _journal_destroyed_flag(self, nest, was_destroyed, was_destroyed_at):
        """
        `destroyed` and `destroyed_at` set through PATCH (clients before the
        journal): written to the journal, which the status follows.
        """
        if nest.destroyed == was_destroyed and nest.destroyed_at == was_destroyed_at:
            return
        user = self._requester()
        if nest.destroyed and not was_destroyed:
            NestEvent.objects.create(nest=nest, kind=NestEvent.KIND_DESTRUCTION, actor='unknown',
                                     performed_at=nest.destroyed_at or timezone.now(), performed_by=user)
        elif was_destroyed and not nest.destroyed:
            NestEvent.objects.create(nest=nest, kind=NestEvent.KIND_REACTIVATION, performed_at=timezone.now(),
                                     performed_by=user, alerted_at=timezone.now())
        else:
            # A new date for the destruction already recorded
            last = nest.events.filter(kind=NestEvent.KIND_DESTRUCTION).order_by('-performed_at', '-id').first()
            if last and nest.destroyed_at:
                last.performed_at = nest.destroyed_at
                last.details = {k: v for k, v in last.details.items() if k != 'date_unknown'}
                last.save(update_fields=['performed_at', 'details'])
        nest.recompute_status()

    # --- Journal ---------------------------------------------------------------

    @extend_schema(request=NestEventInputSerializer, responses={201: NestSerializer})
    @action(detail=True, methods=['post'], url_path='events')
    def events(self, request, pk=None):
        """
        Record a verification (`kind=visit`: on the spot or not, from the photos
        or a call with the reporter; `outcome`: active, empty, other_species,
        not_found; `basis`; `nest_type`, `height_class`, `size_class`), a destruction (`performed_at`,
        `actor`, `fixmystreet_ref`, `means`) or a reactivation (admins), with
        `comments` and `photos` files. The status of the nest follows.
        """
        nest = self._readable(pk)
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if hasattr(data, 'pop'):
            data.pop('photos', None)
        entry = NestEventInputSerializer(data=data)
        entry.is_valid(raise_exception=True)
        values = entry.validated_data
        kind = values['kind']
        if kind == NestEvent.KIND_VISIT and not nest_perms.can_visit_nest(request, nest):
            raise PermissionDenied("Seuls les coordinateurs enregistrent une vérification, et pas sur un nid neutralisé.")
        if kind == NestEvent.KIND_DESTRUCTION and not nest_perms.can_record_destruction(request, nest):
            raise PermissionDenied("Ce nid est déjà neutralisé, ou vous ne pouvez pas enregistrer sa neutralisation.")
        if kind == NestEvent.KIND_REACTIVATION and (
                not nest_perms.can_reactivate_nest(request) or nest.status in Nest.OPEN_STATUSES):
            raise PermissionDenied("Seul un administrateur réactive un nid neutralisé, écarté ou abandonné.")
        uploaded = self._uploaded_photos()
        user = self._requester()
        known = {field: values.pop(field) for field in ('nest_type', 'height_class', 'size_class')
                 if values.get(field)}
        basis = values.pop('basis', None)
        details = {**known, **({'basis': basis} if basis else {})}
        action_code = {NestEvent.KIND_VISIT: 'nest.visited', NestEvent.KIND_DESTRUCTION: 'nest.destroyed',
                       NestEvent.KIND_REACTIVATION: 'nest.reactivated'}[kind]
        with audit.track(request, action_code, nest) as tracked:
            event = NestEvent.objects.create(
                nest=nest, kind=kind, performed_at=values.pop('performed_at', None) or timezone.now(),
                performed_by=user, details=details, **{k: v for k, v in values.items() if k != 'kind'},
                # A reactivation tells nobody; the others may (see nest_alerts.py)
                alerted_at=timezone.now() if kind == NestEvent.KIND_REACTIVATION else None,
            )
            if known:
                # What the verification found becomes what is known of the nest
                Nest.objects.filter(pk=nest.pk).update(**known)
            nest.recompute_status()
            self._store_photos(nest, uploaded, user, event=event)
            tracked.extra = {'event': event.pk, 'kind': kind, 'outcome': event.outcome, 'basis': basis or [],
                             'actor': event.actor, 'means': event.means, 'photos': len(uploaded)}
            tracked.refs = [audit.ref('nest_event', event.pk)]
        return Response(self.get_serializer(self._fresh(nest)).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses={200: NestSerializer})
    @action(detail=True, methods=['delete'], url_path=r'events/(?P<event_id>\d+)')
    def delete_event(self, request, pk=None, event_id=None):
        """Remove an entry of the journal (not the report); the status of the nest follows."""
        nest = self._readable(pk)
        event = nest.events.filter(pk=event_id).first()
        if event is None:
            raise NotFound("Entrée du journal introuvable.")
        if not nest_perms.can_delete_event(request, event):
            raise PermissionDenied("Vous ne pouvez pas supprimer cette entrée du journal.")
        with audit.track(request, 'nest.event_deleted', nest) as tracked:
            tracked.extra = {'event': {'id': event.pk, 'kind': event.kind, 'outcome': event.outcome,
                                       'performed_at': audit.json_value(event.performed_at),
                                       'performed_by': audit.json_value(event.performed_by_id),
                                       'actor': event.actor, 'means': event.means, 'comments': event.comments}}
            tracked.refs = [audit.ref('nest_event', event.pk)]
            event.delete()
            nest.recompute_status()
        return Response(self.get_serializer(self._fresh(nest)).data)

    # --- Lists of the module ----------------------------------------------------

    def _season(self, queryset):
        """The season under way (current year, not archived), unless `year`/`archived` say otherwise."""
        return self.apply_archive_year_filters(queryset, self.request)

    def _mine(self, queryset):
        return queryset.filter(owner__guid=getattr(self.request.user, 'guid', None))

    @extend_schema(parameters=[
        OpenApiParameter(name='show', type=OpenApiTypes.STR, enum=['all', 'mine'],
                         description="`all` (those who see every nest) or `mine`"),
        OpenApiParameter(name='status', type=OpenApiTypes.STR,
                         description="Statuses, comma separated (`open` = reported and confirmed)"),
        OpenApiParameter(name='q', type=OpenApiTypes.STR, description="Number, address or comment"),
        OpenApiParameter(name='ordering', type=OpenApiTypes.STR, enum=[*NEST_ORDERINGS]),
        OpenApiParameter(name='page', type=OpenApiTypes.INT),
        OpenApiParameter(name='page_size', type=OpenApiTypes.INT),
    ])
    @action(detail=False, methods=['get'])
    def managed(self, request):
        """The nests of the season as a list to search and filter, paginated."""
        params = request.query_params
        queryset = self._season(self.get_queryset())
        if params.get('show') == 'mine' or not nest_perms.sees_all_nests(request):
            queryset = self._mine(queryset)
        statuses = set()
        for value in (params.get('status') or '').split(','):
            value = value.strip()
            if value == 'open':
                statuses.update(Nest.OPEN_STATUSES)
            elif value in dict(Nest.STATUS_CHOICES):
                statuses.add(value)
        if statuses:
            queryset = queryset.filter(status__in=statuses)
        search = (params.get('q') or '').strip().lstrip('#')
        if search:
            match = Q(address__icontains=search) | Q(comments__icontains=search)
            if search.isdigit():
                match |= Q(pk=int(search))
            queryset = queryset.filter(match)
        ordering = params.get('ordering') if params.get('ordering') in NEST_ORDERINGS else '-created_at'
        queryset = queryset.order_by(ordering, '-id')
        paginator = NestPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        return paginator.get_paginated_response(self.get_serializer(page, many=True).data)

    @extend_schema(responses={200: OpenApiResponse(
        description="Sections of nests waiting for the requester: `to_verify`, `confirmed` (coordinators), "
                    "`near_apiaries` (owners of apiaries, active nests within 1 km), `mine` (own reports)")})
    @action(detail=False, methods=['get'])
    def todo(self, request):
        """What the season holds for the requester, by section; the sections that do not concern them are left out."""
        sections = pending.nest_todo(request, self._season(self.get_queryset()))
        return Response({name: self.get_serializer(queryset[:TODO_SECTION_MAX], many=True).data
                         for name, queryset in sections.items()})

    @extend_schema(
        request={'application/json': {'type': 'object', 'properties': {'owner_guid': {'type': 'string'}}}},
        responses={200: NestSerializer},
    )
    @action(detail=True, methods=['get', 'put'], url_path='owner')
    def owner(self, request, pk=None):
        """
        Hand the follow-up of a nest over to a trapper (a member of `/trappers`):
        a platform admin for any nest, a coordinator of the trappers for one they
        own. The owner is who manages and follows the nest, not a legal owner.

        GET: `owner_guid` and the trappers to choose from (first and last name,
        never an email). PUT: `owner_guid`; the new owner gets a notification.
        """
        nest = self._readable(pk)
        if not nest_perms.can_change_owner(request, nest):
            raise PermissionDenied("Vous ne pouvez pas confier le suivi de ce nid.")
        group = _keycloak(keycloak.get_group_by_path, TRAPPERS_ROOT)
        if group is None:
            raise NotFound("Le groupe des piégeurs n'existe pas.")
        roster = _Roster(TRAPPERS_ROOT, group)
        if request.method == 'GET':
            members = sorted(({'guid': guid, 'name': _full_name(user)} for guid, user in roster.users.items()),
                             key=lambda m: _sort_key(m['name'] or '~'))
            return Response({'owner_guid': str(nest.owner_id) if nest.owner_id else None, 'members': members})

        try:
            guid = uuid.UUID(str(request.data.get('owner_guid') or ''))
        except ValueError:
            raise DRFValidationError({'owner_guid': "Identifiant invalide."})
        if str(guid) not in roster:
            raise DRFValidationError({'owner_guid': "Cette personne n'est pas un piégeur."})
        if guid == nest.owner_id:
            raise DRFValidationError({'owner_guid': "Cette personne suit déjà ce nid."})
        new_owner, _ = User.objects.get_or_create(guid=guid)
        previous = nest.owner_id
        with audit.track(request, 'nest.owner_changed', nest, fields=['owner']) as tracked:
            tracked.refs = [audit.ref('user', who) for who in (previous, new_owner.guid) if who]
            nest.owner = new_owner
            nest.save(update_fields=['owner'])
            nest_alerts.tell_new_owner(nest, new_owner, getattr(request.user, 'guid', None))
        logger.info("Nest %s handed over from %s to %s by %s", nest.pk, previous, new_owner.guid,
                    getattr(request.user, 'guid', None))
        return Response(self.get_serializer(self._fresh(nest)).data)

    def destroy(self, request, *args, **kwargs):
        nest = self.get_object()
        files = [(photo.image, photo.thumbnail) for photo in nest.photos.all()]
        with transaction.atomic():
            changes = {**audit.snapshot(nest), 'photos': len(files)}
            response = super().destroy(request, *args, **kwargs)
            audit.record(request, 'nest.deleted', ('nest', nest.pk), changes=changes,
                         label=audit.label_of(nest))
        for image, thumbnail in files:
            delete_files(image, thumbnail)
        return response

    @extend_schema(request=PHOTOS_REQUEST_SCHEMA, responses={200: NestSerializer})
    @action(detail=True, methods=['post'], url_path='photos')
    def add_photos(self, request, pk=None):
        """Add one or more photos (`photos` files) to a nest."""
        nest = self.get_object()
        if not nest_perms.can_edit_nest(request, nest):
            raise PermissionDenied("You do not have permission to change the photos of this nest.")
        uploaded = self._uploaded_photos()
        if not uploaded:
            raise DRFValidationError({'photos': "No file received."})
        user = User.objects.filter(guid=getattr(request.user, 'guid', None)).first()
        with transaction.atomic():
            self._store_photos(nest, uploaded, user)
            audit.record(request, 'nest.photo_added', nest, changes={'count': len(uploaded)})
        return Response(self.get_serializer(self._fresh(nest)).data)

    @extend_schema(request=None, responses={200: NestSerializer})
    @action(detail=True, methods=['delete'], url_path=r'photos/(?P<photo_id>\d+)')
    def delete_photo(self, request, pk=None, photo_id=None):
        """Remove one photo of a nest."""
        nest = self.get_object()
        if not nest_perms.can_edit_nest(request, nest):
            raise PermissionDenied("You do not have permission to change the photos of this nest.")
        photo = nest.photos.filter(pk=photo_id).first()
        if photo is None:
            return Response({"detail": "Unknown photo."}, status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            audit.record(request, 'nest.photo_removed', nest,
                         changes={'photo': photo.pk, 'uploaded_by': audit.json_value(photo.uploaded_by_id),
                                  'uploaded_at': audit.json_value(photo.created_at)},
                         refs=[audit.ref('nest_photo', photo.pk)])
            photo.delete()
        delete_files(photo.image, photo.thumbnail)
        return Response(self.get_serializer(self._fresh(nest)).data)

    @extend_schema(responses={200: OpenApiResponse(
        description='AFSCA numbers of the apiaries within 1 km, sorted by number: `["9.005.577.599", …]`'
    )})
    @action(detail=True, methods=['get'], url_path='nearby-apiaries')
    def nearby_apiaries(self, request, pk=None):
        """
        The AFSCA numbers of the apiaries within 1 km of the nest, each listed
        once, sorted by number. Neither the distance nor an order by distance
        is given: they would locate the apiaries. Apiaries without a number are
        left out.
        """
        nest = self.get_object()
        if not nest_perms.can_see_nearby_apiaries(request):
            raise PermissionDenied("You do not have permission to see the apiaries near this nest.")
        center = nest.point or Point(nest.longitude, nest.latitude, srid=4326)
        numbers = (
            Apiary.objects.exclude(afsca_number='')
            .filter(point__distance_lte=(center, D(m=nest_perms.NEARBY_APIARY_RADIUS_M)))
            .order_by('afsca_number')
            .values_list('afsca_number', flat=True)
            .distinct()
        )
        return Response(list(numbers))
