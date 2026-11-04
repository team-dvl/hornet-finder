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


# -- follow-ups ---------------------------------------------------------------
#
# Some events call for a visit a few days later; the server proposes it in the
# answer of the event (`proposals`), the beekeeper confirms or moves it:
#
# * a colony put in a nucleus (a portable hive): its transfer to a hive after
#   `NUCLEUS_DAYS` days of rest, early in the morning (`NUCLEUS_HOUR`);
# * a colony raising a queen (a division, the part of a swarm that stays): the
#   check that the new queen lays, `LAYING_CHECK_DAYS` days after. An
#   emergency queen emerges about 12-16 days after the division, mates 5-10
#   days later and lays 2-4 days after that: first eggs about 20-30 days on.
#
# A follow-up that no longer has a reason to be (the colony left its nucleus
# another way, ended, or was seen laying) is deleted with the event that made
# it pointless (`settle`), and the audit trail says why.

NUCLEUS_DAYS = 3
NUCLEUS_HOUR = (7, 30)
LAYING_CHECK_DAYS = 25
LAYING_CHECK_HOUR = (11, 0)


def _at(day, hour) -> datetime.datetime:
    return timezone.make_aware(datetime.datetime.combine(day, datetime.time(*hour)))


def _planned_follow_ups(colony, kinds_):
    return Visit.objects.filter(status=Visit.STATUS_PLANNED, follow_up_colony=colony, follow_up__in=kinds_)


def proposals(colonies, day) -> list:
    """The follow-up visits to propose for `colonies` after an event of `day`."""
    found = []
    tomorrow = _at(timezone.localdate() + datetime.timedelta(days=1), NUCLEUS_HOUR)
    for colony in colonies:
        if colony is None or colony.ended_on is not None:
            continue
        hive = colony.hive
        apiary = hive.apiary if hive is not None else None
        if apiary is None:
            continue
        base = {'colony': str(colony.pk), 'colony_label': str(colony), 'hive': str(hive.pk),
                'hive_label': str(hive), 'apiary': apiary.pk}
        if hive.hive_type.portable and not _planned_follow_ups(colony, [Visit.FOLLOW_UP_NUCLEUS]).exists():
            at = max(_at(day + datetime.timedelta(days=NUCLEUS_DAYS), NUCLEUS_HOUR), tomorrow)
            found.append({**base, 'follow_up': Visit.FOLLOW_UP_NUCLEUS, 'suggested_at': at.isoformat()})
        if (colony.requeening_since and not colony.laying_since
                and not _planned_follow_ups(colony, [Visit.FOLLOW_UP_LAYING]).exists()):
            at = _at(colony.requeening_since + datetime.timedelta(days=LAYING_CHECK_DAYS), LAYING_CHECK_HOUR)
            found.append({**base, 'follow_up': Visit.FOLLOW_UP_LAYING,
                          'suggested_at': max(at, tomorrow).isoformat()})
    return found


def stale_follow_up(visit) -> str:
    """Why a planned follow-up no longer has a reason to be, or ''."""
    colony = visit.follow_up_colony
    if colony is None or colony.ended_on is not None:
        return 'colony_ended'
    if visit.follow_up == Visit.FOLLOW_UP_NUCLEUS and not colony.hive.hive_type.portable:
        return 'left_nucleus'
    if visit.follow_up == Visit.FOLLOW_UP_LAYING and colony.laying_since:
        return 'laying_seen'
    return ''


def settle(request, colony, keep=None) -> int:
    """Delete the planned follow-ups of `colony` an event made pointless (but `keep`). Returns how many."""
    from audit import recorder as audit
    dropped = 0
    for visit in (Visit.objects.filter(status=Visit.STATUS_PLANNED, follow_up_colony=colony)
                  .exclude(follow_up='').select_related('follow_up_colony__hive__hive_type')):
        if keep is not None and visit.pk == keep.pk:
            continue
        reason = stale_follow_up(visit)
        if not reason:
            continue
        changes, label, pk = {**audit.snapshot(visit), 'reason': reason}, audit.label_of(visit), visit.pk
        refs = [audit.ref('colony', colony.pk)] + ([audit.ref('apiary', visit.apiary_id)] if visit.apiary_id else [])
        visit.delete()
        audit.record(request, 'apiary_visit.deleted', ('apiary_visit', pk), changes=changes, label=label, refs=refs)
        dropped += 1
    return dropped
