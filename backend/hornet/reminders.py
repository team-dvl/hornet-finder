"""
Reminders to the owners of traps: a reading every so many days, a renewal of
the attractant every so many days, both set per trap type
(`TrapType.reading_interval_days`, `refill_interval_days`).

What is due is derived from the journal, never stored: a reading is due
`interval` days after the last reading (a `catch` event, even an empty one) or,
without any, after the installation; the attractant after the last `refill` or
the installation. An inspection counts for nothing. A trap out of service
(`active` false, after a removal) or without an owner has no reminder; putting
it back in service (an installation) restarts both delays.

Sending (`run`, called by the scheduler service every few minutes) only
records where each reminder stands (`TrapReminder`): a first reminder on the
day it is due, then one every `REPEAT_EVERY_DAYS` days, `MAX_REPEATS` times at
most, then nothing until the trap's journal moves. Reminders leave at
`SEND_HOUR` (`SUNDAY_HOUR` on Sundays), Brussels time, and until `LAST_HOUR`
when the scheduler was late. One notification per trap and kind, or a single
summary from `SUMMARY_FROM` reminders for one person. Only owners with a
subscribed device and the kind turned on are counted: someone who subscribes
later still gets what is due then.
"""

import logging
from dataclasses import dataclass
from datetime import date, timedelta

from django.db import connection, transaction
from django.db.models import Max, Q
from django.utils import timezone

from . import notification_kinds as kinds
from . import push
from .models import PushNotification, Trap, TrapEvent, TrapReminder

logger = logging.getLogger(__name__)

SEND_HOUR = 9
SUNDAY_HOUR = 10
LAST_HOUR = 20
REPEAT_EVERY_DAYS = 2
MAX_REPEATS = 3
SUMMARY_FROM = 3
# Arbitrary key of the PostgreSQL advisory lock: one run at a time
LOCK_KEY = 74_210_001

# kind -> (interval field of the trap type, event kinds that restart the delay)
RULES = {
    kinds.TRAP_READING: ('reading_interval_days', (TrapEvent.KIND_CATCH,)),
    kinds.TRAP_REFILL: ('refill_interval_days', (TrapEvent.KIND_REFILL,)),
}


@dataclass
class Due:
    trap: Trap
    kind: str
    interval_days: int
    # Date the delay counts from: the last reading/refill, or the installation
    last_on: date
    # Whether `last_on` is the installation (nothing recorded since)
    from_installation: bool

    @property
    def due_on(self) -> date:
        return self.last_on + timedelta(days=self.interval_days)

    def days_late(self, today: date) -> int:
        return (today - self.due_on).days

    def days_since(self, today: date) -> int:
        return (today - self.last_on).days


def _local_date(value):
    return timezone.localtime(value).date() if value else None


def with_last_events(queryset):
    """Annotate the last reading, refill and installation of each trap."""
    return queryset.annotate(
        last_catch=Max('events__performed_at', filter=Q(events__kind=TrapEvent.KIND_CATCH)),
        last_refill=Max('events__performed_at', filter=Q(events__kind=TrapEvent.KIND_REFILL)),
        last_installation=Max('events__performed_at', filter=Q(events__kind=TrapEvent.KIND_INSTALLATION)),
    )


def reminder_traps(queryset):
    """The traps that may have reminders: in service, owned, of a type that sets a delay."""
    return with_last_events(
        queryset.filter(active=True, owner__isnull=False)
        .filter(Q(trap_type__reading_interval_days__isnull=False)
                | Q(trap_type__refill_interval_days__isnull=False))
        .select_related('trap_type', 'owner')
    )


def items_of(trap) -> list:
    """The reminders of one annotated trap, due or not."""
    installed = _local_date(trap.last_installation) or trap.installed_at
    result = []
    for kind, (field, _) in RULES.items():
        interval = getattr(trap.trap_type, field)
        if not interval:
            continue
        last = _local_date(trap.last_catch if kind == kinds.TRAP_READING else trap.last_refill)
        # A reading before a re-installation belongs to the previous season
        if last is None or (installed and last < installed):
            result.append(Due(trap, kind, interval, installed, True))
        else:
            result.append(Due(trap, kind, interval, last, False))
    return result


def due_for(queryset, today: date, horizon_days: int = 0) -> list:
    """Reminders due by `today + horizon_days`, most overdue first."""
    limit = today + timedelta(days=horizon_days)
    items = [item for trap in reminder_traps(queryset) for item in items_of(trap) if item.due_on <= limit]
    items.sort(key=lambda item: (item.due_on, item.trap.pk, item.kind))
    return items


def send_hour(now) -> int:
    return SUNDAY_HOUR if now.weekday() == 6 else SEND_HOUR


def in_window(now) -> bool:
    return send_hour(now) <= now.hour < LAST_HOUR


def _should_send(state: TrapReminder, today: date) -> bool:
    if state.last_sent_on == today:
        return False
    if state.sent_count == 0:
        return True
    if state.sent_count > MAX_REPEATS:
        return False
    return state.last_sent_on is None or today >= state.last_sent_on + timedelta(days=REPEAT_EVERY_DAYS)


