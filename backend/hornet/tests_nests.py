"""The journal of a nest: report, visit, destruction, and the lists of the module."""

import importlib
import shutil
import tempfile
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.apps import apps
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from audit.models import AuditEvent
from .models import Apiary, Nest, NestEvent, NestPhoto, PushNotification, PushSubscription, User
from .tests import FakeTrapUser, _image_file
from .pending import pending_view
from .views import NestViewSet

_MEDIA = Path(tempfile.mkdtemp(prefix='nest-journal-tests-'))


@override_settings(MEDIA_ROOT=_MEDIA)
class NestJournalTestCase(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(_MEDIA, ignore_errors=True)

    def setUp(self):
        self.factory = APIRequestFactory()
        patcher = patch('hornet.serializers.get_user_display_name', return_value='Tester')
        patcher.start()
        self.addCleanup(patcher.stop)

        self.reporter = User.objects.create(guid=uuid.uuid4(), group_paths=['/trappers'])
        self.reporter_user = FakeTrapUser(['trapper'], self.reporter.guid, ['/trappers'])
        self.stranger_user = FakeTrapUser(['trapper'], uuid.uuid4(), ['/trappers'])
        self.hunter_user = FakeTrapUser(['hunter'], uuid.uuid4(), ['/hunters'])
        self.coordinator = User.objects.create(guid=uuid.uuid4(), group_paths=['/hunters/admin'])
        self.coordinator_user = FakeTrapUser(['hunter'], self.coordinator.guid, ['/hunters/admin'])
        self.admin_user = FakeTrapUser(['admin'], uuid.uuid4(), ['/admins'])
        self.beekeeper = User.objects.create(guid=uuid.uuid4(), group_paths=['/beekeepers'])
        self.beekeeper_user = FakeTrapUser(['beekeeper'], self.beekeeper.guid, ['/beekeepers'])

        self.nest = self.report(self.reporter_user)

    # -- helpers -----------------------------------------------------------------

    def call(self, method, path, actions, user, data=None, fmt='json', **kwargs):
        request = getattr(self.factory, method)(path, data, format=fmt) if data is not None \
            else getattr(self.factory, method)(path)
        force_authenticate(request, user=user)
        return NestViewSet.as_view(actions)(request, **kwargs)

    def report(self, user, **data):
        response = self.call('post', '/nests/', {'post': 'create'}, user,
                             {'latitude': 50.5, 'longitude': 4.5, **data})
        self.assertEqual(response.status_code, 201, response.data)
        return Nest.objects.get(pk=response.data['id'])

    def record(self, user, nest=None, fmt='json', **data):
        nest = nest or self.nest
        return self.call('post', f'/nests/{nest.pk}/events/', {'post': 'events'}, user, data, fmt, pk=nest.pk)

    def delete_event(self, user, event):
        return self.call('delete', f'/nests/{event.nest_id}/events/{event.pk}/', {'delete': 'delete_event'},
                         user, pk=event.nest_id, event_id=event.pk)

    def get(self, user, path, action, **kwargs):
        return self.call('get', path, {'get': action}, user, **kwargs)


class ReportTests(NestJournalTestCase):
    def test_a_report_opens_the_journal(self):
        self.assertEqual(self.nest.status, Nest.STATUS_REPORTED)
        event = self.nest.events.get()
        self.assertEqual((event.kind, event.performed_by_id), (NestEvent.KIND_REPORT, self.reporter.guid))
        self.assertIsNone(event.alerted_at)  # its notifications are pending

    def test_an_empty_nest_is_recorded_as_abandoned(self):
        nest = self.report(self.reporter_user, state='empty', height_class='10-20')
        self.assertEqual((nest.status, nest.height_class), (Nest.STATUS_ABANDONED, '10-20'))
        self.assertEqual(nest.events.get().outcome, NestEvent.OUTCOME_EMPTY)

    def test_the_status_is_not_a_form_field(self):
        nest = self.report(self.reporter_user, status='destroyed')
        self.assertEqual(nest.status, Nest.STATUS_REPORTED)


class ContactTests(NestJournalTestCase):
    """The reporter's phone number and the private comment: the coordinators and the reporter only."""

    def setUp(self):
        super().setUp()
        self.nest = self.report(self.reporter_user, contact_phone=' +32 470 12 34 56 ',
                                private_comments='Appeler après 18 h', comments='Dans la haie')

    def detail(self, user):
        return self.get(user, f'/nests/{self.nest.pk}/', 'retrieve', pk=self.nest.pk)

    def test_the_reporter_leaves_a_number_and_a_note(self):
        self.assertEqual((self.nest.contact_phone, self.nest.private_comments),
                         ('+32 470 12 34 56', 'Appeler après 18 h'))
        for user in (self.reporter_user, self.coordinator_user, self.admin_user):
            data = self.detail(user).data
            self.assertEqual((data['contact_phone'], data['private_comments']),
                             ('+32 470 12 34 56', 'Appeler après 18 h'))

    def test_others_do_not_read_them(self):
        data = self.detail(self.beekeeper_user).data
        self.assertEqual(data['comments'], 'Dans la haie')
        self.assertNotIn('contact_phone', data)
        self.assertNotIn('private_comments', data)
        rows = self.get(self.hunter_user, '/nests/managed/', 'managed').data['results']
        row = next(row for row in rows if row['id'] == self.nest.pk)
        self.assertNotIn('contact_phone', row)
        self.assertNotIn('private_comments', row)

    def test_a_number_is_checked(self):
        for wrong in ('12345', 'call me', '+32 470 12 34 56 78 90 12'):
            response = self.call('post', '/nests/', {'post': 'create'}, self.reporter_user,
                                 {'latitude': 50.5, 'longitude': 4.5, 'contact_phone': wrong})
            self.assertEqual(response.status_code, 400, wrong)
            self.assertIn('contact_phone', response.data)

    def test_a_coordinator_edits_them_and_the_trail_keeps_the_note_only(self):
        response = self.call('patch', f'/nests/{self.nest.pk}/', {'patch': 'partial_update'}, self.coordinator_user,
                             {'contact_phone': '081 23 45 67', 'private_comments': 'Rappelé, RDV jeudi'},
                             pk=self.nest.pk)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['contact_phone'], '081 23 45 67')
        event = AuditEvent.objects.filter(action='nest.updated').latest('id')
        self.assertEqual(event.changes['private_comments'], ['Appeler après 18 h', 'Rappelé, RDV jeudi'])
        self.assertNotIn('contact_phone', event.changes)
        self.assertNotIn('081', str(event.changes))


