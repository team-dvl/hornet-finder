from django.core.management.base import BaseCommand
from django.utils.dateparse import parse_datetime

from hornet import reminders


class Command(BaseCommand):
    help = ("Send the trap reminders due now (one pass of the scheduler). Safe to run again: "
            "nothing already sent today goes out twice.")

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help="Show what would be sent, send nothing")
        parser.add_argument('--now', help="Pretend it is this local date-time (ISO 8601), for tests")

    def handle(self, *args, **options):
        now = parse_datetime(options['now']) if options['now'] else None
        if options['now'] and now is None:
            self.stderr.write("--now: expected an ISO 8601 date-time")
            return
        result = reminders.run(now=now, dry_run=options['dry_run'])
        if 'skipped' in result:
            self.stdout.write(f"Skipped: {result['skipped']}")
            return
        for title, body in result['messages']:
            self.stdout.write(f"{title} — {body}")
        verb = "would be sent" if options['dry_run'] else "sent"
        self.stdout.write(f"{result['notifications']} notification(s) {verb} to {result['owners']} owner(s)")
