"""
Notifications about nests, sent by the scheduler service.

* A report tells the coordinators (platform admins, `/hunters/admin`): "Tous
  les nouveaux nids", on by default for them; the beekeepers who turned that
  kind on; and, for an active nest, the owners of the apiaries within
  `NEARBY_APIARY_RADIUS_M` and the administrators of the associations those
  apiaries are shared with ("Nids près de mes ruchers"). An empty nest only
  tells the coordinators.
* A verification or a destruction tells the owner of the nest, its reporter at
  first ("Suivi de mes signalements"), unless they recorded it themselves.
* A destruction also tells the coordinators ("Tous les nouveaux nids") and, as
  for an active nest, the owners of the apiaries nearby and the administrators
  of their associations ("Nids près de mes ruchers"): the danger is over.
* A nest handed over tells its new owner at once (`tell_new_owner`): an action
  of a person, like a group message, not held to the sending hours.

Each person gets one notification per event, the most telling one (their own
apiary, then their association's, then "new nest"), never about their own
action. Pending events (`NestEvent.alerted_at` NULL) go out during the sending
hours of the trap reminders (from 9 am, 10 am on Sundays, to 8 pm, Brussels
time); what arrives outside waits for the next opening, and from
`SUMMARY_FROM` new nests for one person in one pass, a single summary. An
event left unsent for `EXPIRY` (scheduler down) is dropped: it is old news.
Only people with a subscribed device count, and the sending is not recorded
in the audit trail (an action of the system).
"""

import logging
import re
from datetime import timedelta

from django.contrib.gis.measure import D
from django.db import connection, transaction
from django.utils import timezone

from . import notification_kinds as kinds
from . import push
from .models import Apiary, ApiaryGroupPermission, Nest, NestAlert, NestEvent, PushNotification, User
from .nest_permissions import NEARBY_APIARY_RADIUS_M
from .reminders import in_window

logger = logging.getLogger(__name__)

SUMMARY_FROM = 3
EXPIRY = timedelta(hours=48)
LOCK_KEY = 74_210_002
MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre',
          'novembre', 'décembre']

# Kinds of a new nest, the most telling first
NEW_NEST_KINDS = ('near_own', 'near_association', kinds.NEST_NEW)
# A Belgian postcode then the locality: "…, 5020 Vedrin, Namur"
LOCALITY = re.compile(r'\b\d{4}\s+([^\d,][^,]*)')


def locality(address: str) -> str:
    """The locality of an address, never the street: the text shows on a locked screen."""
    match = LOCALITY.search(address or '')
    return match.group(1).strip() if match else ''


def _where(nest) -> str:
    place = locality(nest.address)
    return f"Nid #{nest.pk} à {place}" if place else f"Nid #{nest.pk}"


def _new_nest_message(nest, event, reason: str) -> dict:
    url = f'/nests?nest={nest.pk}'
    if reason == 'near_own':
        return {'kind': kinds.NEST_NEAR_APIARY, 'title': "Nid près de votre rucher", 'url': url,
                'body': f"{_where(nest)}, à moins de 1 km de votre rucher."}
    if reason == 'near_association':
        return {'kind': kinds.NEST_NEAR_APIARY, 'title': "Nid près d'un rucher de votre association", 'url': url,
                'body': f"{_where(nest)}, à moins de 1 km d'un rucher de votre association."}
    photos = nest.photos.count()
    details = ['lieu public' if nest.public_place else 'lieu privé']
    if photos:
        details.append(f"{photos} photo{'s' if photos > 1 else ''}")
    empty = event.outcome == NestEvent.OUTCOME_EMPTY
    return {'kind': kinds.NEST_NEW, 'title': "Nid vide signalé" if empty else "Nouveau nid signalé", 'url': url,
            'body': f"{_where(nest)} · {' · '.join(details)}."}


def _destroyed_message(nest, reason: str) -> dict:
    url = f'/nests?nest={nest.pk}'
    if reason == 'near_own':
        return {'kind': kinds.NEST_NEAR_APIARY, 'title': "Nid neutralisé près de votre rucher", 'url': url,
                'body': f"{_where(nest)}, à moins de 1 km de votre rucher, a été neutralisé."}
    if reason == 'near_association':
        return {'kind': kinds.NEST_NEAR_APIARY, 'title': "Nid neutralisé près d'un rucher de votre association",
                'url': url, 'body': f"{_where(nest)}, à moins de 1 km d'un rucher de votre association, a été neutralisé."}
    return {'kind': kinds.NEST_NEW, 'title': "Nid neutralisé", 'url': url, 'body': f"{_where(nest)} a été neutralisé."}


