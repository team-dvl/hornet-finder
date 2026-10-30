import datetime
import uuid
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit.models import AuditEvent
from hornet.models import Apiary, ApiaryGroupPermission, BeekeeperGroup, User
from hornet.tests import FakeTrapUser

from .models import Hive, HiveCustody, HivePlacement, HiveType

ENA = '/beekeepers/ena'
OTHER = '/beekeepers/other'


class _Keycloak:
    """The Keycloak lookups the hives use: groups by path and their members."""

    def __init__(self):
        self.groups = {
            ENA: {'id': 'gid-ena', 'path': ENA, 'name': 'ena', 'attributes': {}},
            f'{ENA}/admin': {'id': 'gid-ena-admin', 'path': f'{ENA}/admin', 'name': 'admin',
                             'attributes': {}},
            OTHER: {'id': 'gid-other', 'path': OTHER, 'name': 'other', 'attributes': {}},
        }
        self.members = {}

    def get_group_by_path(self, path):
        return self.groups.get(path)

    def get_group_members(self, group_id):
        return self.members.get(group_id, [])

    def get_child_groups(self, path):
        return [g for p, g in self.groups.items() if p.count('/') == 2]


class HiveTestCase(TestCase):
    """
    An association (ena) with an administrator and a member, a stranger in
    another one, a platform admin, and an apiary of the member's.
    """

    def setUp(self):
        self.kc = _Keycloak()
        for name in ('get_group_by_path', 'get_group_members', 'get_child_groups'):
            patcher = patch(f'hornet_finder_api.utils.{name}', side_effect=getattr(self.kc, name))
            patcher.start()
            self.addCleanup(patcher.stop)
        patcher = patch('hornet.serializers.get_user_display_name', return_value='Tester')
        patcher.start()
        self.addCleanup(patcher.stop)

        self.group = BeekeeperGroup.objects.create(name='ena', path=ENA)
        self.member = self._user(['beekeeper'], [ENA])
        self.group_admin = self._user(['beekeeper'], [f'{ENA}/admin'])
        self.stranger = self._user(['beekeeper'], [OTHER])
        self.admin = self._user(['admin'], ['/admins'])
        self.kc.members['gid-ena'] = [{'id': self.member.guid, 'firstName': 'Anne', 'lastName': 'Bastin',
                                       'email': 'anne@example.org'}]
        self.kc.members['gid-ena-admin'] = [{'id': self.group_admin.guid, 'firstName': 'Jean',
                                             'lastName': 'Lambert'}]

        self.apiary = Apiary.objects.create(latitude=50.5, longitude=4.5, address='Rue des Abeilles 1',
                                            owner_id=self.member.guid, created_by_id=self.member.guid)
        self.tbh = HiveType.objects.get(slug='tbh')
        self.client = APIClient()

    def _user(self, roles, membership):
        guid = uuid.uuid4()
        User.objects.create(guid=guid, group_paths=membership)
        return FakeTrapUser(roles, guid, membership)

    def _as(self, user):
        self.client.force_authenticate(user=user)
        return self.client

    def _create(self, user=None, **data):
        payload = {'hive_type': self.tbh.pk, 'name': 'TBH du verger', **data}
        return self._as(user or self.member).post('/api/hives/', payload, format='json')

    def _hive(self, **data):
        response = self._create(**data)
        self.assertEqual(response.status_code, 201, response.data)
        return Hive.objects.get(pk=response.data['id'])

    def _ids(self, user, query=''):
        response = self._as(user).get(f'/api/hives/{query}')
        self.assertEqual(response.status_code, 200, response.data)
        return {item['id'] for item in response.data}


