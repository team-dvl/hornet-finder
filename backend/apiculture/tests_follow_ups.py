import datetime

from django.utils import timezone

from audit.models import AuditEvent

from . import planning
from .models import Colony, Visit
from .tests_colonies import ColonyTestCase


class FollowUpTestCase(ColonyTestCase):
    def _plan_follow_up(self, colony, kind, when=None):
        when = when or timezone.now() + datetime.timedelta(days=3)
        response = self._post('/api/visits/', {
            'apiary': self.apiary.pk, 'status': 'planned', 'started_at': when.isoformat(),
            'follow_up': kind, 'follow_up_colony': str(colony.pk), 'kinds': ['transfer'],
            'participants': [self.member.guid],
            'inspections': [{'colony': str(colony.pk)}],
        })
        self.assertEqual(response.status_code, 201, response.data)
        return Visit.objects.get(pk=response.data['id'])


class ProposalTests(FollowUpTestCase):
    def test_a_colony_put_in_a_nucleus_gets_its_transfer_proposed_three_days_later_at_7_30(self):
        today = timezone.localdate()
        response = self._install(hive=self.nucleus, started_on=today.isoformat(), bars=5)
        self.assertEqual(response.status_code, 201, response.data)
        [proposal] = response.data['proposals']
        self.assertEqual(proposal['follow_up'], 'nucleus_transfer')
        at = datetime.datetime.fromisoformat(proposal['suggested_at'])
        self.assertEqual(timezone.localtime(at).date(), today + datetime.timedelta(days=3))
        self.assertEqual((timezone.localtime(at).hour, timezone.localtime(at).minute), (7, 30))
        self.assertEqual(proposal['apiary'], self.apiary.pk)

    def test_a_colony_in_a_hive_gets_nothing(self):
        self.assertEqual(self._install(bars=8).data['proposals'], [])

    def test_a_queenless_division_in_a_nucleus_gets_both(self):
        parent = self._colony(bars=12)
        today = timezone.localdate()
        response = self._post(f'/api/colonies/{parent.pk}/split/', {
            'on': today.isoformat(), 'hive': str(self.nucleus.pk), 'bars': 4, 'queen': 'parent'})
        self.assertEqual(response.status_code, 200, response.data)
        kinds = sorted(p['follow_up'] for p in response.data['proposals'])
        self.assertEqual(kinds, ['laying_check', 'nucleus_transfer'])
        laying = next(p for p in response.data['proposals'] if p['follow_up'] == 'laying_check')
        at = timezone.localtime(datetime.datetime.fromisoformat(laying['suggested_at']))
        self.assertEqual(at.date(), today + datetime.timedelta(days=planning.LAYING_CHECK_DAYS))

    def test_a_backdated_event_proposes_tomorrow_at_the_earliest(self):
        response = self._install(hive=self.nucleus, started_on='2026-04-01', bars=5)
        at = timezone.localtime(datetime.datetime.fromisoformat(response.data['proposals'][0]['suggested_at']))
        self.assertEqual(at.date(), timezone.localdate() + datetime.timedelta(days=1))

    def test_no_second_proposal_while_one_is_planned(self):
        colony = self._colony(hive=self.nucleus, bars=5)
        self._plan_follow_up(colony, 'nucleus_transfer')
        response = self._post(f'/api/colonies/{colony.pk}/transfer/', {'hive': str(self.nucleus.pk), 'compartment': 1})
        # The same place: refused, and nothing proposed twice either way
        self.assertEqual(response.status_code, 400)
        self.assertEqual(planning.proposals([colony], timezone.localdate()), [])