def _followup_message(nest, event):
    url = f'/nests?nest={nest.pk}'
    if event.kind == NestEvent.KIND_DESTRUCTION:
        day = timezone.localtime(event.performed_at)
        body = f"Le nid #{nest.pk} a été neutralisé le {day.day} {MONTHS[day.month - 1]}. Merci !"
        if event.details.get('date_unknown'):
            body = f"Le nid #{nest.pk} a été neutralisé. Merci !"
    else:
        body = {
            NestEvent.OUTCOME_ACTIVE: f"Le nid #{nest.pk} est confirmé : c'est bien un nid de frelons asiatiques.",
            NestEvent.OUTCOME_EMPTY: f"Le nid #{nest.pk} a été trouvé vide.",
            NestEvent.OUTCOME_OTHER_SPECIES: f"Le nid #{nest.pk} n'est pas un nid de frelons asiatiques. Merci quand même !",
            NestEvent.OUTCOME_NOT_FOUND: f"Le nid #{nest.pk} n'a pas été trouvé à l'endroit indiqué.",
        }.get(event.outcome)
        if body is None:
            return None
    return {'kind': kinds.NEST_FOLLOWUP, 'title': "Votre signalement a avancé", 'body': body, 'url': url}


def _summary(messages: list) -> dict:
    places = [m['place'] for m in messages]
    body = ', '.join(places) + '.'
    if len(body) > PushNotification.BODY_MAX:
        body = body[:PushNotification.BODY_MAX - 1] + '…'
    near = any(m['kind'] == kinds.NEST_NEAR_APIARY for m in messages)
    return {'kind': kinds.NEST_NEAR_APIARY if near else kinds.NEST_NEW,
            'title': f"{len(messages)} nouveaux nids signalés", 'body': body, 'url': '/nests'}


def _new_nest_reasons(nest, event, users, destroyed=False) -> dict:
    """
    guid -> the reasons a person is told about this nest, the most telling first.
    For a destroyed nest the beekeepers' "all nests" is left out: only the coordinators and the neighbours.
    """
    reasons = {}
    empty = event.outcome == NestEvent.OUTCOME_EMPTY
    for user in users:
        if kinds.is_nest_coordinator(user) or (kinds.is_beekeeper(user) and not empty and not destroyed):
            reasons.setdefault(user.guid, []).append(kinds.NEST_NEW)
    if empty or nest.point is None:
        return reasons
    near = list(Apiary.objects.filter(point__distance_lte=(nest.point, D(m=NEARBY_APIARY_RADIUS_M)))
                .values_list('pk', 'owner_id'))
    if not near:
        return reasons
    by_guid = {user.guid: user for user in users}
    for _, owner in near:
        if owner in by_guid:
            reasons.setdefault(owner, []).insert(0, 'near_own')
    admin_paths = {f"{path}/admin" for path in ApiaryGroupPermission.objects.filter(
        apiary_id__in=[pk for pk, _ in near], can_read=True).values_list('group__path', flat=True)}
    for user in users:
        if admin_paths & set(user.group_paths or []):
            reasons.setdefault(user.guid, []).append('near_association')
    for guid, items in reasons.items():
        reasons[guid] = sorted(set(items), key=NEW_NEST_KINDS.index)
    return reasons


def _messages_for(event, users, paused=frozenset()):
    """
    (messages, held): guid -> the message `event` calls for, nobody about their own
    action; and the people whose message is of a kind held back by the platform
    (`paused`): they are told once it is resumed, so the event stays pending.
    """
    nest = event.nest
    found, held = {}, set()
    if event.kind == NestEvent.KIND_REPORT:
        # Done by then (rejected, destroyed): nothing to call anyone for
        if nest.status in (Nest.STATUS_REJECTED, Nest.STATUS_DESTROYED):
            return found, held
        by_guid = {user.guid: user for user in users}
        for guid, reasons in _new_nest_reasons(nest, event, users).items():
            for reason in reasons:
                message = _new_nest_message(nest, event, reason)
                if kinds.wants(by_guid[guid], message['kind']):
                    if message['kind'] in paused:
                        held.add(guid)
                    else:
                        found[guid] = {**message, 'place': locality(nest.address) or f"#{nest.pk}"}
                    break
    elif event.kind in (NestEvent.KIND_VISIT, NestEvent.KIND_DESTRUCTION):
        message = _followup_message(nest, event)
        for user in users:
            if message and user.guid == nest.owner_id and kinds.wants(user, kinds.NEST_FOLLOWUP):
                if kinds.NEST_FOLLOWUP in paused:
                    held.add(user.guid)
                else:
                    found[user.guid] = message
        if event.kind == NestEvent.KIND_DESTRUCTION:
            by_guid = {user.guid: user for user in users}
            for guid, reasons in _new_nest_reasons(nest, event, users, destroyed=True).items():
                # The follow-up above is the most telling one for the owner
                if guid in found or guid in held:
                    continue
                for reason in reasons:
                    message = _destroyed_message(nest, reason)
                    if kinds.wants(by_guid[guid], message['kind']):
                        if message['kind'] in paused:
                            held.add(guid)
                        else:
                            found[guid] = {**message, 'destroyed': True}
                        break
    found.pop(event.performed_by_id, None)
    held.discard(event.performed_by_id)
    already = set(NestAlert.objects.filter(event=event).values_list('user_id', flat=True))
    return {guid: message for guid, message in found.items() if guid not in already}, held - already


