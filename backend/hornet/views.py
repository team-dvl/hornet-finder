from django.contrib.gis.measure import D
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance

from rest_framework import viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from .models import Hornet, Nest, Apiary
from .serializers import HornetSerializer, NestSerializer, ApiarySerializer
from hornet_finder_api.authentication import JWTBearerAuthentication, HasAnyRole


class HornetViewSet(viewsets.ModelViewSet):
    queryset = Hornet.objects.all()
    serializer_class = HornetSerializer

    @extend_schema(
        responses={200: HornetSerializer(many=True)},
    )
    @action(detail=False, methods=['get'])
    @authentication_classes([JWTBearerAuthentication]) # Enforce JWT authentication for this action
    @permission_classes([HasAnyRole(['volunteer', 'beekeeper', 'admin'])]) # Enforce role-based permission for this action
    def my(self, request): # There will be a crash if this action is not decorated with @authentication_classes
        queryset = Hornet.objects.filter(created_by=request.user.username)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    # No need permission to create a hornet, but only beekeepers and admins can list, and only admins can retrieve, update, partial_update and destroy them
    def get_authenticators(self): # This method is used here because we can not use the @authentication_classes decorator on the herited actions
        # list, create, retrieve, update, partial_update, destroy are the names of the actions that are automatically created by the ModelViewSet
        # Each action corresponds to a method in the viewset, e.g. list corresponds to the GET /hornets/ endpoint.
        # if hasattr(self, 'action') and self.action in ['list', 'retrieve', 'update', 'partial_update', 'destroy']:
        # Allow public access to list action (viewing hornets)
        if hasattr(self, 'action') and self.action in ['retrieve', 'update', 'partial_update', 'destroy']:
            return [JWTBearerAuthentication()]
        return super().get_authenticators()

    def get_permissions(self): # This method is used here because we can not use the @permission_classes decorator on the herited actions
        # Allow public access to list action (viewing hornets)
        if hasattr(self, 'action') and self.action == 'list':
            return []  # No permission required for public access
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

class NestViewSet(viewsets.ModelViewSet):
    queryset = Nest.objects.all()
    serializer_class = NestSerializer

    # Only admins can interact with nests
    # def get_authenticators(self):
    #     return [JWTBearerAuthentication()]
    
    # def get_permissions(self):
    #     return [HasAnyRole(['admin'])]

class ApiaryViewSet(viewsets.ModelViewSet):
    queryset = Apiary.objects.all()
    serializer_class = ApiarySerializer

    @extend_schema(
        responses={200: ApiarySerializer(many=True)},
    )
    @action(detail=False, methods=['get'])
    @authentication_classes([JWTBearerAuthentication]) # Enforce JWT authentication for this action
    @permission_classes([HasAnyRole(['beekeeper', 'admin'])])
    def my(self, request): # There will be a crash if this action is not decorated with @authentication_classes
        queryset = Apiary.objects.filter(created_by=request.user.username)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    # A beekeeper can create apiaries, but only admins can list, retrieve, update, partial_update and destroy them
    # def get_authenticators(self):
    #     return [JWTBearerAuthentication()]

    # def get_permissions(self):
    #     if hasattr(self, 'action') and self.action == 'create':
    #         return [HasAnyRole(['beekeeper', 'admin'])]
    #     return [HasAnyRole(['admin'])]

    # def perform_create(self, serializer): # This method is called when a new Apiary is created
    #     serializer.save(created_by=self.request.user.username) # This will save the username of the user who created the apiary

@extend_schema(
    parameters=[
        OpenApiParameter(name='lat', type=OpenApiTypes.FLOAT, location=OpenApiParameter.QUERY, description='Latitude of the center point'),
        OpenApiParameter(name='lon', type=OpenApiTypes.FLOAT, location=OpenApiParameter.QUERY, description='Longitude of the center point'),
        OpenApiParameter(name='radius', type=OpenApiTypes.FLOAT, location=OpenApiParameter.QUERY, description='Radius in kilometers (default is 1 km)', required=False, default=1),
    ],
    responses={200: OpenApiResponse(
        description="Summary response",
        response={
            "type": "object",
            "properties": {
                "hornet_count": {"type": "integer"},
                "nest_count": {"type": "integer"},
            }
        }
    )},
)
@api_view(['GET'])
# @authentication_classes([JWTBearerAuthentication])
# @permission_classes([HasAnyRole(['volunteer', 'beekeeper', 'admin'])])
def summary(request):
    lat = float(request.query_params.get('lat'))
    lon = float(request.query_params.get('lon'))
    radius = float(request.query_params.get('radius', 1))  # km

    center = Point(lon, lat, srid=4326)

    hornet_count = Hornet.objects.annotate(distance=Distance('point', center)).filter(distance__lte=D(km=radius)).count()
    nest_count = Nest.objects.annotate(distance=Distance('point', center)).filter(distance__lte=D(km=radius)).count()

    return Response({
        "hornet_count": hornet_count,
        "nest_count": nest_count,
    })
