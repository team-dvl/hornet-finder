from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import HiveTypeViewSet, HiveViewSet

router = DefaultRouter()
router.register(r'hives', HiveViewSet, basename='hive')
router.register(r'hive-types', HiveTypeViewSet, basename='hivetype')

urlpatterns = [
    path('', include(router.urls)),
]