class VisitTests(NestJournalTestCase):
    def test_a_coordinator_confirms_a_nest(self):
        response = self.record(self.coordinator_user, kind='visit', outcome='active', nest_type='secondary',
                               height_class='5-10', size_class='30-50', comments='Dans le chêne')
        self.assertEqual(response.status_code, 201, response.data)
        self.nest.refresh_from_db()
        self.assertEqual((self.nest.status, self.nest.nest_type, self.nest.height_class, self.nest.size_class),
                         (Nest.STATUS_CONFIRMED, 'secondary', '5-10', '30-50'))
        visit = self.nest.events.get(kind='visit')
        self.assertEqual(visit.details, {'nest_type': 'secondary', 'height_class': '5-10', 'size_class': '30-50'})
        self.assertEqual(response.data['status'], 'confirmed')
        self.assertEqual([e['kind'] for e in response.data['events']], ['visit', 'report'])
        audit_event = AuditEvent.objects.get(action='nest.visited')
        self.assertEqual(audit_event.changes['status'], ['reported', 'confirmed'])
        self.assertIn(f'nest_event:{visit.pk}', audit_event.refs)

    def test_a_verification_says_what_it_relied_on(self):
        response = self.record(self.coordinator_user, fmt='multipart', kind='visit', outcome='active',
                               basis=['call', 'photos', 'call'])
        self.assertEqual(response.status_code, 201, response.data)
        visit = self.nest.events.get(kind='visit')
        self.assertEqual(visit.details, {'basis': ['call', 'photos']})
        # Nothing of it on the nest itself
        self.nest.refresh_from_db()
        self.assertEqual(self.nest.nest_type, '')
        self.assertEqual(AuditEvent.objects.get(action='nest.visited').changes['basis'], ['call', 'photos'])
        self.assertEqual(self.record(self.coordinator_user, kind='visit', outcome='active',
                                     basis=['telepathy']).status_code, 400)

    def test_another_species_or_nothing_found_rejects_it(self):
        for outcome in ('other_species', 'not_found'):
            nest = self.report(self.reporter_user)
            self.record(self.coordinator_user, nest, kind='visit', outcome=outcome)
            nest.refresh_from_db()
            self.assertEqual(nest.status, Nest.STATUS_REJECTED)

    def test_an_empty_nest_found_at_the_visit_is_abandoned(self):
        self.record(self.coordinator_user, kind='visit', outcome='empty')
        self.nest.refresh_from_db()
        self.assertEqual(self.nest.status, Nest.STATUS_ABANDONED)

    def test_a_visit_needs_an_outcome(self):
        response = self.record(self.coordinator_user, kind='visit')
        self.assertEqual(response.status_code, 400)
        self.assertIn('outcome', response.data)

    def test_only_the_coordinators_visit(self):
        for user in (self.hunter_user, self.reporter_user, self.beekeeper_user):
            self.assertEqual(self.record(user, kind='visit', outcome='active').status_code, 403)
        self.assertEqual(self.record(self.admin_user, kind='visit', outcome='active').status_code, 201)

    def test_a_visit_takes_photos(self):
        response = self.record(self.coordinator_user, fmt='multipart', kind='visit', outcome='active',
                               photos=[_image_file('v.jpg', (400, 300))])
        self.assertEqual(response.status_code, 201, response.data)
        photo = NestPhoto.objects.get(nest=self.nest)
        self.assertEqual(photo.event.kind, NestEvent.KIND_VISIT)


