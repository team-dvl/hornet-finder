from django.core.management.base import BaseCommand
from django.utils.dateparse import parse_datetime

from apiculture import planning


class Command(BaseCommand):
    help = ("Send the reminders of the planned visits due now (one pass of the scheduler). Safe to run "
            "again: a visit is reminded once.")

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help="Show what would be sent, send nothing")
        parser.add_argument('--now', help="Pretend it is this local date-time (ISO 8601), for tests")

    def handle(self, *args, **options):
        now = parse_datetime(options['now']) if options['now'] else None
        if options['now'] and now is None:
            self.stderr.write("--now: expected an ISO 8601 date-time")
            return
        result = planning.run(now=now, dry_run=options['dry_run'])
        if 'skipped' in result:
            self.stdout.write(f"Skipped: {result['skipped']}")
            return
        for title, body in result['messages']:
            self.stdout.write(f"{title} — {body}")
        verb = "would be sent" if options['dry_run'] else "sent"
        self.stdout.write(f"{result['notifications']} notification(s) {verb}")
