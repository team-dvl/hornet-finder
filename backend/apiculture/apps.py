from django.apps import AppConfig


class ApicultureConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apiculture'

    def ready(self):
        # The photos of visits and hives are served by the media view of `hornet`
        from hornet.media_views import MEDIA_RESOLVERS
        from .views import can_read_hive_file
        from .visit_views import can_read_visit_file
        MEDIA_RESOLVERS['visits/'] = can_read_visit_file
        MEDIA_RESOLVERS['hives/'] = can_read_hive_file
        # The planned visits: their reminder kind, the counter of the module, the scheduled job
        from .planning import register
        register()