class HiveTypeTests(HiveTestCase):
    def test_types_in_use_are_seeded(self):
        types = {t.slug: t for t in HiveType.objects.all()}
        self.assertEqual(set(types), {'tbh', 'tbh-chandler', 'warre', 'log', 'nucleus'})
        self.assertEqual((types['tbh'].max_bars, types['tbh'].max_colonies), (24, 2))
        self.assertEqual((types['tbh-chandler'].max_bars, types['tbh-chandler'].max_colonies), (24, 2))
        self.assertEqual((types['nucleus'].bar_family, types['nucleus'].max_bars), ('topbar', 12))
        self.assertEqual((types['warre'].bar_family, types['warre'].bars_per_box), ('warre', 8))
        self.assertEqual(types['log'].bar_family, '')

    def test_everyone_reads_only_admins_write(self):
        self.assertEqual(self._as(self.member).get('/api/hive-types/').status_code, 200)
        response = self._as(self.member).post('/api/hive-types/', {'name': 'Dadant'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_bars_follow_the_family(self):
        response = self._as(self.admin).post('/api/hive-types/', {
            'name': 'Kenyane', 'bar_family': 'topbar', 'max_colonies': 2}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('max_bars', response.data)
        response = self._as(self.admin).post('/api/hive-types/', {
            'name': 'Warré haute', 'bar_family': 'warre', 'bars_per_box': 8, 'max_bars': 30,
            'max_colonies': 2}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('max_colonies', response.data)
        response = self._as(self.admin).post('/api/hive-types/', {
            'name': 'Warré haute', 'bar_family': 'warre', 'bars_per_box': 8, 'max_bars': 30},
            format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data['slug'], response.data['max_bars']), ('warre-haute', None))
        event = AuditEvent.objects.get(action='hive_type.created')
        self.assertEqual(event.changes['bars_per_box'], 8)

    def test_a_type_in_use_is_not_deleted(self):
        self._hive()
        response = self._as(self.admin).delete(f'/api/hive-types/{self.tbh.pk}/')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['hive_count'], 1)
        unused = HiveType.objects.get(slug='log')
        self.assertEqual(self._as(self.admin).delete(f'/api/hive-types/{unused.pk}/').status_code, 204)
        self.assertEqual(AuditEvent.objects.get(action='hive_type.deleted').changes['slug'], 'log')


class HiveCreationTests(HiveTestCase):
    def test_a_hive_in_an_apiary_is_in_service_kept_and_owned_by_its_creator(self):
        response = self._create(apiary=self.apiary.pk, number='3')
        self.assertEqual(response.status_code, 201, response.data)
        hive = Hive.objects.get(pk=response.data['id'])
        self.assertEqual((hive.status, hive.apiary_id), ('active', self.apiary.pk))
        self.assertEqual(str(hive.owner_user_id), self.member.guid)
        self.assertEqual(str(hive.keeper_id), self.member.guid)
        self.assertEqual(response.data['owner']['kind'], 'user')
        self.assertEqual(response.data['permissions'], {'edit': True, 'move': True, 'manage': True})
        self.assertEqual(len(response.data['placements']), 1)
        self.assertEqual(response.data['placements'][0]['apiary_label'], 'Rue des Abeilles 1')
        self.assertEqual(len(response.data['custodies']), 1)
        event = AuditEvent.objects.get(action='hive.created')
        self.assertEqual(event.target_id, str(hive.pk))
        self.assertIn(f'apiary:{self.apiary.pk}', event.refs)
        self.assertEqual(event.changes['keeper'], self.member.guid)

    def test_without_an_apiary_the_hive_is_stored(self):
        hive = self._hive()
        self.assertEqual((hive.status, hive.apiary_id), ('stored', None))
        self.assertFalse(HivePlacement.objects.filter(hive=hive).exists())

    def test_an_association_hive_needs_its_membership(self):
        hive = self._hive(owner_group=ENA)
        self.assertEqual((hive.owner_group_id, hive.owner_user_id), (self.group.pk, None))
        self.assertIn(f'group:{ENA}', AuditEvent.objects.get(action='hive.created').refs)
        response = self._create(user=self.stranger, owner_group=ENA)
        self.assertEqual(response.status_code, 403)

    def test_placing_needs_the_right_to_update_the_apiary(self):
        self.assertEqual(self._create(user=self.stranger, apiary=self.apiary.pk).status_code, 403)
        ApiaryGroupPermission.objects.create(apiary=self.apiary, group=self.group, can_update=False)
        self.assertEqual(self._create(user=self.group_admin, apiary=self.apiary.pk).status_code, 403)
        ApiaryGroupPermission.objects.filter(apiary=self.apiary).update(can_update=True)
        self.assertEqual(self._create(user=self.group_admin, apiary=self.apiary.pk).status_code, 201)

    def test_sent_again_with_its_id_it_is_not_created_twice(self):
        hive_id = str(uuid.uuid4())
        self.assertEqual(self._create(id=hive_id).status_code, 201)
        again = self._create(id=hive_id, name='Autre nom')
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.data['name'], 'TBH du verger')
        self.assertEqual(Hive.objects.count(), 1)
        self.assertEqual(AuditEvent.objects.filter(action='hive.created').count(), 1)
        # Someone else cannot probe it
        self.assertEqual(self._create(user=self.stranger, id=hive_id).status_code, 400)

    def test_the_associations_offered_are_those_of_the_creator(self):
        response = self._as(self.member).get('/api/hives/owner-groups/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([g['path'] for g in response.data], [ENA])
        response = self._as(self.admin).get('/api/hives/owner-groups/')
        self.assertEqual({g['path'] for g in response.data}, {ENA, OTHER})

    def test_trappers_have_no_hives(self):
        trapper = self._user(['trapper'], ['/trappers'])
        self.assertEqual(self._as(trapper).get('/api/hives/').status_code, 403)


class HiveVisibilityTests(HiveTestCase):
    def test_who_sees_a_hive(self):
        own = self._hive(apiary=self.apiary.pk)
        association = self._hive(owner_group=ENA)
        self.assertEqual(self._ids(self.member), {str(own.pk), str(association.pk)})
        # A member of the association sees its hives, not those of a member's apiary
        self.assertEqual(self._ids(self.group_admin), {str(association.pk)})
        self.assertEqual(self._ids(self.stranger), set())
        self.assertEqual(self._ids(self.admin), {str(own.pk), str(association.pk)})
        self.assertEqual(self._as(self.stranger).get(f'/api/hives/{own.pk}/').status_code, 404)

    def test_who_sees_the_apiary_sees_its_hives(self):
        hive = self._hive(apiary=self.apiary.pk)
        self.assertEqual(self._as(self.stranger).get(f'/api/hives/?apiary={self.apiary.pk}').status_code, 404)
        stranger_group = BeekeeperGroup.objects.create(name='other', path=OTHER)
        ApiaryGroupPermission.objects.create(apiary=self.apiary, group=stranger_group)
        self.assertEqual(self._ids(self.stranger, f'?apiary={self.apiary.pk}'), {str(hive.pk)})
        self.assertEqual(self._ids(self.stranger), {str(hive.pk)})
        detail = self._as(self.stranger).get(f'/api/hives/{hive.pk}/')
        self.assertEqual(detail.data['permissions'], {'edit': False, 'move': False, 'manage': False})

    def test_retired_hives_are_listed_on_request(self):
        hive = self._hive(apiary=self.apiary.pk)
        self._as(self.member).post(f'/api/hives/{hive.pk}/retire/', {}, format='json')
        self.assertEqual(self._ids(self.member), set())
        self.assertEqual(self._ids(self.member, '?status=retired'), {str(hive.pk)})
        self.assertEqual(self._ids(self.member, '?status=all'), {str(hive.pk)})


class HiveEditTests(HiveTestCase):
    def test_the_keeper_edits_a_member_of_the_association_does_not(self):
        hive = self._hive(owner_group=ENA)
        response = self._as(self.member).patch(f'/api/hives/{hive.pk}/', {'number': ' 7 '}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['number'], '7')
        event = AuditEvent.objects.get(action='hive.updated')
        self.assertEqual(event.changes, {'number': ['', '7']})
        reader = self._user(['beekeeper'], [ENA])
        response = self._as(reader).patch(f'/api/hives/{hive.pk}/', {'number': '8'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_the_identifier_of_a_hive_does_not_change(self):
        hive = self._hive()
        response = self._as(self.member).patch(f'/api/hives/{hive.pk}/',
                                               {'id': str(uuid.uuid4()), 'name': 'Renommée'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual((response.data['id'], response.data['name']), (str(hive.pk), 'Renommée'))
        self.assertEqual(Hive.objects.count(), 1)

    def test_the_type_of_a_hive_does_not_change(self):
        hive = self._hive()
        warre = HiveType.objects.get(slug='warre')
        response = self._as(self.member).patch(f'/api/hives/{hive.pk}/', {'hive_type': warre.pk},
                                               format='json')
        self.assertEqual(response.status_code, 400)


class HiveMoveTests(HiveTestCase):
    def setUp(self):
        super().setUp()
        self.other_apiary = Apiary.objects.create(latitude=50.4, longitude=4.4, address='Chemin 2',
                                                  owner_id=self.member.guid)
        self.hive = self._hive(apiary=self.apiary.pk, placed_on='2026-04-01')

    def _move(self, user=None, **data):
        return self._as(user or self.member).post(f'/api/hives/{self.hive.pk}/move/', data, format='json')

    def test_a_move_closes_the_stay_and_opens_the_next(self):
        response = self._move(apiary=self.other_apiary.pk, on='2026-05-10')
        self.assertEqual(response.status_code, 200, response.data)
        stays = list(self.hive.placements.order_by('started_on'))
        self.assertEqual([(s.apiary_id, s.started_on, s.ended_on) for s in stays], [
            (self.apiary.pk, datetime.date(2026, 4, 1), datetime.date(2026, 5, 10)),
            (self.other_apiary.pk, datetime.date(2026, 5, 10), None),
        ])
        self.assertEqual(response.data['apiary']['id'], self.other_apiary.pk)
        event = AuditEvent.objects.get(action='hive.moved')
        self.assertEqual(event.changes['apiary'], [str(self.apiary.pk), str(self.other_apiary.pk)])
        self.assertEqual(event.changes['on'], '2026-05-10')
        self.assertIn(f'apiary:{self.apiary.pk}', event.refs)
        self.assertIn(f'apiary:{self.other_apiary.pk}', event.refs)

    def test_dates_are_checked(self):
        self.assertEqual(self._move(apiary=self.other_apiary.pk, on='2026-03-01').status_code, 400)
        tomorrow = timezone.localdate() + datetime.timedelta(days=1)
        self.assertEqual(self._move(apiary=self.other_apiary.pk, on=tomorrow.isoformat()).status_code, 400)
        self.assertEqual(self._move(apiary=self.apiary.pk).status_code, 400)

    def test_the_target_apiary_must_be_maintained_by_the_mover(self):
        foreign = Apiary.objects.create(latitude=50.3, longitude=4.3, owner_id=self.stranger.guid)
        self.assertEqual(self._move(apiary=foreign.pk).status_code, 403)

    def test_store_then_back_in_service(self):
        response = self._as(self.member).post(f'/api/hives/{self.hive.pk}/store/', {'on': '2026-05-01'},
                                              format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual((response.data['status'], response.data['apiary']), ('stored', None))
        self.assertFalse(self.hive.placements.filter(ended_on__isnull=True).exists())
        self.assertEqual(AuditEvent.objects.get(action='hive.stored').changes['status'], ['active', 'stored'])
        response = self._move(apiary=self.other_apiary.pk, on='2026-05-02')
        self.assertEqual(response.data['status'], 'active')

    def test_the_keeper_stores_only_a_manager_retires(self):
        keeper = self._user(['beekeeper'], [ENA])
        Hive.objects.filter(pk=self.hive.pk).update(keeper_id=keeper.guid)
        self.assertEqual(self._as(keeper).post(f'/api/hives/{self.hive.pk}/retire/', {}).status_code, 403)
        self.assertEqual(self._as(keeper).post(f'/api/hives/{self.hive.pk}/store/', {}).status_code, 200)
        self.assertEqual(self._as(self.member).post(f'/api/hives/{self.hive.pk}/retire/', {}).status_code, 200)

    def test_an_apiary_holding_hives_is_not_deleted(self):
        response = self._as(self.member).delete(f'/api/apiaries/{self.apiary.pk}/')
        self.assertEqual(response.status_code, 409)
        self._as(self.member).post(f'/api/hives/{self.hive.pk}/store/', {}, format='json')
        self.assertEqual(self._as(self.member).delete(f'/api/apiaries/{self.apiary.pk}/').status_code, 204)
        stay = self.hive.placements.get()
        self.assertEqual((stay.apiary_id, stay.apiary_label), (None, 'Rue des Abeilles 1'))


class HiveKeeperTests(HiveTestCase):
    def setUp(self):
        super().setUp()
        self.hive = self._hive(owner_group=ENA, placed_on='2026-04-01')

    def _keeper(self, user, method='put', data=None, query=''):
        client = self._as(user)
        url = f'/api/hives/{self.hive.pk}/keeper/{query}'
        return client.put(url, data, format='json') if method == 'put' else client.get(url)

    def test_a_group_admin_entrusts_the_hive_to_a_member(self):
        choices = self._keeper(self.group_admin, 'get', query=f'?group_path={ENA}')
        self.assertEqual(choices.status_code, 200, choices.data)
        self.assertEqual([g['path'] for g in choices.data['groups']], [ENA])
        self.assertEqual([m['name'] for m in choices.data['members']], ['Anne Bastin', 'Jean Lambert'])
        self.assertNotIn('example.org', str(choices.data))

        response = self._keeper(self.group_admin, data={
            'keeper_guid': self.group_admin.guid, 'group_path': ENA, 'on': '2026-06-01'})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['keeper']['guid'], self.group_admin.guid)
        custodies = list(HiveCustody.objects.filter(hive=self.hive).order_by('started_on'))
        self.assertEqual([(str(c.keeper_id), c.ended_on) for c in custodies], [
            (self.member.guid, datetime.date(2026, 6, 1)), (self.group_admin.guid, None)])
        event = AuditEvent.objects.get(action='hive.keeper_changed')
        self.assertEqual(event.changes['keeper'], [self.member.guid, self.group_admin.guid])
        self.assertIn(f'user:{self.member.guid}', event.refs)
        # The former keeper, a plain member, still sees it but no longer edits it
        detail = self._as(self.member).get(f'/api/hives/{self.hive.pk}/')
        self.assertEqual(detail.data['permissions']['edit'], False)

    def test_only_a_member_of_the_association(self):
        response = self._keeper(self.group_admin, data={'keeper_guid': self.stranger.guid,
                                                        'group_path': ENA})
        self.assertEqual(response.status_code, 400)
        response = self._keeper(self.group_admin, data={'keeper_guid': self.stranger.guid,
                                                        'group_path': OTHER})
        self.assertEqual(response.status_code, 403)

    def test_the_keeper_alone_does_not_hand_it_over(self):
        response = self._keeper(self.member, data={'keeper_guid': self.group_admin.guid,
                                                   'group_path': ENA})
        self.assertEqual(response.status_code, 403)


class HiveDeletionTests(HiveTestCase):
    def test_a_manager_deletes_and_the_trail_keeps_a_snapshot(self):
        hive = self._hive(apiary=self.apiary.pk, number='4')
        keeper = self._user(['beekeeper'], [ENA])
        Hive.objects.filter(pk=hive.pk).update(keeper_id=keeper.guid)
        self.assertEqual(self._as(keeper).delete(f'/api/hives/{hive.pk}/').status_code, 403)
        self.assertEqual(self._as(self.member).delete(f'/api/hives/{hive.pk}/').status_code, 204)
        self.assertFalse(Hive.objects.filter(pk=hive.pk).exists())
        event = AuditEvent.objects.get(action='hive.deleted')
        self.assertEqual((event.changes['name'], event.changes['number']), ('TBH du verger', '4'))
        self.assertEqual(event.target_label, 'TBH du verger #4')
        self.assertIn(f'apiary:{self.apiary.pk}', event.refs)


class ApiaryHostTests(HiveTestCase):
    def test_the_host_is_a_name_kept_out_of_the_trail(self):
        response = self._as(self.member).patch(f'/api/apiaries/{self.apiary.pk}/',
                                               {'host_name': ' Marie D. ', 'address': 'Rue 3'},
                                               format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['host_name'], 'Marie D.')
        event = AuditEvent.objects.get(action='apiary.updated')
        self.assertEqual(set(event.changes), {'address'})
