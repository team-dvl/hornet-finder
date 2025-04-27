from rest_framework import viewsets
from .models import Hornet
from .serializers import HornetSerializer


class HornetViewSet(viewsets.ModelViewSet):
    queryset = Hornet.objects.all()
    serializer_class = HornetSerializer
