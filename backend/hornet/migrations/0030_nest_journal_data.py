"""
Give every existing nest the journal it would have had: its report, its
destruction if it was destroyed, and the end of its season when it was left
untreated past the winter that followed it (1 March). These events notify
nobody (`alerted_at` set).
"""

import datetime

from django.db import migrations
from django.utils import timezone

# Same rule as hornet/nest_season.py, frozen here: a migration does not follow later changes
SEASON_END = (3, 1)


def _season_end_cutoff(now):
    """Nests created before this moment have seen their season end."""
    local = timezone.localtime(now)
    year = local.year if (local.month, local.day) >= SEASON_END else local.year - 1
    return timezone.make_aware(datetime.datetime(year, 1, 1))


def forwards(apps, schema_editor):
    Nest = apps.get_model('hornet', 'Nest')
    NestEvent = apps.get_model('hornet', 'NestEvent')
    now = timezone.now()
    cutoff = _season_end_cutoff(now)
    for nest in Nest.objects.all().iterator():
        events = [NestEvent(nest=nest, kind='report', performed_at=nest.created_at,
                            performed_by_id=nest.created_by_id, alerted_at=now)]
        status, last = 'reported', nest.created_at
        if nest.destroyed:
            # Nests destroyed before the destruction date was kept have none:
            # the event sits at the report, marked so, and the nest keeps no date
            known = nest.destroyed_at is not None
            destroyed_at = nest.destroyed_at if known else nest.created_at
            events.append(NestEvent(nest=nest, kind='destruction', performed_at=destroyed_at, actor='unknown',
                                    details={} if known else {'date_unknown': True}, alerted_at=now))
            status, last = 'destroyed', max(last, destroyed_at)
        elif nest.created_at < cutoff:
            ended = timezone.make_aware(datetime.datetime(timezone.localtime(nest.created_at).year + 1, *SEASON_END))
            events.append(NestEvent(nest=nest, kind='season_end', performed_at=ended, alerted_at=now))
            status, last = 'abandoned', ended
        NestEvent.objects.bulk_create(events)
        nest.status, nest.last_event_at = status, last
        nest.save(update_fields=['status', 'last_event_at'])


def backwards(apps, schema_editor):
    apps.get_model('hornet', 'NestEvent').objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('hornet', '0029_nest_journal'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
