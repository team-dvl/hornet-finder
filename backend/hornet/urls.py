from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HornetViewSet, NestViewSet, ApiaryViewSet


router = DefaultRouter()
router.register(r'hornets', HornetViewSet, basename='hornet')
router.register(r'nests', NestViewSet, basename='nest')
router.register(r'apiaries', ApiaryViewSet, basename='apiary')

urlpatterns = [
    path('', include(router.urls)),
]