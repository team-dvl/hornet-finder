from django.contrib.gis.measure import D
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance

from rest_framework import viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from .models import Hornet, Nest, Apiary
from .serializers import HornetSerializer, NestSerializer, ApiarySerializer
from hornet_finder_api.authentication import JWTBearerAuthentication, HasAnyRole


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
    def my(self, request): # There will be a crash without authentication
        queryset = Hornet.objects.filter(created_by=request.user.username)
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
    
    def perform_create(self, serializer): # This method is called when a new Hornet is created
        # If the user is authenticated, we save the username as created_by, otherwise we save with None in order to avoid users who set the created_by field to an another user
        # We set linked_nest to None because a nest must be linked to a hornet by editing the hornet after it is created, by an admin
        if self.request.user and self.request.user.is_authenticated:
            serializer.save(created_by=self.request.user.username, linked_nest=None)
        else:
            serializer.save(created_by=None, linked_nest=None)

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

    # Volunteers, beekeepers and admins can create and list nests, but only admins can retrieve, update, partial_update and destroy them
    def get_authenticators(self):
        # Require authentication for all nest operations
        return [JWTBearerAuthentication()]
    
    def get_permissions(self):
        if hasattr(self, 'action') and self.action in ['list', 'create']:
            return [HasAnyRole(['volunteer', 'beekeeper', 'admin'])]
        return [HasAnyRole(['admin'])]
    
    def perform_create(self, serializer):
        # Save the username of the user who created the nest
        serializer.save(created_by=self.request.user.username)

class ApiaryViewSet(GeographicFilterMixin, viewsets.ModelViewSet):
    queryset = Apiary.objects.all()
    serializer_class = ApiarySerializer

    @geographic_list_schema() # The permissions and authentication for this action are handled in the get_authenticators and get_permissions methods
    def list(self, request, *args, **kwargs):
        queryset, error_response = self.get_geographic_queryset(request)
        if error_response:
            return error_response
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @extend_schema(
        responses={200: ApiarySerializer(many=True)},
    )
    @action(detail=False, methods=['get'])
    def my(self, request): # There will be a crash without authentication
        queryset = Apiary.objects.filter(created_by=request.user.username)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    # A beekeeper can create apiaries, but only admins can list, retrieve, update, partial_update and destroy them
    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        if hasattr(self, 'action') and self.action in ('create', 'my'):
            return [HasAnyRole(['beekeeper', 'admin'])]
        return [HasAnyRole(['admin'])]

    def perform_create(self, serializer): # This method is called when a new Apiary is created
        serializer.save(created_by=self.request.user.username) # This will save the username of the user who created the apiary
