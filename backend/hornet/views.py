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


class HornetViewSet(viewsets.ModelViewSet):
    queryset = Hornet.objects.all()
    serializer_class = HornetSerializer

    @extend_schema(
        responses={200: HornetSerializer(many=True)},
    )
    @action(detail=False, methods=['get'])
    # @authentication_classes([JWTBearerAuthentication])
    # @permission_classes([HasAnyRole.with_roles(['volunteer'])])
    def my(self, request):
        queryset = Hornet.objects.filter(created_by=request.user.username)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def get_authenticators(self):
        if hasattr(self, 'action') and self.action == 'list':  # GET /hornet/
            return [JWTBearerAuthentication()]
        return super().get_authenticators()

    def get_permissions(self):
        if hasattr(self, 'action') and self.action == 'list':
            return [HasAnyRole(['volunteer'])]
        return super().get_permissions()

class NestViewSet(viewsets.ModelViewSet):
    queryset = Nest.objects.all()
    serializer_class = NestSerializer

class ApiaryViewSet(viewsets.ModelViewSet):
    queryset = Apiary.objects.all()
    serializer_class = ApiarySerializer

    @extend_schema(
        responses={200: ApiarySerializer(many=True)},
    )
    @action(detail=False, methods=['get'])
    def my(self, request):
        queryset = Apiary.objects.filter(created_by=request.user.username)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

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
