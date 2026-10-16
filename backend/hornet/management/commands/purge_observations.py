from django.conf import settings
from django.core.management.base import BaseCommand

from hornet import retention


class Command(BaseCommand):
    help = ("Delete the archived hornets and nests reported more than OBSERVATIONS_RETENTION_DAYS "
            "ago. The scheduler already does it at each pass.")

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help="Count what would be deleted, delete nothing")

    def handle(self, *args, **options):
        result = retention.purge_archived(dry_run=options['dry_run'])
        verb = "would be deleted" if options['dry_run'] else "deleted"
        self.stdout.write(
            f"{result['hornets']} archived hornet(s) and {result['nests']} archived nest(s) reported more "
            f"than {settings.OBSERVATIONS_RETENTION_DAYS} days ago {verb}.")
