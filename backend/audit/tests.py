import csv
import io
import json
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.apps import apps as django_apps
from django.core import mail
from django.db import IntegrityError, InternalError, transaction
from django.test import TestCase, override_settings
from django.urls import URLPattern
from django.utils import timezone
from rest_framework.test import APIClient

from hornet import tests as hornet_tests
from hornet import urls as hornet_urls
from hornet.invitation_views import MyGroupInvitationViewSet
from hornet.models import Apiary, GroupInvitation, Hornet, Nest, Tag, Trap, TrapEvent

from . import backfill, recorder
from .actions import ACTIONS
from .models import AuditEvent

FakeUser = hornet_tests.FakeTrapUser


def _events(action=None, **filters):
    queryset = AuditEvent.objects.order_by('id')
    if action:
        queryset = queryset.filter(action=action)
    return list(queryset.filter(**filters))


# -- every endpoint that writes is audited ------------------------------------

# (router basename, view method, HTTP method) -> what it records. A new
# endpoint that writes fails `test_every_writing_endpoint_is_declared` until it
# is listed here, with its action or the reason it records none.
AUDITED = {
    ('hornet', 'create', 'post'): 'hornet.reported',
    ('hornet', 'update', 'put'): 'hornet.updated',
    ('hornet', 'partial_update', 'patch'): 'hornet.updated',
    ('hornet', 'destroy', 'delete'): 'hornet.deleted',
    ('hornet', 'archive', 'post'): 'hornet.archived',
    ('hornet', 'bulk_archive', 'post'): 'hornet.bulk_archived',
    ('nest', 'create', 'post'): 'nest.reported',
    ('nest', 'update', 'put'): 'nest.updated',
    ('nest', 'partial_update', 'patch'): 'nest.updated',
    ('nest', 'destroy', 'delete'): 'nest.deleted',
    ('nest', 'archive', 'post'): 'nest.archived',
    ('nest', 'bulk_archive', 'post'): 'nest.bulk_archived',
    ('nest', 'add_photos', 'post'): 'nest.photo_added',
    ('nest', 'delete_photo', 'delete'): 'nest.photo_removed',
    ('apiary', 'create', 'post'): 'apiary.created',
    ('apiary', 'update', 'put'): 'apiary.updated',
    ('apiary', 'partial_update', 'patch'): 'apiary.updated',
    ('apiary', 'destroy', 'delete'): 'apiary.deleted',
    ('apiary', 'photo', 'post'): 'apiary.photo_set',
    ('apiary', 'photo', 'delete'): 'apiary.photo_removed',
    ('apiary', 'sharing', 'put'): 'apiary.shared',
    ('apiary', 'sharing', 'delete'): 'apiary.unshared',
    ('apiary', 'owner', 'put'): 'apiary.owner_changed',
    ('trap', 'create', 'post'): 'trap.created',
    ('trap', 'update', 'put'): 'trap.updated',
    ('trap', 'partial_update', 'patch'): 'trap.updated',
    ('trap', 'destroy', 'delete'): 'trap.deleted',
    ('trap', 'photo', 'post'): 'trap.photo_set',
    ('trap', 'photo', 'delete'): 'trap.photo_removed',
    ('trap', 'events', 'post'): 'trap.event_recorded',
    ('trap', 'catches', 'post'): 'trap.visit_recorded',
    ('trap', 'delete_catches', 'delete'): 'trap.visit_deleted',
    ('trap', 'delegation', 'put'): 'trap.delegated',
    ('trap', 'delegation', 'delete'): 'trap.undelegated',
    ('trap', 'owner', 'put'): 'trap.owner_changed',
    ('trapevent', 'partial_update', 'patch'): 'trap.event_corrected',
    ('trapevent', 'destroy', 'delete'): 'trap.event_deleted',
    ('trapphoto', 'destroy', 'delete'): 'trap.journal_photo_removed',
    ('traptype', 'create', 'post'): 'trap_type.created',
    ('traptype', 'update', 'put'): 'trap_type.updated',
    ('traptype', 'partial_update', 'patch'): 'trap_type.updated',
    ('traptype', 'destroy', 'delete'): 'trap_type.deleted',
    ('species', 'create', 'post'): 'species.created',
    ('species', 'update', 'put'): 'species.updated',
    ('species', 'partial_update', 'patch'): 'species.updated',
    ('species', 'destroy', 'delete'): 'species.deleted',
    ('species', 'reorder', 'post'): 'species.reordered',
    ('tag', 'batch', 'post'): 'tag.batch_generated',
    ('tag', 'associate', 'post'): 'tag.associated',
    ('tagadmin', 'revoke', 'post'): 'tag.revoked',
    ('group', 'member', 'delete'): 'group.member_removed',
    ('group', 'member_admin', 'put'): 'group.admin_named',
    ('group', 'dismiss_admin', 'delete'): 'group.admin_dismissed',
    ('group-invitation', 'create', 'post'): 'invitation.sent',
    ('group-invitation', 'remind', 'post'): 'invitation.reminded',
    ('group-invitation', 'destroy', 'delete'): 'invitation.cancelled',
    ('my-group-invitation', 'accept', 'post'): 'invitation.accepted',
    ('my-group-invitation', 'decline', 'post'): 'invitation.declined',
}

