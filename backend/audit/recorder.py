"""
Recording business actions in the audit trail.

Views call `record` (or `track` around an update) inside the transaction of
the change, so an event exists if and only if the change was committed.
Actions done in Keycloak (group memberships) are recorded once Keycloak
accepted them: there is no transaction to share.
"""

import contextlib
import datetime
import decimal
import logging
import time
import uuid

from django.conf import settings
from django.db import connection, models, transaction
from django.db.models.fields.files import FieldFile
from django.utils import timezone

from .actions import ACTIONS
from .models import AuditEvent

logger = logging.getLogger(__name__)

# Model name -> type used in the trail (`target_type`, `refs`)
TYPES = {
    'hornet': 'hornet',
    'nest': 'nest',
    'nestphoto': 'nest_photo',
    'apiary': 'apiary',
    'trap': 'trap',
    'trapevent': 'trap_event',
    'trapphoto': 'trap_photo',
    'tag': 'tag',
    'traptype': 'trap_type',
    'species': 'species',
    'groupinvitation': 'invitation',
    'user': 'user',
    'statexportjob': 'export',
}

# Business fields kept in snapshots and diffs; technical ones (`point`,
# `updated_at`, derived counters, thumbnails) are left out
FIELDS = {
    'hornet': ['latitude', 'longitude', 'direction', 'duration', 'mark_color_1', 'mark_color_2',
               'linked_nest', 'created_by', 'archived'],
    'nest': ['latitude', 'longitude', 'address', 'public_place', 'destroyed', 'destroyed_at',
             'comments', 'created_by', 'archived'],
    'apiary': ['latitude', 'longitude', 'address', 'infestation_level', 'afsca_number', 'comments',
               'owner', 'photo'],
    'trap': ['latitude', 'longitude', 'address', 'trap_type', 'installed_at', 'active', 'visibility',
             'group', 'owner', 'comments', 'photo'],
    'trap_event': ['trap', 'kind', 'performed_at', 'performed_by', 'species', 'observed_quantity',
                   'quantity', 'emptied', 'bycatch_counted', 'batch', 'comments'],
    'trap_type': ['slug', 'name', 'description', 'sort_order', 'apiary_bound', 'accumulates', 'photo'],
    'species': ['slug', 'name', 'scientific_name', 'wikipedia_url', 'photo_credit', 'photo_source_url',
                'sort_order', 'photo'],
    'tag': ['key_index', 'trap', 'generated_by', 'associated_by', 'revoked_by'],
}

# Purge of the events past retention, at most once a day per process
PURGE_INTERVAL_SECONDS = 24 * 3600
_last_purge = None


def ref(kind: str, key) -> str:
    return f"{kind}:{key}"


def type_of(obj) -> str:
    return TYPES[obj._meta.model_name]


def json_value(value):
    """A model value as JSON: dates in ISO 8601, keys and files as strings."""
    if isinstance(value, FieldFile):
        return value.name or None
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.isoformat()
    if isinstance(value, (uuid.UUID, decimal.Decimal)):
        return str(value)
    if isinstance(value, models.Model):
        return str(value.pk)
    return value


def snapshot(obj, fields=None) -> dict:
    """The business fields of `obj`; a foreign key is given by its primary key."""
    fields = fields if fields is not None else FIELDS.get(type_of(obj), [])
    result = {}
    for name in fields:
        field = obj._meta.get_field(name)
        if field.is_relation:
            value = getattr(obj, field.attname)
            result[name] = None if value is None else str(value)
        else:
            result[name] = json_value(getattr(obj, name))
    return result


def diff(before: dict, after: dict) -> dict:
    """{field: [before, after]} for the fields that changed."""
    return {name: [before.get(name), after.get(name)]
            for name in after if before.get(name) != after.get(name)}


def default_refs(obj) -> list:
    """What an object belongs to, besides itself."""
    kind = type_of(obj)
    refs = []
    if kind in ('trap_event', 'trap_photo') and obj.trap_id:
        refs.append(ref('trap', obj.trap_id))
    elif kind == 'nest_photo':
        refs.append(ref('nest', obj.nest_id))
    elif kind == 'tag' and obj.trap_id:
        refs.append(ref('trap', obj.trap_id))
    elif kind == 'trap' and obj.group_id:
        refs.append(ref('group', obj.group.path))
    elif kind == 'invitation':
        refs += [ref('group', obj.group_path), ref('user', obj.invitee_id)]
    return refs


def label_of(obj) -> str:
    """A short description of an object for the trail: what an admin recognises it by."""
    kind = type_of(obj)
    if kind in ('nest', 'trap'):
        label = obj.address
    elif kind == 'apiary':
        label = ' · '.join(part for part in (obj.afsca_number, obj.address) if part)
    elif kind == 'trap_event':
        label = obj.trap.address if obj.trap_id else ''
    elif kind == 'tag':
        label = obj.value[2:10]
    elif kind == 'invitation':
        label = obj.group_name
    elif kind in ('trap_type', 'species'):
        label = obj.name
    else:
        label = ''
    return (label or '')[:255]


