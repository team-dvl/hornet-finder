from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HornetViewSet, NestViewSet


router = DefaultRouter()
router.register(r'hornets', HornetViewSet)
router.register(r'nests', NestViewSet)

urlpatterns = [
    path('', include(router.urls)),
]