NOT_AUDITED = {
    ('tag', 'sheet', 'post'): "signs a link to print existing tags: a read",
    ('tagadmin', 'sheet', 'post'): "signs a link to print existing tags: a read",
}

# Views outside the routers, by URL name
PLAIN_VIEWS = {
    'media': "read",
    'my-avatar': "the user's own profile photo, not a business action",
    'tag-sheet-pdf': "read",
    'stats-catalogue': "read",
    'stats-detail': "read",
    'stats-export-link': 'stats.export_link',
    'stats-email-link': 'stats.export_emailed',
    'stats-export-file': 'stats.export_downloaded',
    'stats-job': "read: describes an emailed export",
    'stats-job-file': 'stats.export_downloaded',
}

READ_METHODS = {'get', 'head', 'options'}
STANDARD = {'create': 'post', 'update': 'put', 'partial_update': 'patch', 'destroy': 'delete'}


class CoverageTests(TestCase):
    def test_every_writing_endpoint_is_declared(self):
        found = set()
        for _, viewset, basename in hornet_urls.router.registry:
            for name, method in STANDARD.items():
                if getattr(viewset, name, None):
                    found.add((basename, name, method))
            for extra in viewset.get_extra_actions():
                for method, name in extra.mapping.items():
                    if method not in READ_METHODS:
                        found.add((basename, name, method))
        declared = set(AUDITED) | set(NOT_AUDITED)
        self.assertEqual(found - declared, set(), "writing endpoints missing from AUDITED")
        self.assertEqual(declared - found, set(), "declared endpoints that no longer exist")

    def test_every_plain_view_is_declared(self):
        names = {p.name for p in hornet_urls.urlpatterns if isinstance(p, URLPattern)}
        self.assertEqual(names, set(PLAIN_VIEWS))

    def test_declared_actions_exist(self):
        for code in list(AUDITED.values()) + list(PLAIN_VIEWS.values()):
            if '.' in code and ' ' not in code:
                self.assertIn(code, ACTIONS)


# -- the recorder -----------------------------------------------------------

class RecorderTests(TestCase):
    def test_unknown_action_is_a_programming_error(self):
        with self.assertRaises(ValueError):
            recorder.record(None, 'nest.teleported', ('nest', 1))

    def test_events_cannot_be_changed(self):
        event = recorder.record(None, 'species.reordered', ('species', None))
        with self.assertRaises(InternalError), transaction.atomic():
            AuditEvent.objects.filter(pk=event.pk).update(action='nest.deleted')
        with self.assertRaises(InternalError), transaction.atomic():
            AuditEvent.objects.filter(pk=event.pk).delete()
        self.assertTrue(AuditEvent.objects.filter(pk=event.pk, action='species.reordered').exists())

    @override_settings(AUDIT_RETENTION_DAYS=365)
    def test_purge_removes_only_what_is_past_retention(self):
        now = timezone.now()
        old = recorder.record(None, 'species.reordered', ('species', None),
                              occurred_at=now - timedelta(days=366))
        kept = recorder.record(None, 'species.reordered', ('species', None),
                               occurred_at=now - timedelta(days=364))
        self.assertEqual(recorder.purge_expired(now), 1)
        self.assertEqual(list(AuditEvent.objects.values_list('pk', flat=True)), [kept.pk])
        self.assertFalse(AuditEvent.objects.filter(pk=old.pk).exists())

    def test_track_records_the_diff_and_nothing_when_unchanged(self):
        nest = Nest.objects.create(latitude=50.5, longitude=4.5, comments='a')
        with recorder.track(None, 'nest.updated', nest):
            Nest.objects.filter(pk=nest.pk).update(comments='b')
        with recorder.track(None, 'nest.updated', nest):
            pass
        [event] = _events('nest.updated')
        self.assertEqual(event.changes, {'comments': ['a', 'b']})
        self.assertEqual(event.refs, [f'nest:{nest.pk}'])

    def test_track_records_nothing_when_the_block_fails(self):
        nest = Nest.objects.create(latitude=50.5, longitude=4.5, comments='a')
        with self.assertRaises(IntegrityError):
            with recorder.track(None, 'nest.updated', nest):
                Nest.objects.filter(pk=nest.pk).update(comments='b')
                raise IntegrityError('boom')
        self.assertEqual(_events(), [])


