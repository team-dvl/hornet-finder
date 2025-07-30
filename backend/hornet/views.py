from django.contrib.gis.measure import D
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance

from rest_framework import viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from .models import Hornet, Nest, Apiary, User, ApiaryGroupPermission, BeekeeperGroup
from .serializers import HornetSerializer, NestSerializer, PublicNestSerializer, ApiarySerializer
from hornet_finder_api.authentication import JWTBearerAuthentication, HasAnyRole
from rest_framework import status
from rest_framework.exceptions import PermissionDenied


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


class HornetViewSet(GeographicFilterMixin, viewsets.ModelViewSet):
    queryset = Hornet.objects.all()
    serializer_class = HornetSerializer

    @geographic_list_schema() # The permissions and authentication for this action are handled in the get_authenticators and get_permissions methods
    def list(self, request, *args, **kwargs):
        queryset, error_response = self.get_geographic_queryset(request)
        if error_response:
            return error_response
        
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
        if hasattr(self, 'action') and self.action in ['retrieve', 'create', 'update', 'partial_update', 'destroy', 'my']:
            return [JWTBearerAuthentication()]
        return super().get_authenticators()

    def get_permissions(self): # This method is used here because we can not use the @permission_classes decorator on the herited actions
        # Allow public access to list action (viewing hornets)
        if hasattr(self, 'action') and self.action in ('create', 'my'):
            return [HasAnyRole(['volunteer', 'beekeeper', 'admin'])]
        elif hasattr(self, 'action') and self.action in ['retrieve', 'update', 'partial_update', 'destroy']:
            return [HasAnyRole(['admin'])]
        return super().get_permissions()
    
    def perform_create(self, serializer):
        user_guid = getattr(self.request.user, 'guid', None)
        user_obj = User.objects.filter(guid=user_guid).first()
        serializer.save(created_by=user_obj, linked_nest=None)

class NestViewSet(GeographicFilterMixin, viewsets.ModelViewSet):
    queryset = Nest.objects.all()
    serializer_class = NestSerializer

    @geographic_list_schema() # The permissions and authentication for this action are handled in the get_authenticators and get_permissions methods
    def list(self, request, *args, **kwargs):
        queryset, error_response = self.get_geographic_queryset(request)
        if error_response:
            return error_response
        
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
        
        # Use public serializer to exclude sensitive information like created_by
        serializer = PublicNestSerializer(queryset, many=True)
        return Response(serializer.data)

    # Volunteers, beekeepers and admins can create and list nests, but only admins can retrieve, update, partial_update and destroy them
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
        if hasattr(self, 'action') and self.action in ['list', 'create']:
            return [HasAnyRole(['volunteer', 'beekeeper', 'admin'])]
        return [HasAnyRole(['admin'])]
    
    def perform_create(self, serializer):
        user_guid = getattr(self.request.user, 'guid', None)
        user_obj = User.objects.filter(guid=user_guid).first()
        serializer.save(created_by=user_obj)

