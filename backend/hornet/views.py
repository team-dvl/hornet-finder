from django.contrib.gis.measure import D
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.utils import timezone

from django.db import transaction

from rest_framework import viewsets
from rest_framework.decorators import action, api_view
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from . import nest_permissions as nest_perms
from .images import delete_files, store_photo
from .models import Apiary, Hornet, Nest, NestPhoto, User
from .stats.periods import PeriodError, resolve_archive_period
from .serializers import HornetSerializer, NestSerializer, PublicNestSerializer
from hornet_finder_api.authentication import JWTBearerAuthentication, HasAnyRole
from hornet_finder_api.roles import ADMIN, APP_ROLES, BEEKEEPER, HUNTER
from rest_framework import status


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
        obj.archived = True
        obj.archived_at = timezone.now()
        obj.save()
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
        updated_count = queryset.update(archived=True, archived_at=timezone.now())
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
        serializer = self.get_serializer(queryset, many=True)
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

    # No need permission to create a hornet, but only beekeepers and admins can list, and only admins can retrieve, update, partial_update and destroy them
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
        # Sightings and releases are the work of nest hunters, and of beekeepers at their hives
        if hasattr(self, 'action') and self.action in ('create', 'my'):
            return [HasAnyRole([HUNTER, BEEKEEPER, ADMIN])]
        elif hasattr(self, 'action') and self.action in ['retrieve', 'update', 'partial_update', 'destroy', 'archive', 'archive_candidates', 'bulk_archive']:
            return [HasAnyRole(['admin'])]
        return super().get_permissions()
    
    def perform_create(self, serializer):
        user_guid = getattr(self.request.user, 'guid', None)
        user_obj = User.objects.filter(guid=user_guid).first()
        serializer.save(created_by=user_obj, linked_nest=None)

# Photos accepted in one request (creation or addition)
MAX_NEST_PHOTOS_PER_REQUEST = 10

PHOTOS_REQUEST_SCHEMA = {
    'multipart/form-data': {
        'type': 'object',
        'properties': {'photos': {'type': 'array', 'items': {'type': 'string', 'format': 'binary'}}},
    },
}


class NestViewSet(ArchiveFilterMixin, GeographicFilterMixin, viewsets.ModelViewSet):
    queryset = Nest.objects.select_related('created_by').prefetch_related('photos')
    serializer_class = NestSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

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
        """The nests the requester reported, with the filters of `list`: what a trapper sees besides the destroyed ones."""
        queryset, error_response = self.get_geographic_queryset(request)
        if error_response:
            return error_response
        queryset = queryset.filter(created_by__guid=getattr(request.user, 'guid', None))
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

    def _store_photos(self, nest, uploaded, user):
        """Store the photos of a nest. Files already written are removed if one is rejected."""
        stored = []
        try:
            for upload in uploaded:
                photo = NestPhoto(nest=nest, uploaded_by=user)
                store_photo(photo, 'image', 'thumbnail', upload)
                stored.append(photo)
                photo.save()
        except Exception:
            for photo in stored:
                delete_files(photo.image, photo.thumbnail)
            raise

    def _fresh(self, nest):
        """The nest reloaded with its photos, for the response."""
        return self.get_queryset().get(pk=nest.pk)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded = self._uploaded_photos()
        user = User.objects.filter(guid=getattr(request.user, 'guid', None)).first()
        with transaction.atomic():
            nest = serializer.save(created_by=user)
            self._store_photos(nest, uploaded, user)
        return Response(self.get_serializer(self._fresh(nest)).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        nest = self.get_object()
        if not nest_perms.can_edit_nest(request, nest):
            raise PermissionDenied("You do not have permission to update this nest.")
        response = super().update(request, *args, **kwargs)
        # Photos are managed through their own actions, the response shows them all
        response.data = self.get_serializer(self._fresh(nest)).data
        return response

    def destroy(self, request, *args, **kwargs):
        nest = self.get_object()
        files = [(photo.image, photo.thumbnail) for photo in nest.photos.all()]
        response = super().destroy(request, *args, **kwargs)
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
        delete_files(photo.image, photo.thumbnail)
        photo.delete()
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