class DestructionTests(NestJournalTestCase):
    def test_the_reporter_declares_the_destruction(self):
        day = timezone.now() - timedelta(days=2)
        response = self.record(self.reporter_user, kind='destruction', performed_at=day.isoformat(),
                               actor='fixmystreet', fixmystreet_ref='123456', means=['removed', 'pole', 'pole'])
        self.assertEqual(response.status_code, 201, response.data)
        self.nest.refresh_from_db()
        self.assertEqual(self.nest.status, Nest.STATUS_DESTROYED)
        self.assertTrue(self.nest.destroyed)
        self.assertEqual(self.nest.destroyed_at, day)
        event = self.nest.events.get(kind='destruction')
        self.assertEqual((event.actor, event.fixmystreet_ref, event.means), ('fixmystreet', '123456', ['pole', 'removed']))
        self.assertTrue(AuditEvent.objects.filter(action='nest.destroyed').exists())

    def test_a_nest_is_destroyed_once(self):
        self.record(self.coordinator_user, kind='destruction')
        self.assertEqual(self.record(self.reporter_user, kind='destruction').status_code, 403)

    def test_others_do_not_declare_it(self):
        self.assertEqual(self.record(self.hunter_user, kind='destruction').status_code, 403)
        # A trapper does not even see the nest of someone else
        self.assertEqual(self.record(self.stranger_user, kind='destruction').status_code, 404)

    def test_the_date_is_not_in_the_future(self):
        later = timezone.now() + timedelta(days=1)
        self.assertEqual(self.record(self.reporter_user, kind='destruction',
                                     performed_at=later.isoformat()).status_code, 400)

    def test_unknown_means_are_refused(self):
        self.assertEqual(self.record(self.coordinator_user, kind='destruction', means=['steam']).status_code, 400)

    def test_means_come_in_a_form_too(self):
        response = self.record(self.coordinator_user, fmt='multipart', kind='destruction', means=['pole', 'lift'])
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(self.nest.events.get(kind='destruction').means, ['lift', 'pole'])

    def test_the_old_destroyed_flag_goes_to_the_journal(self):
        response = self.call('patch', f'/nests/{self.nest.pk}/', {'patch': 'partial_update'},
                             self.coordinator_user, {'destroyed': True}, pk=self.nest.pk)
        self.assertEqual(response.status_code, 200)
        self.nest.refresh_from_db()
        self.assertEqual(self.nest.status, Nest.STATUS_DESTROYED)
        event = self.nest.events.get(kind='destruction')
        self.assertEqual(event.performed_at, self.nest.destroyed_at)
        # A corrected date moves the event
        given = timezone.now() - timedelta(days=5)
        self.call('patch', f'/nests/{self.nest.pk}/', {'patch': 'partial_update'}, self.coordinator_user,
                  {'destroyed_at': given.isoformat()}, pk=self.nest.pk)
        event.refresh_from_db()
        self.nest.refresh_from_db()
        self.assertEqual((event.performed_at, self.nest.destroyed_at), (given, given))