def tell_new_owner(nest, owner, sender) -> int:
    """
    Tell `owner` the nest was handed over to them ("Suivi de mes signalements"),
    unless they handed it to themselves or turned that kind off. Called inside
    the transaction of the change: the sending starts once it is committed.
    Returns the number of devices.
    """
    if not push.enabled() or str(owner.guid) == str(sender) or not kinds.wants(owner, kinds.NEST_FOLLOWUP):
        return 0
    if kinds.NEST_FOLLOWUP in push.paused_kinds():  # an action of a person: not kept for later
        return 0
    notification = PushNotification.objects.create(
        sender=sender, recipient=owner.guid, recipients_count=1, kind=kinds.NEST_FOLLOWUP,
        title="Un nid vous a été transféré", body=f"{_where(nest)}. Vous en recevrez le suivi.",
        url=f'/nests?nest={nest.pk}')
    devices = push.queue(notification, [owner.guid])
    if devices:
        transaction.on_commit(lambda: push.dispatch(notification))
    return devices


def run(now=None, dry_run=False) -> dict:
    """One pass of the scheduler: send the notifications of the pending nest events. Idempotent."""
    now = timezone.localtime(now or timezone.now())
    if not in_window(now):
        return {'skipped': 'outside the sending hours'}
    sent, plans = [], []
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_try_advisory_xact_lock(%s)', [LOCK_KEY])
            if not cursor.fetchone()[0]:
                return {'skipped': 'another run in progress'}
        pending = NestEvent.objects.filter(alerted_at__isnull=True)
        if not dry_run:
            pending.filter(created_at__lt=now - EXPIRY).update(alerted_at=now)
        events = list(pending.filter(created_at__gte=now - EXPIRY).select_related('nest').order_by('created_at', 'id'))
        if not events:
            return {'notifications': 0, 'people': 0, 'messages': []}
        # Only those who can receive anything
        users = list(User.objects.filter(push_subscriptions__isnull=False).distinct())

        # Held back by the platform: such an event stays pending until resumed (or `EXPIRY`)
        paused = push.paused_kinds()
        by_person, waiting = {}, set()
        for event in events:
            messages, held = _messages_for(event, users, paused)
            if held:
                waiting.add(event.pk)
            for guid, message in messages.items():
                by_person.setdefault(guid, []).append((event, message))

        for guid, entries in by_person.items():
            def is_news(entry):
                return entry[1]['kind'] != kinds.NEST_FOLLOWUP and not entry[1].get('destroyed')

            new_nests = [entry for entry in entries if is_news(entry)]
            others = [entry for entry in entries if not is_news(entry)]
            messages = [m for _, m in others]
            if len(new_nests) >= SUMMARY_FROM:
                messages.append(_summary([m for _, m in new_nests]))
            else:
                messages.extend(m for _, m in new_nests)
            plans.append((guid, entries, messages))

        for guid, entries, messages in plans:
            if dry_run:
                sent.extend(messages)
                continue
            for message in messages:
                notification = PushNotification.objects.create(
                    sender=None, recipient=guid, recipients_count=1, kind=message['kind'],
                    title=message['title'], body=message['body'][:PushNotification.BODY_MAX], url=message['url'])
                push.queue(notification, [guid])
                sent.append(notification)
            NestAlert.objects.bulk_create([NestAlert(event=event, user_id=guid, kind=message['kind'], sent_at=now)
                                           for event, message in entries], ignore_conflicts=True)
        if not dry_run:
            NestEvent.objects.filter(pk__in=[event.pk for event in events if event.pk not in waiting]
                                     ).update(alerted_at=now)

    if not dry_run:
        for notification in sent:
            push.deliver_now(notification.id)
    if sent:
        logger.info("Nest alerts: %s notification(s) for %s people", len(sent), len(plans))
    return {'notifications': len(sent), 'people': len(plans),
            'waiting': len(waiting),
            'messages': [(m['title'], m['body']) if isinstance(m, dict) else (m.title, m.body) for m in sent]}