def _plural(count: int, word: str) -> str:
    return f"{count} {word}{'s' if count > 1 else ''}"


def _single(item: Due, today: date) -> dict:
    trap = item.trap
    days = _plural(item.days_since(today), 'jour')
    if item.kind == kinds.TRAP_READING:
        title = "Relevé à faire"
        since = f"installé il y a {days}" if item.from_installation else f"dernier relevé il y a {days}"
    else:
        title = "Attractif à renouveler"
        since = f"installé il y a {days}" if item.from_installation else f"dernière recharge il y a {days}"
    body = f"Piège #{trap.pk} ({trap.trap_type.name}) : {since}."
    return {'kind': item.kind, 'trap': trap, 'title': title, 'body': body[:PushNotification.BODY_MAX],
            'url': f'/traps/due?trap={trap.pk}'}


def _summary(items: list) -> dict:
    readings = [f"#{item.trap.pk}" for item in items if item.kind == kinds.TRAP_READING]
    refills = [f"#{item.trap.pk}" for item in items if item.kind == kinds.TRAP_REFILL]
    parts = []
    if readings:
        parts.append(f"À relever : {', '.join(readings)}")
    if refills:
        parts.append(f"Attractif : {', '.join(refills)}")
    body = '. '.join(parts) + '.'
    if len(body) > PushNotification.BODY_MAX:
        body = body[:PushNotification.BODY_MAX - 1] + '…'
    # The summary only exists for several reminders: its kind is the first one's
    kind = kinds.TRAP_READING if readings else kinds.TRAP_REFILL
    return {'kind': kind, 'trap': None, 'title': f"{_plural(len(items), 'rappel')} pour vos pièges",
            'body': body, 'url': '/traps/due'}


def tell_new_owner(trap, owner, sender) -> int:
    """
    Tell `owner` the trap was handed over to them, unless they handed it to
    themselves or turned that kind off. Called inside the transaction of the
    change: the sending starts once it is committed, at any hour, as it is the
    action of a person. Returns the number of devices.
    """
    if not push.enabled() or str(owner.guid) == str(sender) or not kinds.wants(owner, kinds.TRAP_HANDOVER):
        return 0
    notification = PushNotification.objects.create(
        sender=sender, recipient=owner.guid, recipients_count=1, kind=kinds.TRAP_HANDOVER,
        title="Un piège vous a été transféré", body=f"Piège #{trap.pk}. Vous en recevrez les rappels.",
        url=f'/traps?trap={trap.pk}')
    devices = push.queue(notification, [owner.guid])
    if devices:
        transaction.on_commit(lambda: push.dispatch(notification))
    return devices


def run(now=None, dry_run=False) -> dict:
    """
    One pass of the scheduler: send what is due today and not sent yet. Safe to
    call any number of times; returns what it did.
    """
    now = timezone.localtime(now or timezone.now())
    if not in_window(now):
        return {'skipped': 'outside the sending hours'}
    today = now.date()
    sent = []
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_try_advisory_xact_lock(%s)', [LOCK_KEY])
            if not cursor.fetchone()[0]:
                return {'skipped': 'another run in progress'}

        # Owners with a device: a reminder nobody can receive is kept for later
        candidates = Trap.objects.filter(owner__push_subscriptions__isnull=False).distinct()
        items = due_for(candidates, today)
        states = {(s.trap_id, s.kind): s for s in TrapReminder.objects.filter(
            trap_id__in={item.trap.pk for item in items})}

        by_owner = {}
        for item in items:
            if not kinds.wants(item.trap.owner, item.kind):
                continue
            state = states.get((item.trap.pk, item.kind))
            if state is None:
                state = TrapReminder(trap=item.trap, kind=item.kind, reference_on=item.last_on)
            elif state.reference_on != item.last_on:
                # The journal moved: a new cycle
                state.reference_on, state.sent_count, state.last_sent_on = item.last_on, 0, None
            if _should_send(state, today):
                by_owner.setdefault(item.trap.owner, []).append((item, state))

        for owner, entries in by_owner.items():
            messages = ([_summary([item for item, _ in entries])] if len(entries) >= SUMMARY_FROM
                        else [_single(item, today) for item, _ in entries])
            if dry_run:
                sent.extend(messages)
                continue
            for message in messages:
                notification = PushNotification.objects.create(
                    sender=None, recipient=owner.guid, recipients_count=1, **message)
                push.queue(notification, [owner.guid])
                sent.append(notification)
            for _, state in entries:
                state.sent_count += 1
                state.last_sent_on = today
                state.save()

    if not dry_run:
        for notification in sent:
            push.deliver_now(notification.id)
    logger.info("Trap reminders: %s notification(s) for %s owner(s)", len(sent), len(by_owner))
    return {'notifications': len(sent), 'owners': len(by_owner),
            'messages': [(m['title'], m['body']) if isinstance(m, dict) else (m.title, m.body) for m in sent]}
