import logging
import signal
import threading

from django.core.management.base import BaseCommand
from django.db import DatabaseError, connection
from django.utils import timezone

from hornet import nest_alerts, nest_season, push, reminders, retention
from hornet.models import PlatformSettings

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = ("Run the periodic jobs forever (the scheduler service of the compose files): the trap "
            "reminders, the notifications about nests, the end of the nest season and the retention "
            "of the notifications and of the archived observations, every --every seconds.")

    def add_arguments(self, parser):
        parser.add_argument('--every', type=int, default=600, help="Seconds between two passes (600)")

    def handle(self, *args, **options):
        every = max(60, options['every'])
        logger.info("Scheduler started, a pass every %s s", every)
        # As PID 1 the process has no default SIGTERM action: without a handler Docker waits
        # its grace period (10 s) then sends SIGKILL. Stop between two jobs, not in the middle.
        stop = threading.Event()
        for sig in (signal.SIGTERM, signal.SIGINT):
            signal.signal(sig, lambda *_: stop.set())
        while not stop.is_set():
            # Each job on its own: one failing does not hold back the others
            for name, job in (('reminders', self.send_reminders), ('nest season', nest_season.run),
                              ('nest alerts', self.send_nest_alerts), ('push retention', push.purge_expired),
                              ('observations retention', retention.purge_archived)):
                try:
                    job()
                except DatabaseError as exc:
                    # Typically the API has not applied its migrations yet: try again later
                    logger.warning("Scheduler job %s skipped, database not ready: %s", name, exc)
                except Exception:
                    logger.exception("Scheduler job %s failed", name)
                finally:
                    connection.close()
                if stop.is_set():
                    break
            self.stamp()
            stop.wait(every)
        logger.info("Scheduler stopped")

    @staticmethod
    def stamp():
        """Tell the platform dashboard the scheduler is alive."""
        try:
            PlatformSettings.load()
            PlatformSettings.objects.filter(pk=1).update(scheduler_seen_at=timezone.now())
        except DatabaseError as exc:
            logger.warning("Scheduler heartbeat skipped, database not ready: %s", exc)
        finally:
            connection.close()

    @staticmethod
    def send_reminders():
        result = reminders.run()
        if result.get('notifications'):
            logger.info("Reminders: %s", result)

    @staticmethod
    def send_nest_alerts():
        result = nest_alerts.run()
        if result.get('notifications'):
            logger.info("Nest alerts: %s", result)
