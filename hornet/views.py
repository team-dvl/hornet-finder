from rest_framework import viewsets
from .models import Hornet, Nest
from .serializers import HornetSerializer, NestSerializer


class HornetViewSet(viewsets.ModelViewSet):
    queryset = Hornet.objects.all()
    serializer_class = HornetSerializer

class NestViewSet(viewsets.ModelViewSet):
    queryset = Nest.objects.all()
    serializer_class = NestSerializer
