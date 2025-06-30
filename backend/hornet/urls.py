from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HornetViewSet, NestViewSet, ApiaryViewSet


router = DefaultRouter()
router.register(r'hornets', HornetViewSet)
router.register(r'nests', NestViewSet)
router.register(r'apiaries', ApiaryViewSet)

urlpatterns = [
    path('', include(router.urls)),
]