class JournalTests(NestJournalTestCase):
    def test_removing_the_destruction_brings_the_status_back(self):
        self.record(self.coordinator_user, kind='visit', outcome='active')
        self.record(self.reporter_user, kind='destruction')
        destruction = self.nest.events.get(kind='destruction')
        # The reporter takes back what they declared, not the visit
        self.assertEqual(self.delete_event(self.reporter_user, self.nest.events.get(kind='visit')).status_code, 403)
        response = self.delete_event(self.reporter_user, destruction)
        self.assertEqual(response.status_code, 200)
        self.nest.refresh_from_db()
        self.assertEqual((self.nest.status, self.nest.destroyed, self.nest.destroyed_at),
                         (Nest.STATUS_CONFIRMED, False, None))
        self.assertTrue(AuditEvent.objects.filter(action='nest.event_deleted').exists())

    def test_the_report_stays(self):
        report = self.nest.events.get()
        self.assertEqual(self.delete_event(self.coordinator_user, report).status_code, 403)

    def test_only_an_admin_reactivates(self):
        self.record(self.coordinator_user, kind='visit', outcome='other_species')
        self.assertEqual(self.record(self.coordinator_user, kind='reactivation').status_code, 403)
        self.assertEqual(self.record(self.admin_user, kind='reactivation').status_code, 201)
        self.nest.refresh_from_db()
        self.assertEqual(self.nest.status, Nest.STATUS_REPORTED)
        # Nothing to reactivate on an open nest
        self.assertEqual(self.record(self.admin_user, kind='reactivation').status_code, 403)

    def test_events_follow_their_date_not_their_recording(self):
        self.record(self.coordinator_user, kind='visit', outcome='active')
        # A destruction declared afterwards, but dated before the report: the visit still comes last
        Nest.objects.filter(pk=self.nest.pk).update(created_at=timezone.now() - timedelta(days=10))
        self.nest.events.filter(kind='report').update(performed_at=timezone.now() - timedelta(days=10))
        self.record(self.reporter_user, kind='destruction',
                    performed_at=(timezone.now() - timedelta(days=5)).isoformat())
        self.nest.refresh_from_db()
        self.assertEqual(self.nest.status, Nest.STATUS_CONFIRMED)

    def test_the_reporter_reads_the_journal_without_names(self):
        self.record(self.coordinator_user, kind='visit', outcome='active')
        response = self.get(self.reporter_user, f'/nests/{self.nest.pk}/', 'retrieve', pk=self.nest.pk)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([e['performed_by'] for e in response.data['events']], [None, None])
        response = self.get(self.hunter_user, f'/nests/{self.nest.pk}/', 'retrieve', pk=self.nest.pk)
        self.assertEqual(response.data['events'][0]['performed_by']['display_name'], 'Tester')
        self.assertEqual(self.get(self.stranger_user, f'/nests/{self.nest.pk}/', 'retrieve',
                                  pk=self.nest.pk).status_code, 404)


