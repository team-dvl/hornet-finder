from django.conf import settings
from django.core.management.base import BaseCommand

from hornet import push


class Command(BaseCommand):
    help = ("Delete the notifications older than PUSH_HISTORY_DAYS and the devices unused for "
            "PUSH_DEVICE_IDLE_DAYS. The scheduler already does it at each pass.")

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help="Count what would be deleted, delete nothing")

    def handle(self, *args, **options):
        result = push.purge_expired(dry_run=options['dry_run'])
        verb = "would be deleted" if options['dry_run'] else "deleted"
        self.stdout.write(
            f"{result['notifications']} notification(s) older than {settings.PUSH_HISTORY_DAYS} days "
            f"({result['deliveries']} delivery record(s)), {result['devices']} device(s) unused for "
            f"{settings.PUSH_DEVICE_IDLE_DAYS} days {verb}.")
