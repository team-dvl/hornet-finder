import datetime
import uuid

from audit.models import AuditEvent

from .models import Colony, ColonyOccupancy, Hive, HiveType
from .tests import ENA, HiveTestCase

DAY = '2026-05-10'


class ColonyTestCase(HiveTestCase):
    """A TBH and a nucleus in the member's apiary."""

    def setUp(self):
        super().setUp()
        self.hive = self._hive(apiary=self.apiary.pk, placed_on='2026-03-01')
        nucleus = HiveType.objects.get(slug='nucleus')
        self.nucleus = self._hive(apiary=self.apiary.pk, placed_on='2026-03-01', hive_type=nucleus.pk,
                                  name='Nucleus 1')

    def _post(self, url, data, user=None):
        return self._as(user or self.member).post(url, data, format='json')

    def _install(self, hive=None, user=None, **data):
        payload = {'hive': str((hive or self.hive).pk), 'origin': 'package', 'started_on': '2026-04-01',
                   'name': 'Reinettes', **data}
        return self._post('/api/colonies/', payload, user)

    def _colony(self, **data):
        response = self._install(**data)
        self.assertEqual(response.status_code, 201, response.data)
        return Colony.objects.get(pk=response.data['id'])

    def _divider(self, value, hive=None):
        return self._post(f'/api/hives/{(hive or self.hive).pk}/divider/', {'divider_bar': value})


class ColonyInstallTests(ColonyTestCase):
    def test_a_package_goes_in_a_compartment(self):
        response = self._install(bars=10)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data['compartment'], response.data['bars']), (1, 10))
        self.assertEqual(response.data['hive']['id'], str(self.hive.pk))
        self.assertEqual(len(response.data['occupancies']), 1)
        event = AuditEvent.objects.get(action='colony.created')
        self.assertIn(f'hive:{self.hive.pk}', event.refs)
        self.assertIn(f'apiary:{self.apiary.pk}', event.refs)
        hive = self._as(self.member).get(f'/api/hives/{self.hive.pk}/').data
        self.assertEqual([c['name'] for c in hive['colonies']], ['Reinettes'])

    def test_what_a_hive_cannot_hold(self):
        self.assertEqual(self._install(compartment=2).status_code, 400)
        self.assertEqual(self._install(bars=25).status_code, 400)
        self.assertEqual(self._install(hive=self.nucleus, bars=13).status_code, 400)
        log = self._hive(apiary=self.apiary.pk, hive_type=HiveType.objects.get(slug='log').pk, name='Tronc')
        self.assertEqual(self._install(hive=log, bars=3).status_code, 400)
        self.assertEqual(self._install(hive=log).status_code, 201)
        self._colony()
        self.assertEqual(self._install().status_code, 400, 'one colony per compartment')

    def test_divisions_and_swarms_come_from_their_parent(self):
        self.assertEqual(self._install(origin='division').status_code, 400)
        self.assertEqual(self._install(origin='swarm_parent').status_code, 400)

    def test_sent_again_with_its_id_it_is_not_created_twice(self):
        colony_id = str(uuid.uuid4())
        self.assertEqual(self._install(id=colony_id).status_code, 201)
        self.assertEqual(self._install(id=colony_id).status_code, 200)
        self.assertEqual(Colony.objects.count(), 1)

    def test_only_who_tends_the_hive(self):
        self.assertEqual(self._install(user=self.stranger).status_code, 400)
        reader = self._user(['beekeeper'], [ENA])
        association_hive = self._hive(owner_group=ENA)
        self.assertEqual(self._install(hive=association_hive, user=reader).status_code, 403)


class DividerTests(ColonyTestCase):
    def test_the_divider_fits_the_bars_of_each_side(self):
        self._colony(bars=10)
        self.assertEqual(self._divider(8).status_code, 400, '10 bars do not fit in 7')
        response = self._divider(13)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['divider_bar'], 13)
        self.assertEqual(AuditEvent.objects.get(action='hive.divider_changed').changes,
                         {'divider_bar': [None, 13]})
        # Compartment 2 holds 24 - 13 = 11 bars
        self.assertEqual(self._install(compartment=2, bars=12, name='B').status_code, 400)
        self.assertEqual(self._install(compartment=2, bars=11, name='B').status_code, 201)
        self.assertEqual(self._divider(None).status_code, 400, 'two colonies live on either side')

    def test_only_a_hive_for_two_colonies_takes_a_divider(self):
        self.assertEqual(self._divider(6, self.nucleus).status_code, 400)
        self.assertEqual(self._divider(1).status_code, 400)
        self.assertEqual(self._divider(24).status_code, 400)