def _actor(request):
    user = getattr(request, 'user', None)
    if not getattr(user, 'is_authenticated', False):
        return None, []
    guid = getattr(user, 'guid', None)
    try:
        guid = uuid.UUID(str(guid)) if guid else None
    except ValueError:
        guid = None
    return guid, list(getattr(user, 'roles', []) or [])


def _request_id(request):
    """One id per HTTP request, shared by the events it records."""
    if request is None:
        return None
    raw = getattr(request, '_request', request)
    if not hasattr(raw, 'audit_request_id'):
        try:
            raw.audit_request_id = uuid.uuid4()
        except AttributeError:
            return None
    return raw.audit_request_id


def record(request, action: str, target=None, *, changes=None, refs=(), occurred_at=None,
           source=None, label=None) -> AuditEvent:
    """
    Record `action` on `target`: a model instance, or a `(type, id)` pair for
    what has no row (a Keycloak group, a statistic) or no longer has one.
    `label` describes the target (derived from an instance when not given).
    `request` gives the actor; without one (or without a signed-in user) the
    event has no actor.
    """
    if action not in ACTIONS:
        raise ValueError(f"Unknown audit action: {action}")
    if isinstance(target, models.Model):
        target_type, target_id = type_of(target), str(target.pk)
        all_refs = [ref(target_type, target_id)] + default_refs(target)
        if label is None:
            label = label_of(target)
    elif target is not None:
        target_type, target_id = target[0], '' if target[1] is None else str(target[1])
        all_refs = [ref(target_type, target_id)] if target_id else []
    else:
        target_type, target_id, all_refs = '', '', []
    for item in refs:
        if item and item not in all_refs:
            all_refs.append(item)
    actor, roles = _actor(request)
    if source is None:
        source = AuditEvent.SOURCE_API if request is not None else AuditEvent.SOURCE_SYSTEM
    event = AuditEvent.objects.create(
        occurred_at=occurred_at or timezone.now(), actor=actor, actor_roles=roles, source=source,
        action=action, target_type=target_type, target_id=target_id, target_label=label or '',
        refs=all_refs,
        changes=changes or {}, request_id=_request_id(request),
    )
    _schedule_purge()
    return event


class Tracked:
    """What `track` hands to the block: the action may be refined in it."""

    def __init__(self, action):
        self.action = action
        self.extra = {}
        self.refs = []


@contextlib.contextmanager
def track(request, action: str, obj, *, fields=None, resolve=None):
    """
    Record the update of `obj` made inside the block, as the diff of its
    business fields (read from the database before and after). `resolve(changes)`
    may return a more telling action (e.g. `nest.destroyed`). Nothing is
    recorded when nothing changed, nor when the block raises.
    """
    tracked = Tracked(action)
    manager = type(obj)._default_manager
    with transaction.atomic():
        # From the database: the instance may already carry changes not yet saved
        before = snapshot(manager.get(pk=obj.pk), fields)
        yield tracked
        fresh = manager.get(pk=obj.pk)
        changes = diff(before, snapshot(fresh, fields))
        if not changes and not tracked.extra:
            return
        if resolve:
            tracked.action = resolve(changes) or tracked.action
        record(request, tracked.action, fresh, changes={**changes, **tracked.extra},
               refs=tracked.refs)


def flip_action(domain: str, changes: dict, default: str) -> str:
    """
    The headline action of an update: destroying or reactivating a nest, then
    archiving or unarchiving, before a plain update.
    """
    if 'destroyed' in changes:
        return f"{domain}.destroyed" if changes['destroyed'][1] else f"{domain}.reactivated"
    if 'archived' in changes:
        return f"{domain}.archived" if changes['archived'][1] else f"{domain}.unarchived"
    return default


# -- retention ----------------------------------------------------------------

def retention_cutoff(now=None):
    return (now or timezone.now()) - datetime.timedelta(days=settings.AUDIT_RETENTION_DAYS)


def purge_expired(now=None) -> int:
    """Delete the events older than `AUDIT_RETENTION_DAYS`: the only deletion the trigger lets through."""
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SET LOCAL audit.purge = 'on'")
        deleted, _ = AuditEvent.objects.filter(occurred_at__lt=retention_cutoff(now)).delete()
    if deleted:
        logger.info("Audit trail: %s event(s) past retention purged", deleted)
    return deleted


def _schedule_purge():
    global _last_purge
    now = time.monotonic()
    if _last_purge is not None and now - _last_purge < PURGE_INTERVAL_SECONDS:
        return
    _last_purge = now

    def run():
        try:
            purge_expired()
        except Exception:  # pragma: no cover - never fails the request that triggered it
            logger.exception("Audit trail purge failed")

    transaction.on_commit(run)
