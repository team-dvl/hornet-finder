"""
Rebuilding the audit trail of the retention period from the existing data.

Only what the data states is rebuilt: an event whose moment is recorded in a
column, with its author when a column names it, nothing else. Changes of
fields, deletions, hand-overs, sharings, delegations and destructions of
nests left no dated trace and are not invented. Rebuilt events carry
`source='backfill'` and say in `changes.from` which column dates them.

Written against the historical models of a migration (`apps.get_model`).
"""

from datetime import timedelta

# Gap within which rows written by one request are taken as one action
SAME_REQUEST = timedelta(seconds=5)

# Validity of a group invitation (GroupInvitation.VALIDITY)
INVITATION_VALIDITY = timedelta(days=30)


def _ref(kind, key):
    return f"{kind}:{key}"


class _Events:
    def __init__(self, model, cutoff):
        self.model = model
        self.cutoff = cutoff
        self.items = []

    def add(self, when, action, target_type, target_id, *, actor=None, changes=None, refs=(), label=''):
        if when is None or when < self.cutoff:
            return
        target_id = '' if target_id is None else str(target_id)
        all_refs = [_ref(target_type, target_id)] if target_id else []
        all_refs += [item for item in refs if item and item not in all_refs]
        self.items.append(self.model(
            occurred_at=when, actor=actor, actor_roles=[], source='backfill', action=action,
            target_type=target_type, target_id=target_id, target_label=(label or '')[:255],
            refs=all_refs, changes=changes or {},
        ))


def _sightings_and_nests(apps, events):
    Hornet = apps.get_model('hornet', 'Hornet')
    Nest = apps.get_model('hornet', 'Nest')
    NestPhoto = apps.get_model('hornet', 'NestPhoto')

    for hornet in Hornet.objects.all().iterator():
        events.add(hornet.created_at, 'hornet.reported', 'hornet', hornet.pk,
                   actor=hornet.created_by_id, changes={'from': 'hornet.created_at'})
        events.add(hornet.archived_at, 'hornet.archived', 'hornet', hornet.pk,
                   changes={'from': 'hornet.archived_at'})

    photos = {}
    for photo in NestPhoto.objects.order_by('nest_id', 'created_at', 'id').iterator():
        photos.setdefault(photo.nest_id, []).append(photo)

    for nest in Nest.objects.all().iterator():
        # The photos sent with the report belong to it, as when it is recorded live
        later, with_report = [], 0
        for photo in photos.get(nest.pk, []):
            if (photo.uploaded_by_id == nest.created_by_id
                    and abs(photo.created_at - nest.created_at) <= SAME_REQUEST):
                with_report += 1
            else:
                later.append(photo)
        events.add(nest.created_at, 'nest.reported', 'nest', nest.pk, actor=nest.created_by_id,
                   changes={'from': 'nest.created_at', 'photos': with_report}, label=nest.address)
        events.add(nest.archived_at, 'nest.archived', 'nest', nest.pk,
                   changes={'from': 'nest.archived_at'}, label=nest.address)
        for group in _requests(later, key=lambda p: p.uploaded_by_id):
            events.add(group[0].created_at, 'nest.photo_added', 'nest', nest.pk,
                       actor=group[0].uploaded_by_id,
                       changes={'from': 'nestphoto.created_at', 'count': len(group)}, label=nest.address,
                       refs=[_ref('nest_photo', p.pk) for p in group])


def _requests(rows, key):
    """Consecutive rows (by date) of one author within `SAME_REQUEST`: one action each."""
    groups = []
    for row in rows:
        last = groups[-1][-1] if groups else None
        if (last is not None and key(last) == key(row)
                and row.created_at - last.created_at <= SAME_REQUEST):
            groups[-1].append(row)
        else:
            groups.append([row])
    return groups


def _apiaries(apps, events):
    Apiary = apps.get_model('hornet', 'Apiary')
    for apiary in Apiary.objects.all().iterator():
        events.add(apiary.created_at, 'apiary.created', 'apiary', apiary.pk,
                   actor=apiary.created_by_id, changes={'from': 'apiary.created_at'},
                   label=' · '.join(part for part in (apiary.afsca_number, apiary.address) if part))


def _traps(apps, events):
    Trap = apps.get_model('hornet', 'Trap')
    TrapEvent = apps.get_model('hornet', 'TrapEvent')

    journal = {}
    for event in TrapEvent.objects.order_by('trap_id', 'created_at', 'id').iterator():
        journal.setdefault(event.trap_id, []).append(event)

    for trap in Trap.objects.all().iterator():
        entries = journal.get(trap.pk, [])
        # Creating a trap writes its installation in the same request: its
        # author is the trap's creator, whoever owns the trap now
        opening = next((e for e in entries if e.kind == 'installation'
                        and abs(e.created_at - trap.created_at) <= SAME_REQUEST), None)
        events.add(trap.created_at, 'trap.created', 'trap', trap.pk,
                   actor=opening.performed_by_id if opening else None,
                   changes={'from': 'trap.created_at'}, label=trap.address,
                   refs=[_ref('trap_event', opening.pk)] if opening else [])

        visits = {}
        for entry in entries:
            if opening is not None and entry.pk == opening.pk:
                continue
            if entry.batch:
                visits.setdefault(entry.batch, []).append(entry)
                continue
            events.add(entry.created_at, 'trap.event_recorded', 'trap_event', entry.pk,
                       actor=entry.performed_by_id,
                       changes={'from': 'trapevent.created_at', 'kind': entry.kind},
                       refs=[_ref('trap', trap.pk)], label=trap.address)
        for batch, visit in visits.items():
            events.add(min(e.created_at for e in visit), 'trap.visit_recorded', 'trap', trap.pk,
                       actor=visit[0].performed_by_id,
                       changes={'from': 'trapevent.created_at', 'batch': str(batch), 'events': len(visit)},
                       label=trap.address,
                       refs=[_ref('visit', batch)] + [_ref('trap_event', e.pk) for e in visit])