class ListTests(NestJournalTestCase):
    def setUp(self):
        super().setUp()
        self.other = self.report(self.hunter_user)
        self.record(self.coordinator_user, self.other, kind='visit', outcome='active')
        self.old = self.report(self.hunter_user)
        Nest.objects.filter(pk=self.old.pk).update(created_at=timezone.now() - timedelta(days=400))

    def ids(self, response):
        return [item['id'] for item in response.data['results']]

    def test_the_list_holds_the_season(self):
        response = self.get(self.hunter_user, '/nests/managed/', 'managed')
        self.assertEqual(self.ids(response), [self.other.pk, self.nest.pk])
        self.assertEqual(response.data['count'], 2)

    def test_a_trapper_lists_their_own_reports(self):
        response = self.get(self.reporter_user, '/nests/managed/?show=all', 'managed')
        self.assertEqual(self.ids(response), [self.nest.pk])

    def test_filters(self):
        self.assertEqual(self.ids(self.get(self.hunter_user, '/nests/managed/?status=confirmed', 'managed')),
                         [self.other.pk])
        self.assertEqual(self.ids(self.get(self.hunter_user, f'/nests/managed/?q=%23{self.nest.pk}', 'managed')),
                         [self.nest.pk])
        self.assertEqual(self.ids(self.get(self.hunter_user, '/nests/managed/?ordering=created_at', 'managed')),
                         [self.nest.pk, self.other.pk])

    def test_todo_of_a_coordinator(self):
        response = self.get(self.coordinator_user, '/nests/todo/', 'todo')
        self.assertEqual([n['id'] for n in response.data['to_verify']], [self.nest.pk])
        self.assertEqual([n['id'] for n in response.data['confirmed']], [self.other.pk])
        self.assertNotIn('near_apiaries', response.data)

    def test_todo_of_a_beekeeper_with_an_apiary_nearby(self):
        Apiary.objects.create(latitude=50.505, longitude=4.5, owner=self.beekeeper)  # about 560 m north
        Apiary.objects.create(latitude=50.6, longitude=4.6, owner=self.beekeeper)  # about 13 km away
        response = self.get(self.beekeeper_user, '/nests/todo/', 'todo')
        self.assertEqual(sorted(n['id'] for n in response.data['near_apiaries']), sorted([self.nest.pk, self.other.pk]))
        self.assertNotIn('to_verify', response.data)

    def pending(self, user):
        request = self.factory.get('/api/pending/')
        force_authenticate(request, user=user)
        return pending_view(request).data['nests']

    def test_the_nests_badge_counts_what_waits(self):
        # The coordinator: one to verify, one to destroy; their own report only waits
        self.assertEqual(self.pending(self.coordinator_user), 2)
        Apiary.objects.create(latitude=50.505, longitude=4.5, owner=self.beekeeper)
        self.assertEqual(self.pending(self.beekeeper_user), 2)
        # A reporter has nothing to do but wait
        self.assertEqual(self.pending(self.reporter_user), 0)
        self.assertEqual(self.pending(self.hunter_user), 0)

    def test_the_nests_badge_counts_a_nest_once(self):
        # The same reported nest is to verify AND near the coordinator's apiary: one nest, one count
        Apiary.objects.create(latitude=50.505, longitude=4.5, owner=self.coordinator)
        todo = self.get(self.coordinator_user, '/nests/todo/', 'todo').data
        self.assertIn(self.nest.pk, [n['id'] for n in todo['to_verify']])
        self.assertIn(self.nest.pk, [n['id'] for n in todo['near_apiaries']])
        distinct = {n['id'] for name in ('to_verify', 'confirmed', 'near_apiaries') for n in todo.get(name, [])}
        self.assertEqual(self.pending(self.coordinator_user), len(distinct))

    def test_todo_of_a_trapper(self):
        response = self.get(self.reporter_user, '/nests/todo/', 'todo')
        self.assertEqual(list(response.data), ['mine'])
        self.assertEqual([n['id'] for n in response.data['mine']], [self.nest.pk])