class ApiaryViewSet(GeographicFilterMixin, viewsets.ModelViewSet):
    queryset = Apiary.objects.all()
    serializer_class = ApiarySerializer

    def _get_membership_paths(self, request):
        """Extracts the list of group paths from the JWT token (scope 'membership')."""
        token_info = getattr(request.user, 'token_info', None)
        if not token_info:
            return []
        return token_info.get('membership', [])

    def _has_apiary_permission(self, request, apiary, perm_type):
        """
        Checks if the user has the required permission (read/update/delete) on the apiary.
        perm_type: 'read', 'update', 'delete'
        """
        user = request.user
        debug_info = {
            'user_guid': getattr(user, 'guid', None),
            'user_roles': getattr(user, 'roles', []),
            'perm_type': perm_type,
            'apiary_id': apiary.id,
        }
        # Admin: always allowed
        if 'admin' in getattr(user, 'roles', []):
            print(f"[DEBUG] Admin access granted: {debug_info}")
            return True
        # Owner: always allowed
        user_guid = getattr(user, 'guid', None)
        if apiary.created_by and str(apiary.created_by.guid) == str(user_guid):
            print(f"[DEBUG] Owner access granted: {debug_info}")
            return True
        # Group-based permissions
        membership_paths = self._get_membership_paths(request)
        debug_info['membership_paths'] = membership_paths
        if not membership_paths:
            print(f"[DEBUG] No membership, access denied: {debug_info}")
            return False
        # Find matching groups in DB
        groups = BeekeeperGroup.objects.filter(path__in=membership_paths)
        debug_info['matching_groups'] = list(groups.values_list('path', flat=True))
        perms = ApiaryGroupPermission.objects.filter(apiary=apiary, group__in=groups)
        debug_info['matching_perms'] = list(perms.values('group__path', 'can_read', 'can_update', 'can_delete'))
        if perm_type == 'read':
            allowed = perms.filter(can_read=True).exists()
        elif perm_type == 'update':
            allowed = perms.filter(can_update=True).exists()
        elif perm_type == 'delete':
            allowed = perms.filter(can_delete=True).exists()
        else:
            allowed = False
        print(f"[DEBUG] Group-based access {'granted' if allowed else 'denied'}: {debug_info}")
        return allowed

    @geographic_list_schema() # The permissions and authentication for this action are handled in the get_authenticators and get_permissions methods
    def list(self, request, *args, **kwargs):
        user = request.user
        print(f"[DEBUG] USER: {request.user}")
        print(f"[DEBUG] Apiary list requested by user: guid={getattr(user, 'guid', None)}, roles={getattr(user, 'roles', [])}")
        # Admin: accès à tout
        if 'admin' in getattr(user, 'roles', []):
            queryset, error_response = self.get_geographic_queryset(request)
            if error_response:
                print(f"[DEBUG] Error in geo filter: {error_response.data}")
                return error_response
        else:
            user_guid = getattr(user, 'guid', None)
            membership_paths = self._get_membership_paths(request)
            print(f"[DEBUG] membership_paths: {membership_paths}")
            # Propriétaire
            q_owner = Apiary.objects.filter(created_by__guid=user_guid)
            # Groupes avec can_read
            groups = BeekeeperGroup.objects.filter(path__in=membership_paths)
            print(f"[DEBUG] matching_groups: {list(groups.values_list('path', flat=True))}")
            apiary_ids = ApiaryGroupPermission.objects.filter(
                group__in=groups, can_read=True
            ).values_list('apiary_id', flat=True)
            print(f"[DEBUG] apiary_ids with can_read: {list(apiary_ids)}")
            q_group = Apiary.objects.filter(id__in=apiary_ids)
            queryset = (q_owner | q_group).distinct()
            # Appliquer le filtre géographique si demandé
            center = None
            lat = request.query_params.get('lat')
            lon = request.query_params.get('lon')
            radius = request.query_params.get('radius', 5)
            if lat and lon:
                try:
                    lat = float(lat)
                    lon = float(lon)
                    radius = float(radius)
                    from django.contrib.gis.geos import Point
                    from django.contrib.gis.db.models.functions import Distance
                    from django.contrib.gis.measure import D
                    center = Point(lon, lat, srid=4326)
                    queryset = queryset.annotate(distance=Distance('point', center)).filter(distance__lte=D(km=radius))
                except Exception:
                    print(f"[DEBUG] Invalid geo params: lat={lat}, lon={lon}, radius={radius}")
                    return Response({"error": "lat, lon and radius must be valid numbers"}, status=400)
        print(f"[DEBUG] Apiary list count: {queryset.count()}")
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        # POST (create): admin or beekeeper
        if hasattr(self, 'action') and self.action == 'create':
            return [HasAnyRole(['beekeeper', 'admin'])]
        # PATCH/PUT/DELETE/GET (retrieve/list): admin or beekeeper
        if hasattr(self, 'action') and self.action in ['update', 'partial_update', 'destroy', 'retrieve', 'list']:
            return [HasAnyRole(['beekeeper', 'admin'])]
        # fallback: admin only
        return [HasAnyRole(['admin'])]

    def perform_create(self, serializer):
        user_guid = getattr(self.request.user, 'guid', None)
        user_obj = User.objects.filter(guid=user_guid).first()
        serializer.save(created_by=user_obj)

    def retrieve(self, request, *args, **kwargs):
        apiary = self.get_object()
        if not self._has_apiary_permission(request, apiary, 'read'):
            raise PermissionDenied("You do not have permission to view this apiary.")
        return super().retrieve(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        apiary = self.get_object()
        if not self._has_apiary_permission(request, apiary, 'update'):
            raise PermissionDenied("You do not have permission to update this apiary.")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        apiary = self.get_object()
        if not self._has_apiary_permission(request, apiary, 'update'):
            raise PermissionDenied("You do not have permission to update this apiary.")
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        apiary = self.get_object()
        if not self._has_apiary_permission(request, apiary, 'delete'):
            raise PermissionDenied("You do not have permission to delete this apiary.")
        return super().destroy(request, *args, **kwargs)