class SplitTests(ColonyTestCase):
    def test_a_division_into_the_other_compartment(self):
        parent = self._colony(bars=12)
        response = self._post(f'/api/colonies/{parent.pk}/split/', {
            'on': DAY, 'divider_bar': 14, 'bars': 5, 'queen': 'parent', 'name': 'Filles'})
        self.assertEqual(response.status_code, 200, response.data)
        parent.refresh_from_db()
        self.assertEqual((parent.bars, parent.requeening_since), (7, None))
        daughter = Colony.objects.get(parent=parent)
        self.assertEqual((daughter.hive_id, daughter.compartment, daughter.bars, daughter.origin),
                         (self.hive.pk, 2, 5, 'division'))
        self.assertEqual(daughter.requeening_since, datetime.date(2026, 5, 10))
        self.assertEqual(Hive.objects.get(pk=self.hive.pk).divider_bar, 14)
        event = AuditEvent.objects.get(action='colony.split')
        self.assertIn(f'colony:{daughter.pk}', event.refs)
        self.assertEqual(event.changes['queen'], 'parent')
        self.assertEqual([c['id'] for c in response.data['children']], [str(daughter.pk)])

    def test_a_division_that_does_not_fit_changes_nothing(self):
        parent = self._colony(bars=12)
        response = self._post(f'/api/colonies/{parent.pk}/split/', {
            'on': DAY, 'divider_bar': 14, 'bars': 11})
        self.assertEqual(response.status_code, 400)
        parent.refresh_from_db()
        self.assertEqual(parent.bars, 12)
        self.assertIsNone(Hive.objects.get(pk=self.hive.pk).divider_bar)
        self.assertFalse(Colony.objects.filter(parent=parent).exists())
        response = self._post(f'/api/colonies/{parent.pk}/split/', {'on': DAY, 'bars': 4})
        self.assertEqual(response.status_code, 400, 'no second compartment without a divider')

    def test_a_division_into_a_nucleus(self):
        parent = self._colony(bars=12)
        daughter_id = str(uuid.uuid4())
        data = {'on': DAY, 'hive': str(self.nucleus.pk), 'bars': 4, 'queen': 'daughter',
                'daughter_id': daughter_id}
        self.assertEqual(self._post(f'/api/colonies/{parent.pk}/split/', data).status_code, 200)
        parent.refresh_from_db()
        self.assertEqual((parent.bars, parent.requeening_since), (8, datetime.date(2026, 5, 10)))
        self.assertEqual(Colony.objects.get(pk=daughter_id).hive_id, self.nucleus.pk)
        # Sent again: nothing more
        self.assertEqual(self._post(f'/api/colonies/{parent.pk}/split/', data).status_code, 200)
        parent.refresh_from_db()
        self.assertEqual(parent.bars, 8)
        self.assertEqual(Colony.objects.count(), 2)


class SwarmTests(ColonyTestCase):
    def test_what_stays_and_the_caught_swarm_are_new_colonies(self):
        swarmed = self._colony(bars=15)
        response = self._post(f'/api/colonies/{swarmed.pk}/swarm/', {
            'on': DAY, 'caught': {'hive': str(self.nucleus.pk), 'name': 'Essaim', 'bars': 3}})
        self.assertEqual(response.status_code, 200, response.data)
        swarmed.refresh_from_db()
        self.assertEqual((swarmed.ended_on, swarmed.end_cause), (datetime.date(2026, 5, 10), 'swarmed'))
        stayed = Colony.objects.get(pk=response.data['id'])
        self.assertEqual((stayed.origin, stayed.parent_id, stayed.hive_id, stayed.compartment, stayed.bars),
                         ('swarm_parent', swarmed.pk, self.hive.pk, 1, 15))
        self.assertEqual((stayed.name, stayed.requeening_since), ('Reinettes', datetime.date(2026, 5, 10)))
        caught = Colony.objects.get(origin='swarm_caught')
        self.assertEqual((caught.parent_id, caught.hive_id, caught.requeening_since),
                         (swarmed.pk, self.nucleus.pk, None))
        event = AuditEvent.objects.get(action='colony.swarmed')
        self.assertEqual(event.changes['caught'], str(caught.pk))
        self.assertFalse(swarmed.occupancies.filter(ended_on__isnull=True).exists())

    def test_an_ended_colony_does_not_swarm_again(self):
        swarmed = self._colony()
        self._post(f'/api/colonies/{swarmed.pk}/swarm/', {'on': DAY})
        self.assertEqual(self._post(f'/api/colonies/{swarmed.pk}/swarm/', {'on': DAY}).status_code, 400)