class OwnerTests(NestJournalTestCase):
    """Handing the follow-up of a nest over: platform admins, and the trappers' coordinators for their own nests."""

    def setUp(self):
        super().setUp()
        self.trapper = User.objects.create(guid=uuid.uuid4(), group_paths=['/trappers'])
        self.trapper_user = FakeTrapUser(['trapper'], self.trapper.guid, ['/trappers'])
        self.trappers_admin = User.objects.create(guid=uuid.uuid4(), group_paths=['/trappers/admin'])
        self.trappers_admin_user = FakeTrapUser(['trapper'], self.trappers_admin.guid, ['/trappers/admin'])
        # The roster of /trappers in Keycloak: direct members, and the coordinator in /trappers/admin
        groups = {'/trappers': {'id': 'trappers'}, '/trappers/admin': {'id': 'trappers-admin'}}
        members = {
            'trappers': [{'id': str(g), 'firstName': first, 'lastName': last} for g, first, last in (
                (self.reporter.guid, 'Zoé', 'Martin'), (self.trapper.guid, 'Karim', 'B.'))],
            'trappers-admin': [{'id': str(self.trappers_admin.guid), 'firstName': 'Sophie', 'lastName': 'L.'}],
        }
        for name, effect in (('get_group_by_path', groups.get),
                             ('get_group_members', lambda group_id, *args, **kwargs: members[group_id])):
            patcher = patch(f'hornet_finder_api.utils.{name}', side_effect=effect)
            patcher.start()
            self.addCleanup(patcher.stop)

    def hand_over(self, user, guid, nest=None):
        nest = nest or self.nest
        return self.call('put', f'/nests/{nest.pk}/owner/', {'put': 'owner'}, user,
                         {'owner_guid': str(guid)}, pk=nest.pk)

    def choices(self, user, nest=None):
        nest = nest or self.nest
        return self.get(user, f'/nests/{nest.pk}/owner/', 'owner', pk=nest.pk)

    def test_the_reporter_owns_the_nest_at_first(self):
        self.assertEqual(self.nest.owner_id, self.reporter.guid)
        data = self.get(self.reporter_user, f'/nests/{self.nest.pk}/', 'retrieve', pk=self.nest.pk).data
        self.assertEqual(data['owner'], data['created_by'])
        self.assertFalse(data['permissions']['change_owner'])

    def test_an_admin_hands_a_nest_over(self):
        self.assertTrue(self.get(self.admin_user, f'/nests/{self.nest.pk}/', 'retrieve',
                                 pk=self.nest.pk).data['permissions']['change_owner'])
        response = self.hand_over(self.admin_user, self.trapper.guid)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['owner']['guid'], str(self.trapper.guid))
        self.nest.refresh_from_db()
        # The reporter stays the reporter
        self.assertEqual((self.nest.owner_id, self.nest.created_by_id), (self.trapper.guid, self.reporter.guid))
        event = AuditEvent.objects.get(action='nest.owner_changed')
        self.assertEqual(event.changes, {'owner': [str(self.reporter.guid), str(self.trapper.guid)]})
        self.assertEqual(set(event.refs), {f'nest:{self.nest.pk}', f'user:{self.reporter.guid}',
                                           f'user:{self.trapper.guid}'})

    def test_the_new_owner_follows_it_and_the_former_one_no_longer_sees_it(self):
        self.hand_over(self.admin_user, self.trapper.guid)
        detail = self.get(self.trapper_user, f'/nests/{self.nest.pk}/', 'retrieve', pk=self.nest.pk)
        self.assertEqual(detail.status_code, 200)
        self.assertTrue(detail.data['permissions']['destroy'])
        rows = self.get(self.trapper_user, '/nests/managed/', 'managed').data['results']
        self.assertEqual([row['id'] for row in rows], [self.nest.pk])
        self.assertEqual([n['id'] for n in self.get(self.trapper_user, '/nests/todo/', 'todo').data['mine']],
                         [self.nest.pk])
        self.assertEqual(self.get(self.reporter_user, f'/nests/{self.nest.pk}/', 'retrieve',
                                  pk=self.nest.pk).status_code, 404)
        self.assertEqual(self.get(self.reporter_user, '/nests/managed/', 'managed').data['results'], [])
        self.assertEqual(self.record(self.reporter_user, kind='destruction').status_code, 404)

    def test_a_coordinator_of_the_trappers_hands_over_the_nests_they_own(self):
        own = self.report(self.trappers_admin_user)
        self.assertTrue(self.get(self.trappers_admin_user, f'/nests/{own.pk}/', 'retrieve',
                                 pk=own.pk).data['permissions']['change_owner'])
        self.assertEqual(self.hand_over(self.trappers_admin_user, self.trapper.guid, own).status_code, 200)
        own.refresh_from_db()
        self.assertEqual(own.owner_id, self.trapper.guid)
        # Then it is no longer theirs to see, nor to hand over
        self.assertEqual(self.hand_over(self.trappers_admin_user, self.trappers_admin.guid, own).status_code, 404)

    def test_a_coordinator_of_the_trappers_does_not_reach_the_others_nests(self):
        self.assertEqual(self.hand_over(self.trappers_admin_user, self.trapper.guid).status_code, 404)
        # Even when they see every nest (a nest hunter too)
        both = FakeTrapUser(['trapper', 'hunter'], self.trappers_admin.guid, ['/trappers/admin', '/hunters'])
        self.assertEqual(self.hand_over(both, self.trapper.guid).status_code, 403)
        self.nest.refresh_from_db()
        self.assertEqual(self.nest.owner_id, self.reporter.guid)

    def test_nobody_else_hands_it_over(self):
        for user in (self.reporter_user, self.coordinator_user, self.beekeeper_user):
            self.assertEqual(self.hand_over(user, self.trapper.guid).status_code, 403)
        self.assertFalse(AuditEvent.objects.filter(action='nest.owner_changed').exists())

    def test_only_to_a_trapper_and_not_to_the_same_person(self):
        self.assertEqual(self.hand_over(self.admin_user, uuid.uuid4()).status_code, 400)
        self.assertEqual(self.hand_over(self.admin_user, 'nope').status_code, 400)
        self.assertEqual(self.hand_over(self.admin_user, self.reporter.guid).status_code, 400)
        # A trapper who never signed in gets their local account
        newcomer = uuid.uuid4()
        with patch('hornet_finder_api.utils.get_group_members',
                   side_effect=lambda group_id, *a, **k: [{'id': str(newcomer), 'firstName': 'Noé'}]
                   if group_id == 'trappers' else []):
            self.assertEqual(self.hand_over(self.admin_user, newcomer).status_code, 200)
        self.assertTrue(User.objects.filter(guid=newcomer).exists())

    def test_not_an_archived_nest(self):
        Nest.objects.filter(pk=self.nest.pk).update(archived=True)
        self.assertEqual(self.hand_over(self.admin_user, self.trapper.guid).status_code, 403)

    def test_the_trappers_to_choose_from(self):
        response = self.choices(self.admin_user)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['owner_guid'], str(self.reporter.guid))
        self.assertEqual([m['name'] for m in response.data['members']], ['Karim B.', 'Sophie L.', 'Zoé Martin'])
        self.assertEqual(self.choices(self.reporter_user).status_code, 403)

    @override_settings(VAPID_PUBLIC_KEY='public', VAPID_PRIVATE_KEY='private', PUSH_SYNC=True)
    def test_the_new_owner_is_told(self):
        PushSubscription.objects.create(user=self.trapper, endpoint='https://push.example/t', p256dh='p',
                                        auth='a', device='Android · Chrome')
        Nest.objects.filter(pk=self.nest.pk).update(address='Rue du Moulin 14, 1340 Ottignies')
        with patch('hornet.push.webpush', return_value=MagicMock(status_code=201)), \
                self.captureOnCommitCallbacks(execute=True):
            self.hand_over(self.admin_user, self.trapper.guid)
        notification = PushNotification.objects.get(recipient=self.trapper.guid)
        self.assertEqual((notification.title, notification.body, notification.url),
                         ("Un nid vous a été confié", f"Nid #{self.nest.pk} à Ottignies. Vous en recevrez le suivi.",
                          f'/nests?nest={self.nest.pk}'))
        # Not one who turned the follow-up off
        self.trapper.notification_prefs = {'nest_followup': False}
        self.trapper.save()
        self.hand_over(self.admin_user, self.reporter.guid)
        self.hand_over(self.admin_user, self.trapper.guid)
        self.assertEqual(PushNotification.objects.filter(recipient=self.trapper.guid).count(), 1)


