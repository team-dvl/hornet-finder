from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .colony_views import ColonyViewSet
from .views import HiveTypeViewSet, HiveViewSet

router = DefaultRouter()
router.register(r'hives', HiveViewSet, basename='hive')
router.register(r'hive-types', HiveTypeViewSet, basename='hivetype')
router.register(r'colonies', ColonyViewSet, basename='colony')

urlpatterns = [
    path('', include(router.urls)),
]