class TransferTests(ColonyTestCase):
    def test_bars_follow_within_their_family(self):
        colony = self._colony(hive=self.nucleus, bars=6)
        response = self._post(f'/api/colonies/{colony.pk}/transfer/', {'on': DAY, 'hive': str(self.hive.pk)})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual((response.data['hive']['id'], response.data['bars']), (str(self.hive.pk), 6))
        stays = list(ColonyOccupancy.objects.filter(colony=colony).order_by('started_on', 'id'))
        self.assertEqual([(s.hive_id, s.ended_on) for s in stays],
                         [(self.nucleus.pk, datetime.date(2026, 5, 10)), (self.hive.pk, None)])
        event = AuditEvent.objects.get(action='colony.transferred')
        self.assertEqual(event.changes['hive'], [str(self.nucleus.pk), str(self.hive.pk)])

    def test_out_of_a_log_hive_the_bars_are_counted_again(self):
        log = self._hive(apiary=self.apiary.pk, hive_type=HiveType.objects.get(slug='log').pk, name='Tronc')
        colony = self._colony(hive=log)
        response = self._post(f'/api/colonies/{colony.pk}/transfer/',
                              {'on': DAY, 'hive': str(self.hive.pk), 'bars': 9})
        self.assertEqual(response.data['bars'], 9)
        warre = self._hive(apiary=self.apiary.pk, hive_type=HiveType.objects.get(slug='warre').pk, name='W')
        response = self._post(f'/api/colonies/{colony.pk}/transfer/', {'on': DAY, 'hive': str(warre.pk)})
        self.assertEqual(response.data['bars'], None)

    def test_into_a_hive_one_tends(self):
        colony = self._colony()
        foreign = Hive.objects.create(hive_type=self.tbh, name='X', status='stored',
                                      owner_user_id=self.stranger.guid, keeper_id=self.stranger.guid)
        response = self._post(f'/api/colonies/{colony.pk}/transfer/', {'hive': str(foreign.pk)})
        self.assertEqual(response.status_code, 400)


class EndAndLayingTests(ColonyTestCase):
    def test_a_merge_names_the_colony_that_absorbs(self):
        self._divider(12)
        first = self._colony()
        second = self._colony(compartment=2, name='B')
        response = self._post(f'/api/colonies/{second.pk}/end/',
                              {'on': DAY, 'cause': 'merged', 'merged_into': str(first.pk)})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['merged_into']['id'], str(first.pk))
        self.assertEqual(response.data['end_cause'], 'merged')
        self.assertEqual(self._post(f'/api/colonies/{second.pk}/end/', {'cause': 'died'}).status_code, 400)
        # The compartment is free again: the divider may go
        self.assertEqual(self._divider(None).status_code, 200)

    def test_laying_closes_the_brood_break(self):
        colony = self._colony()
        self.assertEqual(self._post(f'/api/colonies/{colony.pk}/laying/', {'on': DAY}).status_code, 400)
        swarm = self._post(f'/api/colonies/{colony.pk}/swarm/', {'on': '2026-05-01'}).data
        self.assertEqual(self._post(f"/api/colonies/{swarm['id']}/laying/", {'on': '2026-04-30'}).status_code, 400)
        response = self._post(f"/api/colonies/{swarm['id']}/laying/", {'on': '2026-05-20'})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['laying_since'], '2026-05-20')
        self.assertEqual(AuditEvent.objects.get(action='colony.laying').changes,
                         {'laying_since': [None, '2026-05-20']})


class HiveWithColoniesTests(ColonyTestCase):
    def test_a_hive_with_a_colony_is_not_stored_retired_or_deleted(self):
        colony = self._colony()
        self.assertEqual(self._post(f'/api/hives/{self.hive.pk}/store/', {}).status_code, 400)
        self.assertEqual(self._post(f'/api/hives/{self.hive.pk}/retire/', {}).status_code, 400)
        self._post(f'/api/colonies/{colony.pk}/end/', {'on': DAY, 'cause': 'died'})
        self.assertEqual(self._as(self.member).delete(f'/api/hives/{self.hive.pk}/').status_code, 409)
        self.assertEqual(self._post(f'/api/hives/{self.hive.pk}/retire/', {}).status_code, 200)

    def test_a_nucleus_moves_with_its_colony(self):
        colony = self._colony(hive=self.nucleus)
        other = self.apiary.__class__.objects.create(latitude=50.4, longitude=4.4, owner_id=self.member.guid)
        response = self._post(f'/api/hives/{self.nucleus.pk}/move/', {'apiary': other.pk})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([c['id'] for c in response.data['colonies']], [str(colony.pk)])

    def test_who_sees_a_colony(self):
        colony = self._colony()
        self.assertEqual(self._as(self.stranger).get(f'/api/colonies/{colony.pk}/').status_code, 404)
        self.assertEqual(self._as(self.member).get(f'/api/colonies/?hive={self.hive.pk}').data[0]['id'],
                         str(colony.pk))
        self.assertEqual(self._as(self.stranger).get('/api/colonies/').data, [])
        response = self._as(self.member).delete(f'/api/colonies/{colony.pk}/')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(AuditEvent.objects.get(action='colony.deleted').changes['name'], 'Reinettes')
        self.assertEqual(self._as(self.member).delete(f'/api/hives/{self.hive.pk}/').status_code, 204)
