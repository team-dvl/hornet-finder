from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .media_views import media_view
from .stats.views import StatDetailView, StatExportLinkView, StatsCatalogueView, stat_export_file
from .profile_views import my_avatar
from .apiary_views import ApiaryViewSet
from .views import HornetViewSet, NestViewSet
from .tag_views import TagAdminViewSet, TagViewSet, sheet_pdf
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
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'admin/tags', TagAdminViewSet, basename='tagadmin')

urlpatterns = [
    path('media/<path:path>', media_view, name='media'),
    path('me/avatar/', my_avatar, name='my-avatar'),
    # Before the router, so `sheet` is not read as a tag value
    path('tags/sheet/<str:token>/', sheet_pdf, name='tag-sheet-pdf'),
    path('stats/', StatsCatalogueView.as_view(), name='stats-catalogue'),
    path('stats/export/<str:token>/', stat_export_file, name='stats-export-file'),
    path('stats/<slug:stat_id>/', StatDetailView.as_view(), name='stats-detail'),
    path('stats/<slug:stat_id>/export/', StatExportLinkView.as_view(), name='stats-export-link'),
    path('', include(router.urls)),
]
