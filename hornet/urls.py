from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HornetViewSet


router = DefaultRouter()
router.register(r'hornets', HornetViewSet)

urlpatterns = [
    path('', include(router.urls)),
]