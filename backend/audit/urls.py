from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import AuditEventViewSet, export_file

router = SimpleRouter()
router.register(r'events', AuditEventViewSet, basename='audit-event')

urlpatterns = [
    path('export/<str:token>/', export_file, name='audit-export-file'),
] + router.urls
