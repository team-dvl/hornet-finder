from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .media_views import media_view
from .stats.views import (
    StatDetailView, StatEmailLinkView, StatExportLinkView, StatsCatalogueView, stat_export_file,
    stat_export_job, stat_export_job_file,
)
from .profile_views import my_avatar
from .apiary_views import ApiaryViewSet
from .invitation_views import GroupInvitationViewSet, MyGroupInvitationViewSet
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
router.register(r'group-invitations', GroupInvitationViewSet, basename='group-invitation')
router.register(r'me/group-invitations', MyGroupInvitationViewSet, basename='my-group-invitation')

urlpatterns = [
    path('media/<path:path>', media_view, name='media'),
    path('me/avatar/', my_avatar, name='my-avatar'),
    # Before the router, so `sheet` is not read as a tag value
    path('tags/sheet/<str:token>/', sheet_pdf, name='tag-sheet-pdf'),
    path('stats/', StatsCatalogueView.as_view(), name='stats-catalogue'),
    path('stats/export/<str:token>/', stat_export_file, name='stats-export-file'),
    path('stats/exports/<str:token>/', stat_export_job, name='stats-job'),
    path('stats/exports/<str:token>/<str:fmt>/', stat_export_job_file, name='stats-job-file'),
    path('stats/<slug:stat_id>/', StatDetailView.as_view(), name='stats-detail'),
    path('stats/<slug:stat_id>/export/', StatExportLinkView.as_view(), name='stats-export-link'),
    path('stats/<slug:stat_id>/email-link/', StatEmailLinkView.as_view(), name='stats-email-link'),
    path('', include(router.urls)),
]