class FollowUpVisitTests(FollowUpTestCase):
    def test_a_follow_up_is_planned_names_its_colony_and_stays_in_its_apiary(self):
        colony = self._colony(hive=self.nucleus, bars=5)
        visit = self._plan_follow_up(colony, 'nucleus_transfer')
        data = self._as(self.member).get(f'/api/visits/{visit.pk}/').data
        self.assertEqual(data['follow_up'], 'nucleus_transfer')
        self.assertTrue(data['follow_up_colony']['in_nucleus'])
        response = self._post('/api/visits/', {
            'apiary': self.apiary.pk, 'started_at': timezone.now().isoformat(),
            'follow_up': 'nucleus_transfer', 'follow_up_colony': str(colony.pk)})
        self.assertEqual(response.status_code, 400)  # a follow-up is planned

    def test_doing_the_nucleus_follow_up_moves_the_colony(self):
        colony = self._colony(hive=self.nucleus, bars=5)
        visit = self._plan_follow_up(colony, 'nucleus_transfer')
        done = {'status': 'done', 'started_at': (timezone.now() - datetime.timedelta(minutes=5)).isoformat()}
        response = self._as(self.member).patch(f'/api/visits/{visit.pk}/', done, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('transfer', response.data)
        response = self._as(self.member).patch(f'/api/visits/{visit.pk}/', {
            **done, 'transfer': {'hive': str(self.hive.pk), 'compartment': 1}}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        colony.refresh_from_db()
        self.assertEqual(colony.hive_id, self.hive.pk)
        self.assertEqual(colony.bars, 5)
        self.assertTrue(AuditEvent.objects.filter(action='colony.transferred').exists())
        visit.refresh_from_db()
        self.assertEqual(visit.status, 'done')

    def test_a_failed_move_leaves_the_visit_planned(self):
        colony = self._colony(hive=self.nucleus, bars=5)
        self._colony(bars=20)  # the TBH is full enough: 5 more bars do not fit
        visit = self._plan_follow_up(colony, 'nucleus_transfer')
        response = self._as(self.member).patch(f'/api/visits/{visit.pk}/', {
            'status': 'done', 'started_at': timezone.now().isoformat(),
            'transfer': {'hive': str(self.hive.pk), 'compartment': 1}}, format='json')
        self.assertEqual(response.status_code, 400)
        visit.refresh_from_db()
        self.assertEqual(visit.status, 'planned')


class SettleTests(FollowUpTestCase):
    def test_leaving_the_nucleus_otherwise_drops_its_transfer(self):
        colony = self._colony(hive=self.nucleus, bars=5)
        visit = self._plan_follow_up(colony, 'nucleus_transfer')
        response = self._post(f'/api/colonies/{colony.pk}/transfer/', {'hive': str(self.hive.pk), 'compartment': 1})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(Visit.objects.filter(pk=visit.pk).exists())
        event = AuditEvent.objects.get(action='apiary_visit.deleted')
        self.assertEqual(event.changes['reason'], 'left_nucleus')
        self.assertIn(f'colony:{colony.pk}', event.refs)

    def test_laying_drops_the_laying_check_and_an_end_drops_everything(self):
        colony = self._colony(hive=self.nucleus, bars=5)
        Colony.objects.filter(pk=colony.pk).update(requeening_since=timezone.localdate() - datetime.timedelta(days=10))
        check = self._plan_follow_up(colony, 'laying_check')
        transfer = self._plan_follow_up(colony, 'nucleus_transfer')
        self.assertEqual(self._post(f'/api/colonies/{colony.pk}/laying/', {}).status_code, 200)
        self.assertFalse(Visit.objects.filter(pk=check.pk).exists())
        self.assertTrue(Visit.objects.filter(pk=transfer.pk).exists())
        self.assertEqual(self._post(f'/api/colonies/{colony.pk}/end/', {'cause': 'died'}).status_code, 200)
        self.assertFalse(Visit.objects.filter(pk=transfer.pk).exists())

    def test_eggs_seen_at_the_laying_check_keep_it(self):
        colony = self._colony(hive=self.nucleus, bars=5)
        Colony.objects.filter(pk=colony.pk).update(requeening_since=timezone.localdate() - datetime.timedelta(days=24))
        check = self._plan_follow_up(colony, 'laying_check')
        inspection = check.inspections.get()
        response = self._as(self.member).patch(f'/api/visits/{check.pk}/', {
            'status': 'done', 'started_at': timezone.now().isoformat(),
            'inspections': [{'id': inspection.pk, 'colony': str(colony.pk), 'eggs_seen': True}]}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        colony.refresh_from_db()
        self.assertEqual(colony.laying_since, timezone.localdate())
        self.assertTrue(Visit.objects.filter(pk=check.pk, status='done').exists())