# -- actions recorded by the API ----------------------------------------------

class ApiTestCase(hornet_tests.TrapTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user=user)
        return self.client


class NestAuditTests(ApiTestCase):
    def test_report_destroy_and_delete(self):
        response = self.as_user(self.owner_user).post(
            '/api/nests/', {'latitude': 50.5, 'longitude': 4.5, 'address': 'Rue Haute'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        nest_id = response.data['id']
        [reported] = _events('nest.reported')
        self.assertEqual(reported.target_label, 'Rue Haute')
        self.assertEqual(reported.actor, self.owner_guid)
        self.assertEqual(reported.actor_roles, ['trapper'])
        self.assertEqual(reported.changes['address'], 'Rue Haute')

        response = self.as_user(self.admin_user).patch(
            f'/api/nests/{nest_id}/', {'destroyed': True, 'comments': 'Détruit au perchoir'},
            format='json')
        self.assertEqual(response.status_code, 200, response.data)
        [destroyed] = _events('nest.destroyed')
        self.assertEqual(destroyed.actor, self.admin_guid)
        self.assertEqual(destroyed.changes['destroyed'], [False, True])
        self.assertEqual(destroyed.changes['comments'], [None, 'Détruit au perchoir'])

        self.assertEqual(self.as_user(self.admin_user).delete(f'/api/nests/{nest_id}/').status_code, 204)
        [deleted] = _events('nest.deleted')
        self.assertEqual((deleted.target_type, deleted.target_id), ('nest', str(nest_id)))
        # Still named once gone
        self.assertEqual(deleted.target_label, 'Rue Haute')
        self.assertEqual(deleted.changes['address'], 'Rue Haute')
        self.assertTrue(deleted.changes['destroyed'])

    def test_a_refused_update_records_nothing(self):
        nest = Nest.objects.create(latitude=50.5, longitude=4.5, destroyed=True)
        response = self.as_user(self.owner_user).patch(
            f'/api/nests/{nest.pk}/', {'destroyed': False}, format='json')
        self.assertIn(response.status_code, (400, 403))
        self.assertEqual(_events(), [])

    def test_bulk_archive_lists_every_object(self):
        year = timezone.now().year - 1
        nests = [hornet_tests._make_nest(year) for _ in range(3)]
        response = self.as_user(self.admin_user).post(f'/api/nests/bulk_archive/?year={year}')
        self.assertEqual(response.data['archived_count'], 3)
        [event] = _events('nest.bulk_archived')
        self.assertEqual(event.changes['count'], 3)
        self.assertEqual(set(event.refs), {f'nest:{nest.pk}' for nest in nests})
        # The history of one nest finds it
        self.assertEqual(AuditEvent.objects.filter(refs__contains=[f'nest:{nests[1].pk}']).count(), 1)


class TrapAuditTests(ApiTestCase):
    def test_delegation_owner_and_visit(self):
        client = self.as_user(self.owner_user)
        response = client.put(f'/api/traps/{self.trap.id}/delegation/',
                              {'group_path': self.group_path}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        [delegated] = _events('trap.delegated')
        self.assertEqual(delegated.changes['group_path'], [None, self.group_path])
        self.assertIn(f'group:{self.group_path}', delegated.refs)

        response = client.post(f'/api/traps/{self.trap.id}/catches/', {
            'performed_at': timezone.now().isoformat(),
            'items': json.dumps([{'species_slug': 'vespa-velutina', 'quantity': 4}]),
            'emptied': 'true', 'actions': json.dumps(['cleaning']),
        }, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        [visit] = _events('trap.visit_recorded')
        self.assertEqual(visit.changes['items'], [{'species': 'vespa-velutina', 'observed': 4}])
        self.assertEqual(visit.changes['actions'], ['cleaning'])
        batch = visit.changes['batch']
        self.assertIn(f'visit:{batch}', visit.refs)

        self.assertEqual(client.delete(f'/api/traps/{self.trap.id}/catches/{batch}/').status_code, 204)
        [deleted] = _events('trap.visit_deleted')
        self.assertEqual(len(deleted.changes['events']), 2)
        self.assertEqual(deleted.request_id is not None, True)

        response = self.as_user(self.admin_user).put(
            f'/api/traps/{self.trap.id}/owner/', {'owner_guid': str(self.member_guid)}, format='json')
        self.assertEqual(response.status_code, 200)
        [handed] = _events('trap.owner_changed')
        self.assertEqual(handed.changes, {'owner': [str(self.owner_guid), str(self.member_guid)]})
        self.assertEqual(handed.actor_roles, ['admin'])

        # Everything about the trap, in one query
        history = AuditEvent.objects.filter(refs__contains=[f'trap:{self.trap.id}'])
        self.assertEqual(history.count(), 4)

    def test_correcting_an_entry_keeps_what_was_typed(self):
        event = TrapEvent.objects.create(trap=self.trap, kind=TrapEvent.KIND_INSPECTION,
                                         performed_at=timezone.now(), performed_by=self.owner,
                                         comments='ok')
        response = self.as_user(self.owner_user).patch(
            f'/api/trap-events/{event.pk}/', {'comments': 'nid repéré'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        [corrected] = _events('trap.event_corrected')
        self.assertEqual(corrected.changes, {'comments': ['ok', 'nid repéré']})
        self.assertIn(f'trap:{self.trap.id}', corrected.refs)


class LifecycleAuditTests(ApiTestCase):
    """Create, update and delete of the other objects, end to end."""

    def test_trap(self):
        client = self.as_user(self.owner_user)
        response = client.post('/api/traps/', {
            'latitude': 50.51, 'longitude': 4.51, 'trap_type_slug': self.trap_type.slug,
            'installed_at': timezone.localdate().isoformat(), 'address': 'Chemin des Ruches',
        })
        self.assertEqual(response.status_code, 201, response.data)
        trap_id = response.data['id']
        client.patch(f'/api/traps/{trap_id}/', {'comments': 'sous le noyer'}, format='json')
        self.assertEqual(client.delete(f'/api/traps/{trap_id}/').status_code, 204)
        created, updated, deleted = _events()
        self.assertEqual(created.action, 'trap.created')
        self.assertEqual(created.changes['address'], 'Chemin des Ruches')
        self.assertTrue(any(r.startswith('trap_event:') for r in created.refs))
        self.assertEqual((updated.action, updated.changes), ('trap.updated', {'comments': ['', 'sous le noyer']}))
        self.assertEqual(deleted.action, 'trap.deleted')
        self.assertEqual(deleted.changes['events'], 1)

    def test_apiary(self):
        client = self.as_user(self.member_user)
        response = client.post('/api/apiaries/', {'latitude': 50.4, 'longitude': 4.4,
                                                  'afsca_number': '2.123.456.789'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        apiary_id = response.data['id']
        client.patch(f'/api/apiaries/{apiary_id}/', {'infestation_level': 3}, format='json')
        self.as_user(self.admin_user).put(f'/api/apiaries/{apiary_id}/owner/',
                                          {'owner_guid': str(self.owner_guid)}, format='json')
        self.assertEqual(self.as_user(self.admin_user).delete(f'/api/apiaries/{apiary_id}/').status_code, 204)
        self.assertEqual([e.action for e in _events()],
                         ['apiary.created', 'apiary.updated', 'apiary.owner_changed', 'apiary.deleted'])
        self.assertEqual(_events('apiary.updated')[0].changes, {'infestation_level': [None, 3]})
        handed = _events('apiary.owner_changed')[0]
        self.assertEqual(set(handed.refs), {f'apiary:{apiary_id}', f'user:{self.member_guid}',
                                            f'user:{self.owner_guid}'})
        self.assertEqual(_events('apiary.deleted')[0].changes['afsca_number'], '2.123.456.789')

    def test_referentials(self):
        client = self.as_user(self.admin_user)
        response = client.post('/api/trap-types/', {'slug': 'bottle', 'name': 'Bouteille'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        client.patch(f"/api/trap-types/{response.data['id']}/", {'name': 'Bouteille PET'}, format='json')
        client.delete(f"/api/trap-types/{response.data['id']}/")
        # Still in use: refused, nothing recorded
        self.assertEqual(client.delete(f'/api/trap-types/{self.trap_type.pk}/').status_code, 409)
        self.assertEqual([e.action for e in _events()],
                         ['trap_type.created', 'trap_type.updated', 'trap_type.deleted'])
        self.assertTrue(self.trap_type.__class__.objects.filter(pk=self.trap_type.pk).exists())

    def test_a_hornet_corrected_by_an_admin(self):
        hornet = Hornet.objects.create(latitude=50.5, longitude=4.5, direction=90)
        self.as_user(self.admin_user).patch(f'/api/hornets/{hornet.pk}/', {'direction': 120}, format='json')
        [event] = _events('hornet.updated')
        self.assertEqual(event.changes, {'direction': [90, 120]})


class GroupAuditTests(hornet_tests.GroupInvitationTestCase):
    def test_member_removed_and_invitation_withdrawn(self):
        from hornet.group_views import GroupViewSet
        from hornet.invitation_views import GroupInvitationViewSet

        self.kc.groups[f'{hornet_tests._ENA}/admin'] = {
            'id': 'gid-ena-admin', 'path': f'{hornet_tests._ENA}/admin', 'name': 'admin', 'attributes': {}}
        self.kc.members['gid-ena'] = [{'id': self.member.guid}]
        self.kc.members['gid-ena-admin'] = [{'id': self.aga.guid}]
        response = self._call(GroupViewSet, 'delete',
                               f'/api/groups/members/{self.member.guid}/?group_path={hornet_tests._ENA}',
                               {'delete': 'member'}, self.aga, guid=self.member.guid)
        self.assertEqual(response.status_code, 204)
        [removed] = _events('group.member_removed')
        self.assertEqual((removed.target_type, removed.target_id), ('group', hornet_tests._ENA))
        self.assertIn(f'user:{self.member.guid}', removed.refs)

        self._invite()
        invitation = GroupInvitation.objects.get()
        self._call(GroupInvitationViewSet, 'delete', '/', {'delete': 'destroy'}, self.aga, pk=invitation.pk)
        self.assertEqual(len(_events('invitation.cancelled')), 1)


@override_settings(**hornet_tests.TAG_SETTINGS)
class TagAuditTests(ApiTestCase):
    def test_batch_association_with_replacement_and_revocation(self):
        client = self.as_user(self.owner_user)
        values = [tag['value'] for tag in client.post('/api/tags/batch/', {'count': 2}, format='json').data]
        [batch] = _events('tag.batch_generated')
        self.assertEqual(batch.changes['count'], 2)
        first, second = (Tag.objects.get(value=value) for value in values)
        self.assertEqual(set(batch.refs), {f'tag:{first.pk}', f'tag:{second.pk}'})

        client.post(f'/api/tags/{first.value}/associate/', {'trap_id': self.trap.id}, format='json')
        response = client.post(f'/api/tags/{second.value}/associate/',
                               {'trap_id': self.trap.id, 'replace': True}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        replacing = _events('tag.associated')[-1]
        self.assertEqual(replacing.changes['replaced_tag'], first.pk)
        self.assertIn(f'tag:{first.pk}', replacing.refs)
        self.assertIn(f'trap:{self.trap.id}', replacing.refs)

        self.as_user(self.admin_user).post(f'/api/admin/tags/{second.pk}/revoke/')
        [revoked] = _events('tag.revoked')
        self.assertEqual(revoked.actor, self.admin_guid)


class ApiaryAuditTests(ApiTestCase):
    def test_sharing_is_recorded_once_per_change(self):
        apiary = Apiary.objects.create(latitude=50.5, longitude=4.5, owner=self.owner,
                                                    created_by=self.owner)
        client = self.as_user(self.admin_user)
        url = f'/api/apiaries/{apiary.pk}/sharing/'
        with patch('hornet.apiary_views.perms.allowed_share_groups', return_value=None):
            client.put(url, {'group_path': self.group_path}, format='json')
            client.put(url, {'group_path': self.group_path}, format='json')
            client.put(url, {'group_path': self.group_path, 'can_update': True}, format='json')
            client.delete(f'{url}?group_path={self.group_path}')
        self.assertEqual([e.action for e in _events()],
                         ['apiary.shared', 'apiary.share_changed', 'apiary.unshared'])
        self.assertEqual(_events('apiary.share_changed')[0].changes['can_update'], [False, True])


class InvitationAuditTests(hornet_tests.GroupInvitationTestCase):
    def test_lifecycle(self):
        response = self._invite()
        self.assertEqual(response.status_code, 201, response.data)
        [sent] = _events('invitation.sent')
        self.assertEqual(sent.actor, uuid.UUID(str(self.aga.guid)))
        self.assertIn(f'group:{hornet_tests._ENA}', sent.refs)
        self.assertIn(f'user:{self.invitee_guid}', sent.refs)

        invitation = GroupInvitation.objects.get()
        self._call(MyGroupInvitationViewSet, 'post', '/', {'post': 'accept'},
                   self.invitee, pk=invitation.pk)
        [accepted] = _events('invitation.accepted')
        self.assertEqual(str(accepted.actor), self.invitee_guid)

    def test_expiry_is_a_system_event_dated_when_validity_ended(self):
        self._invite()
        invitation = GroupInvitation.objects.get()
        created = timezone.now() - timedelta(days=40)
        GroupInvitation.objects.filter(pk=invitation.pk).update(created_at=created)
        GroupInvitation.expire_stale()
        GroupInvitation.expire_stale()
        [expired] = _events('invitation.expired')
        self.assertIsNone(expired.actor)
        self.assertEqual(expired.source, AuditEvent.SOURCE_SYSTEM)
        self.assertEqual(expired.occurred_at, created + GroupInvitation.VALIDITY)


@override_settings(EMAIL_CONFIGURED=True)
class StatsExportAuditTests(ApiTestCase):
    PARAMS = {'period': 'custom', 'from': '2025-03-01', 'to': '2025-03-31', 'compare': 'false'}

    def test_a_direct_link_and_its_downloads_share_a_reference(self):
        response = self.as_user(self.admin_user).post(
            '/api/stats/traps-catches/export/', {'format': 'csv', 'params': self.PARAMS}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        anonymous = APIClient()
        anonymous.get(response.data['url'])
        anonymous.get(response.data['url'])
        [asked] = _events('stats.export_link')
        downloads = _events('stats.export_downloaded')
        self.assertEqual(asked.actor, self.admin_guid)
        self.assertEqual(len(downloads), 2)
        self.assertEqual({d.actor for d in downloads}, {None})
        export_ref = next(r for r in asked.refs if r.startswith('export:'))
        self.assertTrue(all(export_ref in d.refs for d in downloads))
        # The token opens the file: it is never kept
        token = response.data['url'].rstrip('/').rsplit('/', 1)[1]
        self.assertNotIn(token, json.dumps([e.refs for e in _events()]))

    def test_an_emailed_link_keeps_no_address(self):
        user = self.admin_user
        user.token_info = {**user.token_info, 'email': 'jeanne@example.org', 'name': 'Jeanne'}
        response = self.as_user(user).post('/api/stats/traps-catches/email-link/',
                                           {'params': self.PARAMS}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        token = mail.outbox[-1].body.split('/export/')[1].split()[0]
        APIClient().get(f'/api/stats/exports/{token}/csv/')
        [asked] = _events('stats.export_emailed')
        [download] = _events('stats.export_downloaded')
        self.assertEqual(download.changes, {'format': 'csv', 'via': 'email', 'download': 1})
        export_ref = next(r for r in asked.refs if r.startswith('export:'))
        self.assertIn(export_ref, download.refs)
        self.assertNotIn('example.org', json.dumps([e.changes for e in _events()]))


# -- reading the trail --------------------------------------------------------

class ReadApiTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        patcher = patch('hornet_finder_api.utils.describe_users', side_effect=lambda guids: {
            str(g): ({'name': None, 'deleted': True} if str(g) == str(self.member_guid)
                     else {'name': f'Name {str(g)[:4]}', 'deleted': False}) for g in guids})
        patcher.start()
        self.addCleanup(patcher.stop)
        from django.core.cache import cache
        cache.clear()

    def _record(self, user, action, target, **kwargs):
        request = type('R', (), {'user': user})()
        return recorder.record(request, action, target, **kwargs)

    def test_platform_admins_only(self):
        for user in (self.owner_user, self.member_user, self.group_admin_user):
            self.assertEqual(self.as_user(user).get('/api/audit/events/').status_code, 403)
        self.assertIn(APIClient().get('/api/audit/events/').status_code, (401, 403))
        self.assertEqual(self.as_user(self.admin_user).get('/api/audit/events/').status_code, 200)

    def test_read_only(self):
        event = self._record(self.owner_user, 'nest.reported', ('nest', 1))
        client = self.as_user(self.admin_user)
        self.assertEqual(client.post('/api/audit/events/', {}, format='json').status_code, 405)
        self.assertEqual(client.delete(f'/api/audit/events/{event.pk}/').status_code, 405)

    def test_filters_and_names(self):
        self._record(self.owner_user, 'nest.reported', ('nest', 1))
        self._record(self.member_user, 'trap.updated', ('trap', 7), refs=['group:/beekeepers/ena'])
        self._record(self.admin_user, 'trap.owner_changed', ('trap', 8))
        client = self.as_user(self.admin_user)

        def actions(query):
            response = client.get(f'/api/audit/events/?{query}')
            self.assertEqual(response.status_code, 200, response.data)
            return [row['action'] for row in response.data['results']]

        self.assertEqual(actions(''), ['trap.owner_changed', 'trap.updated', 'nest.reported'])
        self.assertEqual(actions('domain=trap'), ['trap.owner_changed', 'trap.updated'])
        self.assertEqual(actions('action=nest.reported,trap.updated'), ['trap.updated', 'nest.reported'])
        self.assertEqual(actions('ref=trap:7'), ['trap.updated'])
        self.assertEqual(actions('ref=group:/beekeepers/ena'), ['trap.updated'])
        self.assertEqual(actions(f'actor={self.owner_guid}'), ['nest.reported'])
        self.assertEqual(actions(f'since={timezone.localdate() + timedelta(days=1)}'), [])
        self.assertEqual(actions(f'until={timezone.localdate()}'),
                         ['trap.owner_changed', 'trap.updated', 'nest.reported'])
        self.assertEqual(client.get('/api/audit/events/?actor=nope').status_code, 400)

        rows = client.get('/api/audit/events/').data['results']
        by_action = {row['action']: row for row in rows}
        self.assertEqual(by_action['nest.reported']['actor_name'], f'Name {str(self.owner_guid)[:4]}')
        self.assertTrue(by_action['trap.updated']['actor_deleted'])
        self.assertEqual(by_action['trap.updated']['domain'], 'trap')

    def test_cursor_pagination(self):
        for index in range(5):
            self._record(self.owner_user, 'nest.reported', ('nest', index))
        client = self.as_user(self.admin_user)
        first = client.get('/api/audit/events/?page_size=3').data
        self.assertEqual([r['target_id'] for r in first['results']], ['4', '3', '2'])
        second = client.get(first['next']).data
        self.assertEqual([r['target_id'] for r in second['results']], ['1', '0'])

    def test_catalogue(self):
        data = self.as_user(self.admin_user).get('/api/audit/events/catalogue/').data
        self.assertEqual(len(data['actions']), len(ACTIONS))
        self.assertIn('trap', data['domains'])
        self.assertEqual(data['retention_days'], 365)

    def test_csv_export_through_a_signed_link_is_itself_recorded(self):
        self._record(self.owner_user, 'nest.reported', ('nest', 1), changes={'address': 'Rue Haute'})
        self._record(self.owner_user, 'trap.updated', ('trap', 2))
        client = self.as_user(self.admin_user)
        self.assertEqual(client.post('/api/audit/events/export-link/', {'filters': {'actor': 'nope'}},
                                     format='json').status_code, 400)
        link = client.post('/api/audit/events/export-link/',
                           {'filters': {'domain': 'nest', 'unknown': 'x'}}, format='json').data
        self.assertTrue(link['filename'].endswith('.csv'))
        # Opened without a session, as the browser of a home-screen app does
        response = APIClient().get(link['url'])
        self.assertEqual(response.status_code, 200)
        text = b''.join(response.streaming_content).decode('utf-8')
        rows = list(csv.reader(io.StringIO(text.lstrip('\ufeff')), delimiter=';'))
        self.assertEqual(rows[0][:2], ['occurred_at', 'action'])
        self.assertEqual([row[1] for row in rows[1:]], ['nest.reported'])
        self.assertIn('Rue Haute', rows[1][-1])
        [exported] = _events('audit.exported')
        self.assertEqual(exported.changes, {'filters': {'domain': 'nest'}, 'rows': 1})
        self.assertEqual(exported.actor, self.admin_guid)

        self.assertEqual(APIClient().get('/api/audit/export/forged/').status_code, 404)
        self.assertEqual(self.as_user(self.owner_user).post(
            '/api/audit/events/export-link/', {}, format='json').status_code, 403)

    def test_same_request_and_people_named(self):
        request = type('R', (), {'user': self.admin_user})()
        first = recorder.record(request, 'trap.owner_changed', ('trap', 8),
                                changes={'owner': [str(self.owner_guid), str(self.member_guid)]})
        recorder.record(request, 'tag.revoked', ('tag', 3))
        self._record(self.admin_user, 'tag.revoked', ('tag', 4))
        client = self.as_user(self.admin_user)
        rows = client.get(f'/api/audit/events/?request={first.request_id}').data['results']
        self.assertEqual([row['target_id'] for row in rows], ['3', '8'])
        people = rows[1]['people']
        self.assertEqual(set(people), {str(self.admin_guid), str(self.owner_guid), str(self.member_guid)})
        self.assertTrue(people[str(self.member_guid)]['deleted'])
        self.assertEqual(people[str(self.owner_guid)]['name'], f'Name {str(self.owner_guid)[:4]}')
        self.assertEqual(client.get('/api/audit/events/?request=x').status_code, 400)


# -- rebuilding the past ------------------------------------------------------

class BackfillTests(hornet_tests.TrapTestCase):
    def _at(self, model, pk, **fields):
        model.objects.filter(pk=pk).update(**fields)

    def test_rebuilds_only_dated_facts_of_the_retention_period(self):
        now = timezone.now()
        cutoff = now - timedelta(days=365)
        recent, old = now - timedelta(days=10), now - timedelta(days=400)

        hornet = Hornet.objects.create(latitude=50.5, longitude=4.5, direction=0, created_by=self.owner)
        self._at(Hornet, hornet.pk, created_at=recent, archived=True, archived_at=recent + timedelta(days=1))
        stale = Hornet.objects.create(latitude=50.5, longitude=4.5, direction=0)
        self._at(Hornet, stale.pk, created_at=old)

        # Destroyed and handed over: nothing tells when, nor who destroyed it
        nest = Nest.objects.create(latitude=50.5, longitude=4.5, created_by=self.owner,
                                   destroyed=True, destroyed_at=recent)
        self._at(Nest, nest.pk, created_at=recent)

        # The trap was created by the owner, then handed over to the member
        opening = TrapEvent.objects.create(trap=self.trap, kind=TrapEvent.KIND_INSTALLATION,
                                           performed_at=recent, performed_by=self.owner)
        self._at(TrapEvent, opening.pk, created_at=recent)
        self._at(Trap, self.trap.pk, created_at=recent, owner=self.member)
        batch = uuid.uuid4()
        for kind, species in ((TrapEvent.KIND_CATCH, self.velutina), (TrapEvent.KIND_CLEANING, None)):
            entry = TrapEvent.objects.create(
                trap=self.trap, kind=kind, performed_at=recent, performed_by=self.member, batch=batch,
                species=species, quantity=3 if species else None,
                emptied=True if species else None, bycatch_counted=True if species else None)
            self._at(TrapEvent, entry.pk, created_at=recent + timedelta(days=2))

        events = backfill.rebuild(django_apps, cutoff)
        summary = sorted((e.action, e.target_id, str(e.actor) if e.actor else None) for e in events)
        self.assertEqual(summary, sorted([
            ('hornet.reported', str(hornet.pk), str(self.owner_guid)),
            ('hornet.archived', str(hornet.pk), None),
            ('nest.reported', str(nest.pk), str(self.owner_guid)),
            ('trap.created', str(self.trap.pk), str(self.owner_guid)),
            ('trap.visit_recorded', str(self.trap.pk), str(self.member_guid)),
        ]))
        self.assertTrue(all(e.source == 'backfill' for e in events))
        visit = next(e for e in events if e.action == 'trap.visit_recorded')
        self.assertEqual(visit.changes['events'], 2)
        self.assertIn(f'visit:{batch}', visit.refs)

        self.assertEqual(backfill.run(django_apps, cutoff), 5)
        self.assertEqual(AuditEvent.objects.filter(source='backfill').count(), 5)

    def test_invitations_and_tags(self):
        recent = timezone.now() - timedelta(days=3)
        invitation = GroupInvitation.objects.create(
            group_path='/beekeepers/ena', group_name='ena', invitee=self.member, invited_by=self.owner,
            status=GroupInvitation.STATUS_CANCELLED, responded_at=recent + timedelta(hours=1))
        self._at(GroupInvitation, invitation.pk, created_at=recent)
        tags = Tag.objects.bulk_create([Tag(value=f'01{i:08d}xx', key_index=1, generated_by=self.owner)
                                        for i in range(3)])
        Tag.objects.filter(pk=tags[0].pk).update(trap=self.trap, associated_by=self.owner,
                                                 associated_at=recent)

        events = backfill.rebuild(django_apps, timezone.now() - timedelta(days=365))
        actions = sorted(e.action for e in events)
        # (and the trap of the fixtures, created now)
        self.assertEqual(actions, ['invitation.cancelled', 'invitation.sent', 'tag.associated',
                                   'tag.batch_generated', 'trap.created'])
        cancelled = next(e for e in events if e.action == 'invitation.cancelled')
        self.assertIsNone(cancelled.actor)
        batch = next(e for e in events if e.action == 'tag.batch_generated')
        self.assertEqual(batch.changes['count'], 3)
