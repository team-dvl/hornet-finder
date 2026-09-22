from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .media_views import media_view
from .views import HornetViewSet, NestViewSet, ApiaryViewSet
from .trap_views import (
    SpeciesViewSet, TrapEventViewSet, TrapPhotoViewSet, TrapTypeViewSet, TrapViewSet,
)


router = DefaultRouter()
router.register(r'hornets', HornetViewSet, basename='hornet')
router.register(r'nests', NestViewSet, basename='nest')
router.register(r'apiaries', ApiaryViewSet, basename='apiary')
router.register(r'traps', TrapViewSet, basename='trap')
router.register(r'trap-types', TrapTypeViewSet, basename='traptype')
router.register(r'trap-events', TrapEventViewSet, basename='trapevent')
router.register(r'trap-photos', TrapPhotoViewSet, basename='trapphoto')
router.register(r'species', SpeciesViewSet, basename='species')

urlpatterns = [
    path('media/<path:path>', media_view, name='media'),
    path('', include(router.urls)),
]
