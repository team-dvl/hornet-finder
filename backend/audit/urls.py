from rest_framework.routers import SimpleRouter

from .views import AuditEventViewSet

router = SimpleRouter()
router.register(r'events', AuditEventViewSet, basename='audit-event')

urlpatterns = router.urls
