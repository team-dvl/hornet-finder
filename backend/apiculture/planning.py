"""
Planned visits: what waits ("À faire": the planned visits of today and the
late ones, where the requester takes part), and the reminder of each one.

A planned visit is reminded once, to its creator and its participants: from
`REMIND_HOUR` the day before (Brussels time), and only between `QUIET_UNTIL`
and `QUIET_FROM` (7 h - 21 h). A visit planned at dawn is reminded the
evening before; one planned in the evening for the next morning, at once. Moving a visit clears its reminder
(`Visit.reminded_at`), which goes out again for the new time. Held back by
the platform (`push.paused_kinds`), the reminder waits and leaves once
resumed, if the visit is still ahead.

The lock screen shows the name of the apiary, never its address: the place
of an apiary is not to be read by anyone holding the phone.
"""

import datetime
import logging

from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone

from hornet import notification_kinds as kinds
from hornet import push
from hornet.models import PushNotification, PushSubscription, User

from .models import Visit

logger = logging.getLogger(__name__)

VISIT_REMINDER = 'visit_reminder'
LABEL = "Rappels de visites prévues"
REMIND_HOUR = 18
QUIET_UNTIL = 7
QUIET_FROM = 21
# Arbitrary key of the PostgreSQL advisory lock: one run at a time
LOCK_KEY = 74_210_005


def concerns(user) -> bool:
    """The Notifications module lists the kind to the beekeepers (and the platform admins)."""
    return kinds.is_beekeeper(user) or kinds.is_nest_coordinator(user)


def involving_q(guid) -> Q:
    """The visits `guid` created or takes part in."""
    return Q(created_by__guid=guid) | Q(participants__guid=guid)


def due_count(request) -> int:
    """The counter of the apiaries module: planned visits of today or late, where the requester takes part."""
    guid = getattr(request.user, 'guid', None)
    if guid is None:
        return 0
    end_of_today = timezone.localtime().replace(hour=23, minute=59, second=59, microsecond=999999)
    return (Visit.objects.filter(status=Visit.STATUS_PLANNED, started_at__lte=end_of_today)
            .filter(involving_q(guid)).values('pk').distinct().count())


def remind_at(visit) -> datetime.datetime:
    """When the reminder of a visit may leave: the day before at REMIND_HOUR, local time."""
    day = timezone.localtime(visit.started_at).date() - datetime.timedelta(days=1)
    return timezone.make_aware(datetime.datetime.combine(day, datetime.time(REMIND_HOUR)))


def _message(visit, now) -> dict:
    local = timezone.localtime(visit.started_at)
    when = "aujourd'hui" if local.date() == now.date() else 'demain' if (
        local.date() - now.date()).days == 1 else f"le {local:%d/%m}"
    apiary = visit.apiary
    place = (apiary.name or f"rucher #{apiary.pk}") if apiary else 'un rucher supprimé'
    what = visit.title or ', '.join(_KIND_LABELS.get(kind, kind) for kind in visit.kinds) or 'Visite'
    return {
        'kind': VISIT_REMINDER,
        'title': f"Visite {when} à {local:%H:%M}"[:PushNotification.TITLE_MAX],
        'body': f"{what} · {place}"[:PushNotification.BODY_MAX],
        'url': f'/apiaries/visits?visit={visit.pk}',
    }


_KIND_LABELS = {
    'control': 'Contrôle', 'feeding': 'Nourrissage', 'division': 'Division', 'swarm_catch': "Récolte d'essaim",
    'transfer': 'Transvasement', 'entrance_guard': 'Muselière', 'other': 'Autre',
}


def _recipients(visit) -> list:
    """The creator and the participants with a device, who keep the kind on."""
    people = {user.pk: user for user in visit.participants.all()}
    if visit.created_by_id:
        people.setdefault(visit.created_by_id, visit.created_by)
    with_device = set(PushSubscription.objects.filter(user_id__in=list(people)).values_list('user_id', flat=True))
    return [user for guid, user in people.items()
            if guid in with_device and kinds.wants(user, VISIT_REMINDER)]


def run(now=None, dry_run=False) -> dict:
    """One pass of the scheduler: remind the planned visits whose time has come. Idempotent."""
    now = timezone.localtime(now or timezone.now())
    if not QUIET_UNTIL <= now.hour < QUIET_FROM:
        return {'skipped': 'quiet hours'}
    if VISIT_REMINDER in push.paused_kinds():
        return {'skipped': 'paused by the platform'}
    sent = []
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_try_advisory_xact_lock(%s)', [LOCK_KEY])
            if not cursor.fetchone()[0]:
                return {'skipped': 'another run in progress'}
        # Ahead, and at most two days ahead: the reminder is the day before
        candidates = (Visit.objects
                      .filter(status=Visit.STATUS_PLANNED, reminded_at__isnull=True,
                              started_at__gt=now, started_at__lte=now + datetime.timedelta(days=2))
                      .select_related('apiary', 'created_by'))
        for visit in candidates:
            if remind_at(visit) > now:
                continue
            recipients = _recipients(visit)
            message = _message(visit, now)
            if dry_run:
                sent.append((message, [user.pk for user in recipients]))
                continue
            if recipients:
                notification = PushNotification.objects.create(
                    sender=None, recipients_count=len(recipients),
                    recipient=recipients[0].pk if len(recipients) == 1 else None, **message)
                push.queue(notification, [user.pk for user in recipients])
                sent.append((notification, recipients))
            # Reminded, even when nobody could receive it: no reminder at the last minute
            Visit.objects.filter(pk=visit.pk).update(reminded_at=now)
    if not dry_run:
        for notification, _ in sent:
            push.deliver_now(notification.id)
    if sent:
        logger.info("Visit reminders: %s notification(s)", len(sent))
    return {'notifications': len(sent),
            'messages': [(m['title'], m['body']) if isinstance(m, dict) else (m.title, m.body) for m, _ in sent]}


def register() -> None:
    """Hook the planning into hornet: the kind, the counter, the scheduled job (`apps.py`)."""
    from hornet import pending, scheduled
    kinds.KINDS.setdefault(VISIT_REMINDER, LABEL)
    kinds.CONCERNS[VISIT_REMINDER] = concerns
    pending.COUNTERS['apiaries'] = due_count
    if not any(name == 'visit reminders' for name, _ in scheduled.JOBS):
        scheduled.JOBS.append(('visit reminders', run))
