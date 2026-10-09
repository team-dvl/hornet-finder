from django.conf import settings
from django.core.management.base import BaseCommand

from audit.recorder import purge_expired


class Command(BaseCommand):
    help = ("Delete the audit events older than AUDIT_RETENTION_DAYS. The API already "
            "does it at most once a day; this runs it now.")

    def handle(self, *args, **options):
        deleted = purge_expired()
        self.stdout.write(f"{deleted} event(s) older than {settings.AUDIT_RETENTION_DAYS} days deleted.")