class OwnerMigrationTests(TestCase):
    """0032: every existing nest is owned by its reporter."""

    def test_the_reporter_becomes_the_owner(self):
        migration = importlib.import_module('hornet.migrations.0032_nest_owner')
        reporter = User.objects.create(guid=uuid.uuid4())
        reported = Nest.objects.create(latitude=50.5, longitude=4.5, created_by=reporter)
        anonymous = Nest.objects.create(latitude=50.5, longitude=4.5)
        migration.forwards(apps, None)
        reported.refresh_from_db()
        anonymous.refresh_from_db()
        self.assertEqual((reported.owner_id, anonymous.owner_id), (reporter.guid, None))


class DataMigrationTests(TestCase):
    """0030 gives the existing nests their journal."""

    def setUp(self):
        self.migration = importlib.import_module('hornet.migrations.0030_nest_journal_data')
        reporter = User.objects.create(guid=uuid.uuid4())
        now = timezone.now()
        self.current = Nest.objects.create(latitude=50.5, longitude=4.5, created_by=reporter)
        self.dated = Nest.objects.create(latitude=50.5, longitude=4.5, destroyed=True,
                                         destroyed_at=now - timedelta(days=1))
        self.undated = Nest.objects.create(latitude=50.5, longitude=4.5, destroyed=True)
        self.past = Nest.objects.create(latitude=50.5, longitude=4.5)
        Nest.objects.filter(pk=self.past.pk).update(created_at=now.replace(year=now.year - 2))

    def run_migration(self, now):
        with patch.object(self.migration.timezone, 'now', return_value=now):
            self.migration.forwards(apps, None)
        for nest in (self.current, self.dated, self.undated, self.past):
            nest.refresh_from_db()

    def test_statuses_and_events(self):
        self.run_migration(timezone.now())
        self.assertEqual(self.current.status, Nest.STATUS_REPORTED)
        self.assertEqual(self.current.events.get().performed_by_id, self.current.created_by_id)
        self.assertEqual(self.dated.status, Nest.STATUS_DESTROYED)
        self.assertEqual(self.dated.events.get(kind='destruction').performed_at, self.dated.destroyed_at)
        # No date was kept: none is invented
        self.assertEqual(self.undated.status, Nest.STATUS_DESTROYED)
        self.assertIsNone(self.undated.destroyed_at)
        self.undated.recompute_status()
        self.assertIsNone(self.undated.destroyed_at)
        self.assertEqual(self.past.status, Nest.STATUS_ABANDONED)
        # Nothing to notify about the past
        self.assertFalse(NestEvent.objects.filter(alerted_at__isnull=True).exists())

    def test_the_season_ends_on_the_first_of_march(self):
        year = timezone.localtime().year
        last_year = Nest.objects.create(latitude=50.5, longitude=4.5)
        Nest.objects.filter(pk=last_year.pk).update(
            created_at=timezone.make_aware(datetime(year - 1, 9, 1)))
        self.run_migration(timezone.make_aware(datetime(year, 2, 20)))
        last_year.refresh_from_db()
        self.assertEqual(last_year.status, Nest.STATUS_REPORTED)
        NestEvent.objects.all().delete()
        self.run_migration(timezone.make_aware(datetime(year, 3, 2)))
        last_year.refresh_from_db()
        self.assertEqual(last_year.status, Nest.STATUS_ABANDONED)