def _tags(apps, events):
    Tag = apps.get_model('hornet', 'Tag')
    tags = list(Tag.objects.order_by('generated_at', 'id'))
    batches = []
    for tag in tags:
        last = batches[-1][-1] if batches else None
        if (last is not None and last.generated_by_id == tag.generated_by_id
                and last.key_index == tag.key_index
                and tag.generated_at - last.generated_at <= SAME_REQUEST):
            batches[-1].append(tag)
        else:
            batches.append([tag])
    for batch in batches:
        events.add(batch[0].generated_at, 'tag.batch_generated', 'tag', None,
                   actor=batch[0].generated_by_id,
                   changes={'from': 'tag.generated_at', 'count': len(batch), 'key_index': batch[0].key_index},
                   refs=[_ref('tag', tag.pk) for tag in batch])
    for tag in tags:
        short = tag.value[2:10]
        if tag.trap_id and tag.associated_at:
            events.add(tag.associated_at, 'tag.associated', 'tag', tag.pk, actor=tag.associated_by_id,
                       changes={'from': 'tag.associated_at', 'short': short, 'trap': tag.trap_id},
                       refs=[_ref('trap', tag.trap_id)], label=short)
        events.add(tag.revoked_at, 'tag.revoked', 'tag', tag.pk, actor=tag.revoked_by_id,
                   changes={'from': 'tag.revoked_at', 'short': short}, label=short,
                   refs=[_ref('trap', tag.trap_id)] if tag.trap_id else [])


def _invitations(apps, events):
    GroupInvitation = apps.get_model('hornet', 'GroupInvitation')
    for invitation in GroupInvitation.objects.all().iterator():
        refs = [_ref('group', invitation.group_path), _ref('user', invitation.invitee_id)]
        events.add(invitation.created_at, 'invitation.sent', 'invitation', invitation.pk,
                   actor=invitation.invited_by_id,
                   changes={'from': 'groupinvitation.created_at', 'group': invitation.group_path},
                   refs=refs, label=invitation.group_name)
        if invitation.reminders_sent:
            # Only the last reminder is dated; who sent it is not recorded
            events.add(invitation.last_notified_at, 'invitation.reminded', 'invitation', invitation.pk,
                       changes={'from': 'groupinvitation.last_notified_at',
                                'reminder': invitation.reminders_sent},
                       refs=refs, label=invitation.group_name)
        if invitation.status in ('accepted', 'declined'):
            events.add(invitation.responded_at, f"invitation.{invitation.status}", 'invitation',
                       invitation.pk, actor=invitation.invitee_id,
                       changes={'from': 'groupinvitation.responded_at'}, refs=refs, label=invitation.group_name)
        elif invitation.status == 'cancelled':
            events.add(invitation.responded_at, 'invitation.cancelled', 'invitation', invitation.pk,
                       changes={'from': 'groupinvitation.responded_at'}, refs=refs, label=invitation.group_name)
        elif invitation.status == 'expired':
            events.add(invitation.created_at + INVITATION_VALIDITY, 'invitation.expired', 'invitation',
                       invitation.pk, changes={'from': 'groupinvitation.created_at'}, refs=refs, label=invitation.group_name)


def _exports(apps, events):
    from hornet.stats.base import REGISTRY

    StatExportJob = apps.get_model('hornet', 'StatExportJob')
    for job in StatExportJob.objects.all().iterator():
        statistic = REGISTRY.get(job.statistic)
        events.add(job.created_at, 'stats.export_emailed', 'statistic', job.statistic,
                   label=statistic.title if statistic else '',
                   actor=job.requester or None,
                   changes={'from': 'statexportjob.created_at', 'params': job.params},
                   refs=[_ref('export', job.token_hash[:16])])


def rebuild(apps, cutoff) -> list:
    """The events of the existing data dated from `cutoff` on, oldest first (unsaved)."""
    events = _Events(apps.get_model('audit', 'AuditEvent'), cutoff)
    for part in (_sightings_and_nests, _apiaries, _traps, _tags, _invitations, _exports):
        part(apps, events)
    events.items.sort(key=lambda event: (event.occurred_at, event.action, event.target_id))
    return events.items


def run(apps, cutoff, batch_size=1000) -> int:
    AuditEvent = apps.get_model('audit', 'AuditEvent')
    items = rebuild(apps, cutoff)
    AuditEvent.objects.bulk_create(items, batch_size=batch_size)
    return len(items)

