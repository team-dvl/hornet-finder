"""Journal entries named by the client (`client_key`): a replayed request records them once."""

import json
import uuid

from django.utils import timezone
from rest_framework.test import force_authenticate

from audit.models import AuditEvent
from .models import Nest, NestEvent, TrapEvent
from .tests import TrapTestCase
from .tests_nests import NestJournalTestCase
from .trap_views import TrapViewSet


class TrapVisitReplayTests(TrapTestCase):
    """POST /traps/<id>/catches/ with a `client_key`: the key is the batch of the visit."""

    def post(self, key=None, user=None, query='', quantity=4, **extra):
        data = {'performed_at': timezone.now().isoformat(),
                'items': json.dumps([{'species_slug': 'vespa-velutina', 'quantity': quantity}]),
                'bycatch_counted': 'true', **extra}
        if key is not None:
            data['client_key'] = str(key)
        request = self.factory.post(f'/traps/{self.trap.id}/catches/{query}', data, format='multipart')
        force_authenticate(request, user=user or self.owner_user)
        return TrapViewSet.as_view({'post': 'catches'})(request, pk=self.trap.id)

    def test_the_key_becomes_the_batch(self):
        key = uuid.uuid4()
        response = self.post(key)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual({e.batch for e in TrapEvent.objects.filter(trap=self.trap)}, {key})

    def test_a_replay_records_nothing_and_answers_the_first_visit(self):
        key = uuid.uuid4()
        first = self.post(key)
        # The second attempt even says something else: the first one stands
        again = self.post(key, quantity=9)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.data, first.data)
        self.assertEqual(TrapEvent.objects.filter(trap=self.trap).count(), 1)
        self.assertEqual(AuditEvent.objects.filter(action='trap.visit_recorded').count(), 1)
        self.trap.refresh_from_db()
        self.assertEqual(self.trap.hornet_catch_count, 4)

    def test_without_a_key_every_request_is_a_visit(self):
        self.post()
        self.post()
        self.assertEqual(len({e.batch for e in TrapEvent.objects.filter(trap=self.trap)}), 2)

    def test_the_key_of_someone_else_is_a_conflict(self):
        # A member of the group in charge records visits too, under keys of their own
        self.trap.group = self.group
        self.trap.save(update_fields=['group'])
        key = uuid.uuid4()
        self.post(key)
        self.assertEqual(self.post(key, user=self.member_user).status_code, 409)
        self.assertEqual(TrapEvent.objects.filter(trap=self.trap).count(), 1)

    def test_a_malformed_key_is_refused(self):
        self.assertEqual(self.post('not-a-uuid').status_code, 400)
        self.assertFalse(TrapEvent.objects.filter(trap=self.trap).exists())

    def test_include_trap_answers_the_trap_too(self):
        response = self.post(uuid.uuid4(), query='?include=trap')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(response.data['events']), 1)
        self.assertEqual(response.data['trap']['id'], self.trap.id)
        self.assertEqual(response.data['trap']['hornet_catch_count'], 4)
        self.assertIn('events', response.data['trap'])


class TrapEventReplayTests(TrapTestCase):
    """POST /traps/<id>/events/ with a `client_key`."""

    def post(self, key=None, user=None, query='', kind='cleaning', trap=None):
        trap = trap or self.trap
        data = {'kind': kind, 'performed_at': timezone.now().isoformat()}
        if key is not None:
            data['client_key'] = str(key)
        request = self.factory.post(f'/traps/{trap.id}/events/{query}', data, format='multipart')
        force_authenticate(request, user=user or self.owner_user)
        return TrapViewSet.as_view({'post': 'events'})(request, pk=trap.id)

    def test_a_replay_records_nothing_and_answers_the_first_event(self):
        key = uuid.uuid4()
        first = self.post(key)
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(str(first.data['client_key']), str(key))
        again = self.post(key)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.data['id'], first.data['id'])
        self.assertEqual(TrapEvent.objects.filter(trap=self.trap, kind='cleaning').count(), 1)
        self.assertEqual(AuditEvent.objects.filter(action='trap.event_recorded').count(), 1)

    def test_a_replayed_removal_records_one_removal(self):
        key = uuid.uuid4()
        self.assertEqual(self.post(key, kind='removal').status_code, 201)
        self.assertEqual(self.post(key, kind='removal').status_code, 200)
        self.assertEqual(TrapEvent.objects.filter(trap=self.trap, kind='removal').count(), 1)

    def test_the_same_key_on_another_trap_is_a_conflict(self):
        key = uuid.uuid4()
        self.post(key)
        other = type(self.trap).objects.create(latitude=50.6, longitude=4.6, owner=self.owner,
                                               trap_type=self.trap_type, installed_at=timezone.now().date())
        self.assertEqual(self.post(key, trap=other).status_code, 409)
        self.assertFalse(other.events.exists())

    def test_include_trap_answers_the_trap_too(self):
        response = self.post(uuid.uuid4(), query='?include=trap', kind='removal')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['event']['kind'], 'removal')
        self.assertFalse(response.data['trap']['active'])


class NestEventReplayTests(NestJournalTestCase):
    """POST /nests/<id>/events/ with a `client_key`."""

    def test_a_replayed_visit_records_nothing(self):
        key = str(uuid.uuid4())
        first = self.record(self.coordinator_user, kind='visit', outcome='active', client_key=key)
        self.assertEqual(first.status_code, 201, first.data)
        again = self.record(self.coordinator_user, kind='visit', outcome='active', client_key=key)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.data['id'], self.nest.pk)
        self.assertEqual(self.nest.events.filter(kind='visit').count(), 1)
        self.assertEqual(AuditEvent.objects.filter(action='nest.visited').count(), 1)

    def test_a_replayed_destruction_is_not_refused_for_the_nest_it_closed(self):
        key = str(uuid.uuid4())
        day = timezone.now().isoformat()
        first = self.record(self.coordinator_user, kind='destruction', performed_at=day, client_key=key)
        self.assertEqual(first.status_code, 201, first.data)
        # Without the key, a second destruction is refused: the nest is closed
        self.assertEqual(self.record(self.coordinator_user, kind='destruction', performed_at=day).status_code, 403)
        again = self.record(self.coordinator_user, kind='destruction', performed_at=day, client_key=key)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.data['status'], first.data['status'])
        self.assertEqual(self.nest.events.filter(kind=NestEvent.KIND_DESTRUCTION).count(), 1)

    def test_the_key_of_someone_else_is_a_conflict(self):
        key = str(uuid.uuid4())
        self.record(self.coordinator_user, kind='visit', outcome='active', client_key=key)
        self.assertEqual(
            self.record(self.admin_user, kind='visit', outcome='active', client_key=key).status_code, 409)

    def test_the_key_is_kept_on_the_event(self):
        key = uuid.uuid4()
        self.record(self.coordinator_user, kind='visit', outcome='empty', client_key=str(key))
        self.assertEqual(NestEvent.objects.get(kind='visit').client_key, key)
        self.nest.refresh_from_db()
        self.assertEqual(self.nest.status, Nest.STATUS_ABANDONED)
