from rest_framework import viewsets
from .models import Hornet, Nest, Apiary
from .serializers import HornetSerializer, NestSerializer, ApiarySerializer


class HornetViewSet(viewsets.ModelViewSet):
    queryset = Hornet.objects.all()
    serializer_class = HornetSerializer

class NestViewSet(viewsets.ModelViewSet):
    queryset = Nest.objects.all()
    serializer_class = NestSerializer

class ApiaryViewSet(viewsets.ModelViewSet):
    queryset = Apiary.objects.all()
    serializer_class = ApiarySerializer
