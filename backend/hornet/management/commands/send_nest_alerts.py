from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from hornet import nest_alerts, nest_season


class Command(BaseCommand):
    help = ("Send the pending notifications about nests (one pass of the scheduler), and mark abandoned the "
            "nests whose season is over. Safe to run again: nothing goes out twice.")

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help="Show what would be done, do nothing")
        parser.add_argument('--now', help="Pretend it is this local date-time (ISO 8601), for tests")

    def handle(self, *args, **options):
        now = parse_datetime(options['now']) if options['now'] else None
        if options['now'] and now is None:
            self.stderr.write("--now: expected an ISO 8601 date-time")
            return
        if now is not None and timezone.is_naive(now):
            now = timezone.make_aware(now)
        season = nest_season.run(now=now, dry_run=options['dry_run'])
        verb = "would be" if options['dry_run'] else "were"
        self.stdout.write(f"{season['abandoned']} nest(s) of a past season {verb} marked abandoned, "
                          f"{season['phones_erased']} phone number(s) {verb} erased")
        result = nest_alerts.run(now=now, dry_run=options['dry_run'])
        if 'skipped' in result:
            self.stdout.write(f"Notifications skipped: {result['skipped']}")
            return
        for title, body in result['messages']:
            self.stdout.write(f"{title} — {body}")
        verb = "would be sent" if options['dry_run'] else "sent"
        self.stdout.write(f"{result['notifications']} notification(s) {verb} to {result['people']} people")
