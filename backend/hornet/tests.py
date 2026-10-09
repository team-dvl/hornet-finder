from datetime import date, datetime, timezone as dt_timezone
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from .models import Hornet, Nest
from .views import HornetViewSet, NestViewSet


class FakeUser:
    """Minimal stand-in for JWTUser, used to bypass real Keycloak auth in tests."""

    def __init__(self, roles):
        self.roles = roles
        self.guid = None

    @property
    def is_authenticated(self):
        return True


def _make_hornet(year, archived=False, **kwargs):
    hornet = Hornet.objects.create(latitude=50.5, longitude=4.5, direction=0, **kwargs)
    Hornet.objects.filter(pk=hornet.pk).update(
        created_at=datetime(year, 6, 1, tzinfo=dt_timezone.utc), archived=archived
    )
    return Hornet.objects.get(pk=hornet.pk)


def _make_nest(year, archived=False, **kwargs):
    nest = Nest.objects.create(latitude=50.5, longitude=4.5, **kwargs)
    Nest.objects.filter(pk=nest.pk).update(
        created_at=datetime(year, 6, 1, tzinfo=dt_timezone.utc), archived=archived
    )
    return Nest.objects.get(pk=nest.pk)


class HornetArchiveFilterTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.current_year = timezone.now().year
        self.current_year_hornet = _make_hornet(self.current_year)
        self.past_year_hornet = _make_hornet(self.current_year - 1)
        self.archived_current_year_hornet = _make_hornet(self.current_year, archived=True)

    def _list(self, query_string=''):
        request = self.factory.get(f'/hornets/?lat=50.5&lon=4.5&radius=5{query_string}')
        view = HornetViewSet.as_view({'get': 'list'})
        response = view(request)
        return {item['id'] for item in response.data}

    def test_default_list_shows_only_current_year_non_archived(self):
        ids = self._list()
        self.assertEqual(ids, {self.current_year_hornet.id})

    def test_year_all_disables_year_filter(self):
        ids = self._list('&year=all')
        self.assertEqual(ids, {self.current_year_hornet.id, self.past_year_hornet.id})

    def test_archived_true_shows_only_archived(self):
        ids = self._list('&year=all&archived=true')
        self.assertEqual(ids, {self.archived_current_year_hornet.id})

    def test_archived_all_disables_archived_filter(self):
        ids = self._list('&year=all&archived=all')
        self.assertEqual(
            ids, {self.current_year_hornet.id, self.past_year_hornet.id, self.archived_current_year_hornet.id}
        )


class HornetArchiveActionPermissionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.hornet = _make_hornet(2025)

    def test_archive_forbidden_for_non_admin(self):
        request = self.factory.post(f'/hornets/{self.hornet.id}/archive/')
        force_authenticate(request, user=FakeUser(roles=['hunter']))
        view = HornetViewSet.as_view({'post': 'archive'})
        response = view(request, pk=self.hornet.id)
        self.assertEqual(response.status_code, 403)

    def test_archive_allowed_for_admin(self):
        request = self.factory.post(f'/hornets/{self.hornet.id}/archive/')
        force_authenticate(request, user=FakeUser(roles=['admin']))
        view = HornetViewSet.as_view({'post': 'archive'})
        response = view(request, pk=self.hornet.id)
        self.assertEqual(response.status_code, 200)
        self.hornet.refresh_from_db()
        self.assertTrue(self.hornet.archived)
        self.assertIsNotNone(self.hornet.archived_at)

    def test_bulk_archive_requires_year_param(self):
        request = self.factory.post('/hornets/bulk_archive/')
        force_authenticate(request, user=FakeUser(roles=['admin']))
        view = HornetViewSet.as_view({'post': 'bulk_archive'})
        response = view(request)
        self.assertEqual(response.status_code, 400)

    def test_bulk_archive_archives_matching_year_only(self):
        other_year_hornet = _make_hornet(2024)
        request = self.factory.post('/hornets/bulk_archive/?year=2025')
        force_authenticate(request, user=FakeUser(roles=['admin']))
        view = HornetViewSet.as_view({'post': 'bulk_archive'})
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['archived_count'], 1)
        self.hornet.refresh_from_db()
        other_year_hornet.refresh_from_db()
        self.assertTrue(self.hornet.archived)
        self.assertFalse(other_year_hornet.archived)


def _make_hornet_on(day, archived=False):
    hornet = Hornet.objects.create(latitude=50.5, longitude=4.5, direction=0)
    Hornet.objects.filter(pk=hornet.pk).update(created_at=day, archived=archived)
    return hornet


class ArchiveBySeasonTests(TestCase):
    """Archiving with the granularity of the statistics' seasons; today is 2026-10-15."""

    def setUp(self):
        self.factory = APIRequestFactory()
        patcher = patch('hornet.stats.periods.local_today', return_value=date(2026, 10, 15))
        patcher.start()
        self.addCleanup(patcher.stop)
        utc = dt_timezone.utc
        self.in_spring = _make_hornet_on(datetime(2026, 3, 10, 12, tzinfo=utc))
        self.in_summer = _make_hornet_on(datetime(2026, 7, 10, 12, tzinfo=utc))
        self.in_january = _make_hornet_on(datetime(2026, 1, 10, 12, tzinfo=utc))
        self.in_december = _make_hornet_on(datetime(2026, 12, 10, 12, tzinfo=utc))
        self.spring_archived = _make_hornet_on(datetime(2026, 4, 10, 12, tzinfo=utc), archived=True)

    def _call(self, method, action_name, query, roles=('admin',)):
        request = getattr(self.factory, method)(f'/hornets/{action_name}/?{query}')
        force_authenticate(request, user=FakeUser(roles=list(roles)))
        return HornetViewSet.as_view({method: action_name})(request)

    def test_candidates_count_the_season_not_yet_archived(self):
        response = self._call('get', 'archive_candidates', 'period=season&season=spring&year=2026')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)  # the archived one is left out
        self.assertEqual(response.data['period']['start'], '2026-02-01')
        self.assertEqual(response.data['period']['end'], '2026-06-15')

    def test_candidates_of_a_season_do_not_archive_anything(self):
        self._call('get', 'archive_candidates', 'period=season&season=spring&year=2026')
        self.in_spring.refresh_from_db()
        self.assertFalse(self.in_spring.archived)

    def test_bulk_archive_season_archives_that_season_only(self):
        response = self._call('post', 'bulk_archive', 'period=season&season=spring&year=2026')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['archived_count'], 1)
        for hornet, expected in [(self.in_spring, True), (self.in_summer, False),
                                 (self.in_january, False), (self.in_december, False)]:
            hornet.refresh_from_db()
            self.assertEqual(hornet.archived, expected)

    def test_late_season_covers_summer_and_after(self):
        response = self._call('get', 'archive_candidates', 'period=season&season=late&year=2026')
        # Still running (ends 31 Dec): refused
        self.assertEqual(response.status_code, 400)
        with patch('hornet.stats.periods.local_today', return_value=date(2027, 1, 5)):
            response = self._call('get', 'archive_candidates', 'period=season&season=late&year=2026')
        self.assertEqual(response.data['count'], 2)  # July and December

    def test_year_without_period_is_the_whole_year(self):
        with patch('hornet.stats.periods.local_today', return_value=date(2027, 1, 5)):
            response = self._call('get', 'archive_candidates', 'year=2026')
        self.assertEqual(response.data['count'], 4)

    def test_running_period_is_refused(self):
        response = self._call('post', 'bulk_archive', 'year=2026')
        self.assertEqual(response.status_code, 400)
        self.in_spring.refresh_from_db()
        self.assertFalse(self.in_spring.archived)

    def test_year_before_the_project_is_refused(self):
        response = self._call('get', 'archive_candidates', 'year=2024')
        self.assertEqual(response.status_code, 400)

    def test_unknown_season_is_refused(self):
        response = self._call('get', 'archive_candidates', 'period=season&season=winter&year=2026')
        self.assertEqual(response.status_code, 400)

    def test_candidates_forbidden_for_non_admin(self):
        response = self._call('get', 'archive_candidates', 'year=2025', roles=('beekeeper',))
        self.assertEqual(response.status_code, 403)


class NestArchiveFilterTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.current_year = timezone.now().year
        self.current_year_nest = _make_nest(self.current_year)
        self.past_year_nest = _make_nest(self.current_year - 1)

    def test_default_list_requires_auth_and_shows_current_year_only(self):
        request = self.factory.get('/nests/?lat=50.5&lon=4.5&radius=5')
        force_authenticate(request, user=FakeUser(roles=['hunter']))
        view = NestViewSet.as_view({'get': 'list'})
        response = view(request)
        ids = {item['id'] for item in response.data}
        self.assertEqual(ids, {self.current_year_nest.id})

    def test_bulk_archive_forbidden_for_non_admin(self):
        request = self.factory.post('/nests/bulk_archive/?year=2024')
        force_authenticate(request, user=FakeUser(roles=['hunter']))
        view = NestViewSet.as_view({'post': 'bulk_archive'})
        response = view(request)
        self.assertEqual(response.status_code, 403)


# ---------------------------------------------------------------------------
# Traps module
# ---------------------------------------------------------------------------

import io
import json
import time
import uuid as uuid_module
from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from PIL import Image

from .models import BeekeeperGroup, Species, Trap, TrapEvent, TrapPhoto, TrapType, User
from .trap_views import SpeciesViewSet, TrapEventViewSet, TrapTypeViewSet, TrapViewSet
from .media_views import media_view
from .serializers import TrapSerializer


class FakeTrapUser:
    """Stand-in for JWTUser carrying both roles and Keycloak group paths."""

    def __init__(self, roles, guid=None, membership=None):
        self.roles = roles
        self.guid = str(guid) if guid else None
        self.token_info = {'membership': membership or []}

    @property
    def is_authenticated(self):
        return True


def _image_file(name='photo.jpg', size=(2400, 1800)):
    buffer = io.BytesIO()
    Image.new('RGB', size, (120, 160, 90)).save(buffer, format='JPEG')
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type='image/jpeg')


class TrapTestCase(TestCase):
    """Shared fixtures: an owner, a group, a trap and a few named users."""

    def setUp(self):
        self.factory = APIRequestFactory()
        # Keycloak lookups are irrelevant here and would hit the network
        patcher = patch('hornet.serializers.get_user_display_name', return_value='Tester')
        patcher.start()
        self.addCleanup(patcher.stop)

        self.trap_type = TrapType.objects.get(slug='homemade')
        self.velutina = Species.objects.get(slug='vespa-velutina')
        self.other_species = Species.objects.get(slug='apis-mellifera')

        self.group_path = '/beekeepers/ena'
        self.group = BeekeeperGroup.objects.create(name='ena', path=self.group_path)

        self.owner_guid = uuid_module.uuid4()
        self.owner = User.objects.create(guid=self.owner_guid, group_paths=[self.group_path])
        self.owner_user = FakeTrapUser(['trapper'], self.owner_guid, [self.group_path])

        self.member_guid = uuid_module.uuid4()
        self.member = User.objects.create(guid=self.member_guid, group_paths=[self.group_path])
        self.member_user = FakeTrapUser(['beekeeper'], self.member_guid, [self.group_path])

        # Member of the admin subgroup only: must still count as a member of the group
        self.group_admin_guid = uuid_module.uuid4()
        User.objects.create(guid=self.group_admin_guid,
                            group_paths=[f'{self.group_path}/admin'])
        self.group_admin_user = FakeTrapUser(['beekeeper'], self.group_admin_guid,
                                             [f'{self.group_path}/admin'])

        self.stranger_guid = uuid_module.uuid4()
        User.objects.create(guid=self.stranger_guid, group_paths=['/beekeepers/other'])
        self.stranger_user = FakeTrapUser(['trapper'], self.stranger_guid,
                                          ['/beekeepers/other'])

        self.admin_guid = uuid_module.uuid4()
        User.objects.create(guid=self.admin_guid, group_paths=['/admins'])
        self.admin_user = FakeTrapUser(['admin'], self.admin_guid, ['/admins'])

        self.trap = Trap.objects.create(
            latitude=50.5, longitude=4.5, owner=self.owner, trap_type=self.trap_type,
            installed_at=timezone.now().date(),
        )

    def _call(self, method, url, actions, user=None, data=None, **kwargs):
        request = getattr(self.factory, method)(url, data, **kwargs)
        if user is not None:
            force_authenticate(request, user=user)
        return TrapViewSet.as_view(actions)(request, **kwargs.pop('view_kwargs', {}))


class TrapVisibilityTests(TrapTestCase):
    def _list(self, user=None):
        request = self.factory.get('/traps/?lat=50.5&lon=4.5&radius=5')
        if user:
            force_authenticate(request, user=user)
        response = TrapViewSet.as_view({'get': 'list'})(request)
        return response

    def test_anonymous_sees_public_traps_with_public_shape(self):
        response = self._list()
        self.assertEqual(response.status_code, 200)
        self.assertEqual({t['id'] for t in response.data}, {self.trap.id})
        self.assertNotIn('owner', response.data[0])
        self.assertNotIn('comments', response.data[0])

    def test_anonymous_does_not_see_group_traps(self):
        self.trap.visibility = Trap.VISIBILITY_GROUP
        self.trap.group = self.group
        self.trap.save()
        self.assertEqual(self._list().data, [])

    def test_group_trap_visible_to_member_owner_and_admin(self):
        self.trap.visibility = Trap.VISIBILITY_GROUP
        self.trap.group = self.group
        self.trap.save()
        for user in (self.owner_user, self.member_user, self.group_admin_user,
                     self.admin_user):
            with self.subTest(user=user.roles):
                ids = {t['id'] for t in self._list(user).data}
                self.assertEqual(ids, {self.trap.id})

    def test_group_trap_invisible_to_stranger(self):
        self.trap.visibility = Trap.VISIBILITY_GROUP
        self.trap.group = self.group
        self.trap.save()
        self.assertEqual(self._list(self.stranger_user).data, [])

    def test_authenticated_user_gets_full_shape(self):
        response = self._list(self.owner_user)
        self.assertIn('owner', response.data[0])
        self.assertEqual(response.data[0]['owner']['guid'], str(self.owner_guid))


class ApiaryBoundTrapTests(TrapTestCase):
    """A trap of an apiary-bound type (electric harp...) would reveal an apiary."""

    def setUp(self):
        super().setUp()
        self.trap.trap_type = TrapType.objects.get(slug='electric-harp')
        self.trap.group = self.group
        self.trap.save()
        self.public_trap = Trap.objects.create(
            latitude=50.5, longitude=4.5, owner=self.owner, trap_type=self.trap_type,
            installed_at=timezone.now().date(),
        )

    def _list_ids(self, user=None):
        request = self.factory.get('/traps/?lat=50.5&lon=4.5&radius=5')
        if user:
            force_authenticate(request, user=user)
        return {t['id'] for t in TrapViewSet.as_view({'get': 'list'})(request).data}

    def _retrieve(self, user=None):
        request = self.factory.get(f'/traps/{self.trap.id}/')
        if user:
            force_authenticate(request, user=user)
        return TrapViewSet.as_view({'get': 'retrieve'})(request, pk=self.trap.id)

    def test_electric_harp_is_flagged_by_the_migration(self):
        self.assertTrue(TrapType.objects.get(slug='electric-harp').apiary_bound)

    def test_hidden_from_anonymous_and_strangers_despite_public_visibility(self):
        self.assertEqual(self.trap.visibility, Trap.VISIBILITY_PUBLIC)
        self.assertEqual(self._list_ids(), {self.public_trap.id})
        self.assertEqual(self._list_ids(self.stranger_user), {self.public_trap.id})
        self.assertIn(self._retrieve().status_code, (403, 404))
        self.assertIn(self._retrieve(self.stranger_user).status_code, (403, 404))

    def test_visible_to_owner_delegated_group_and_admin(self):
        for user in (self.owner_user, self.member_user, self.group_admin_user,
                     self.admin_user):
            with self.subTest(user=user.roles):
                self.assertIn(self.trap.id, self._list_ids(user))
                response = self._retrieve(user)
                self.assertEqual(response.status_code, 200)
                self.assertFalse(response.data['publicly_visible'])

    def test_flagging_a_type_hides_its_existing_traps(self):
        self.assertIn(self.public_trap.id, self._list_ids())
        self.trap_type.apiary_bound = True
        self.trap_type.save()
        self.assertEqual(self._list_ids(), set())

    def test_photo_is_hidden_from_strangers(self):
        request = self.factory.post(f'/traps/{self.trap.id}/photo/',
                                    {'photo': _image_file()}, format='multipart')
        force_authenticate(request, user=self.owner_user)
        self.assertEqual(
            TrapViewSet.as_view({'post': 'photo'})(request, pk=self.trap.id).status_code, 200)
        self.trap.refresh_from_db()
        self.addCleanup(self.trap.photo.delete, save=False)
        self.addCleanup(self.trap.photo_thumbnail.delete, save=False)

        path = self.trap.photo.name
        self.assertEqual(media_view(self.factory.get(f'/api/media/{path}'), path=path)
                         .status_code, 404)
        allowed = self.factory.get(f'/api/media/{path}')
        force_authenticate(allowed, user=self.member_user)
        self.assertEqual(media_view(allowed, path=path).status_code, 200)


class TrapCreationTests(TrapTestCase):
    def _create(self, user, **overrides):
        payload = {
            'latitude': 50.51, 'longitude': 4.51,
            'trap_type_slug': self.trap_type.slug,
            'installed_at': timezone.now().date().isoformat(),
        }
        payload.update(overrides)
        request = self.factory.post('/traps/', payload)
        force_authenticate(request, user=user)
        return TrapViewSet.as_view({'post': 'create'})(request)

    def test_trapper_can_create(self):
        response = self._create(self.owner_user)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['owner']['guid'], str(self.owner_guid))

    def test_a_hunter_cannot_create_a_trap(self):
        self.owner_user.roles = ['hunter']
        self.assertEqual(self._create(self.owner_user).status_code, 403)

    def test_a_new_trap_is_in_service(self):
        # The form posts multipart, where DRF reads an absent boolean as False:
        # `active` must therefore not be writable, or every trap would be born
        # already put away.
        response = self._create(self.owner_user)
        self.assertTrue(response.data['active'])
        self.assertTrue(Trap.objects.get(pk=response.data['id']).active)

    def test_status_is_not_writable_from_the_form(self):
        trap = self._create(self.owner_user)
        request = self.factory.patch(f"/traps/{trap.data['id']}/", {'active': False})
        force_authenticate(request, user=self.owner_user)
        response = TrapViewSet.as_view({'patch': 'partial_update'})(request, pk=trap.data['id'])
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Trap.objects.get(pk=trap.data['id']).active)

    def test_platform_admin_cannot_create(self):
        self.assertEqual(self._create(self.admin_user).status_code, 403)

    def test_anonymous_cannot_create(self):
        request = self.factory.post('/traps/', {})
        self.assertEqual(TrapViewSet.as_view({'post': 'create'})(request).status_code, 403)

    def test_creation_opens_the_journal_with_an_installation(self):
        response = self._create(self.owner_user)
        trap = Trap.objects.get(pk=response.data['id'])
        events = trap.events.all()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].kind, TrapEvent.KIND_INSTALLATION)
        self.assertEqual(events[0].performed_by_id, self.owner.pk)


class TrapEventPermissionTests(TrapTestCase):
    def setUp(self):
        super().setUp()
        self.trap.group = self.group
        self.trap.save()

    def _post_event(self, user, **payload):
        data = {'kind': TrapEvent.KIND_INSPECTION,
                'performed_at': timezone.now().isoformat()}
        data.update(payload)
        request = self.factory.post(f'/traps/{self.trap.id}/events/', data)
        force_authenticate(request, user=user)
        return TrapViewSet.as_view({'post': 'events'})(request, pk=self.trap.id)

    def test_owner_and_group_member_can_record_an_event(self):
        for user in (self.owner_user, self.member_user, self.group_admin_user):
            with self.subTest(user=user.guid):
                self.assertEqual(self._post_event(user).status_code, 201)

    def test_stranger_cannot_record_an_event(self):
        self.assertEqual(self._post_event(self.stranger_user).status_code, 403)

    def test_platform_admin_cannot_record_an_event(self):
        self.assertEqual(self._post_event(self.admin_user).status_code, 403)

    def test_group_member_cannot_edit_the_trap(self):
        request = self.factory.patch(f'/traps/{self.trap.id}/', {'comments': 'nope'})
        force_authenticate(request, user=self.member_user)
        response = TrapViewSet.as_view({'patch': 'partial_update'})(request, pk=self.trap.id)
        self.assertEqual(response.status_code, 403)

    def test_owner_and_admin_can_edit_the_trap(self):
        for user in (self.owner_user, self.admin_user):
            with self.subTest(user=user.roles):
                request = self.factory.patch(f'/traps/{self.trap.id}/', {'comments': 'ok'})
                force_authenticate(request, user=user)
                response = TrapViewSet.as_view({'patch': 'partial_update'})(
                    request, pk=self.trap.id)
                self.assertEqual(response.status_code, 200)

    def test_author_can_delete_their_event_but_another_member_cannot(self):
        event_id = self._post_event(self.member_user).data['id']

        request = self.factory.delete(f'/trap-events/{event_id}/')
        force_authenticate(request, user=self.group_admin_user)
        self.assertEqual(
            TrapEventViewSet.as_view({'delete': 'destroy'})(request, pk=event_id).status_code,
            403,
        )

        request = self.factory.delete(f'/trap-events/{event_id}/')
        force_authenticate(request, user=self.member_user)
        self.assertEqual(
            TrapEventViewSet.as_view({'delete': 'destroy'})(request, pk=event_id).status_code,
            204,
        )

    def test_platform_admin_can_delete_an_event_for_moderation(self):
        event_id = self._post_event(self.member_user).data['id']
        request = self.factory.delete(f'/trap-events/{event_id}/')
        force_authenticate(request, user=self.admin_user)
        self.assertEqual(
            TrapEventViewSet.as_view({'delete': 'destroy'})(request, pk=event_id).status_code,
            204,
        )


class TrapEventContentTests(TrapTestCase):
    def _post_event(self, user=None, **payload):
        data = {'performed_at': timezone.now().isoformat()}
        data.update(payload)
        request = self.factory.post(f'/traps/{self.trap.id}/events/', data)
        force_authenticate(request, user=user or self.owner_user)
        return TrapViewSet.as_view({'post': 'events'})(request, pk=self.trap.id)

    def test_catch_without_quantity_is_rejected(self):
        response = self._post_event(kind=TrapEvent.KIND_CATCH)
        self.assertEqual(response.status_code, 400)
        self.assertIn('quantity', response.data)

    def test_non_catch_with_quantity_is_rejected(self):
        response = self._post_event(kind=TrapEvent.KIND_INSPECTION, quantity=3)
        self.assertEqual(response.status_code, 400)

    def test_only_the_asian_hornet_can_be_corrected_to_zero(self):
        hornet = self._post_event(kind=TrapEvent.KIND_CATCH, quantity=4).data['id']
        other = self._post_event(kind=TrapEvent.KIND_CATCH, quantity=2,
                                 species_slug=self.other_species.slug).data['id']

        def patch(event_id):
            request = self.factory.patch(f'/trap-events/{event_id}/', {'quantity': 0})
            force_authenticate(request, user=self.owner_user)
            return TrapEventViewSet.as_view({'patch': 'partial_update'})(request, pk=event_id)

        self.assertEqual(patch(hornet).status_code, 200)
        self.assertEqual(patch(other).status_code, 400)
        self.trap.refresh_from_db()
        self.assertEqual(self.trap.hornet_catch_count, 0)

    def test_catch_defaults_to_vespa_velutina(self):
        response = self._post_event(kind=TrapEvent.KIND_CATCH, quantity=4)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['species']['slug'], 'vespa-velutina')

    def test_counter_only_sums_velutina_and_is_recomputed_on_delete(self):
        self._post_event(kind=TrapEvent.KIND_CATCH, quantity=4)
        self._post_event(kind=TrapEvent.KIND_CATCH, quantity=7)
        other = self._post_event(kind=TrapEvent.KIND_CATCH, quantity=5,
                                 species_slug=self.other_species.slug)
        self.trap.refresh_from_db()
        self.assertEqual(self.trap.hornet_catch_count, 11)

        request = self.factory.delete(f"/trap-events/{other.data['id']}/")
        force_authenticate(request, user=self.owner_user)
        TrapEventViewSet.as_view({'delete': 'destroy'})(request, pk=other.data['id'])
        self.trap.refresh_from_db()
        self.assertEqual(self.trap.hornet_catch_count, 11)

    def test_installation_and_removal_drive_the_trap_status(self):
        self._post_event(kind=TrapEvent.KIND_REMOVAL)
        self.trap.refresh_from_db()
        self.assertFalse(self.trap.active)

        self._post_event(kind=TrapEvent.KIND_INSTALLATION)
        self.trap.refresh_from_db()
        self.assertTrue(self.trap.active)


class TrapDelegationTests(TrapTestCase):
    def _put(self, user, group_path, **extra):
        payload = {'group_path': group_path}
        payload.update(extra)
        request = self.factory.put(f'/traps/{self.trap.id}/delegation/', payload)
        force_authenticate(request, user=user)
        return TrapViewSet.as_view({'put': 'delegation'})(request, pk=self.trap.id)

    def test_owner_delegates_to_one_of_their_groups(self):
        response = self._put(self.owner_user, self.group_path)
        self.assertEqual(response.status_code, 200)
        self.trap.refresh_from_db()
        self.assertEqual(self.trap.group.path, self.group_path)

    def test_owner_cannot_delegate_to_a_group_they_do_not_belong_to(self):
        self.assertEqual(self._put(self.owner_user, '/beekeepers/other').status_code, 403)

    def test_group_admin_delegates_to_their_own_group(self):
        response = self._put(self.group_admin_user, self.group_path)
        self.assertEqual(response.status_code, 200)

    def test_group_admin_cannot_touch_a_trap_of_an_unrelated_owner(self):
        self.owner.group_paths = ['/beekeepers/elsewhere']
        self.owner.save()
        self.assertEqual(self._put(self.group_admin_user, self.group_path).status_code, 403)

    def test_member_without_admin_subgroup_cannot_delegate(self):
        self.assertEqual(self._put(self.member_user, self.group_path).status_code, 403)

    def test_platform_admin_can_delegate_to_any_group(self):
        self.assertEqual(self._put(self.admin_user, '/beekeepers/whatever').status_code, 200)

    def test_only_beekeeper_associations_receive_a_delegation(self):
        self.owner.group_paths = [self.group_path, '/trappers', '/hunters', '/beekeepers']
        self.owner.save()
        for path in ('/trappers', '/hunters', '/beekeepers', '/beekeepers/admin',
                     f'{self.group_path}/admin', '/volunteers/vsa'):
            with self.subTest(path=path):
                self.assertEqual(self._put(self.owner_user, path).status_code, 403)
                self.assertEqual(self._put(self.admin_user, path).status_code, 403)

    def test_a_trapper_outside_any_association_cannot_delegate(self):
        self.owner.group_paths = ['/trappers']
        self.owner.save()
        self.owner_user.token_info = {'membership': ['/trappers']}
        request = self.factory.get(f'/traps/{self.trap.id}/delegation/')
        force_authenticate(request, user=self.owner_user)
        response = TrapViewSet.as_view({'get': 'delegation'})(request, pk=self.trap.id)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['can_set_delegation'])
        self.assertEqual(response.data['allowed_groups'], [])

    def test_withdrawal_resets_group_and_visibility(self):
        self._put(self.owner_user, self.group_path, visibility=Trap.VISIBILITY_GROUP)
        request = self.factory.delete(f'/traps/{self.trap.id}/delegation/')
        force_authenticate(request, user=self.owner_user)
        response = TrapViewSet.as_view({'delete': 'delegation'})(request, pk=self.trap.id)
        self.assertEqual(response.status_code, 200)
        self.trap.refresh_from_db()
        self.assertIsNone(self.trap.group)
        self.assertEqual(self.trap.visibility, Trap.VISIBILITY_PUBLIC)

    def test_allowed_groups_listing(self):
        request = self.factory.get(f'/traps/{self.trap.id}/delegation/')
        force_authenticate(request, user=self.owner_user)
        response = TrapViewSet.as_view({'get': 'delegation'})(request, pk=self.trap.id)
        self.assertEqual([g['path'] for g in response.data['allowed_groups']],
                         [self.group_path])

    # Keycloak representations of the groups, with their display name
    KC_GROUPS = {
        '/beekeepers/ena': {'id': '1', 'path': '/beekeepers/ena', 'name': 'ena',
                            'description': 'Entente namuroise'},
        '/beekeepers/abc': {'id': '2', 'path': '/beekeepers/abc', 'name': 'ABC apiculture'},
    }

    def _get(self, user):
        request = self.factory.get(f'/traps/{self.trap.id}/delegation/')
        force_authenticate(request, user=user)
        return TrapViewSet.as_view({'get': 'delegation'})(request, pk=self.trap.id)

    def _keycloak(self):
        from unittest.mock import patch
        return (patch('hornet_finder_api.utils.get_group_by_path', side_effect=self.KC_GROUPS.get),
                patch('hornet_finder_api.utils.get_child_groups',
                      return_value=list(self.KC_GROUPS.values())))

    def test_groups_are_offered_by_their_keycloak_name(self):
        by_path, children = self._keycloak()
        with by_path, children:
            response = self._get(self.owner_user)
        self.assertEqual(response.data['allowed_groups'],
                         [{'path': self.group_path, 'name': 'Entente namuroise'}])

    def test_platform_admin_picks_among_every_association(self):
        self.trap.group = BeekeeperGroup.objects.create(name='misc', path='/misc')
        self.trap.save()
        by_path, children = self._keycloak()
        with by_path, children:
            response = self._get(self.admin_user)
        # Sorted by name, the current group kept even outside /beekeepers
        self.assertEqual(response.data['allowed_groups'], [
            {'path': '/beekeepers/abc', 'name': 'ABC apiculture'},
            {'path': '/beekeepers/ena', 'name': 'Entente namuroise'},
            {'path': '/misc', 'name': 'misc'},
        ])

    def test_keycloak_down_falls_back_on_local_groups(self):
        from unittest.mock import patch
        with patch('hornet_finder_api.utils._get_keycloak_admin', side_effect=RuntimeError('down')):
            owner = self._get(self.owner_user)
            admin = self._get(self.admin_user)
        self.assertEqual(owner.data['allowed_groups'],
                         [{'path': self.group_path, 'name': 'beekeepers / ena'}])
        self.assertEqual(admin.data['allowed_groups'], [{'path': self.group_path, 'name': 'ena'}])

    def test_delegation_renames_the_local_group_as_in_keycloak(self):
        by_path, children = self._keycloak()
        with by_path, children:
            self.assertEqual(self._put(self.owner_user, self.group_path).status_code, 200)
        self.group.refresh_from_db()
        self.assertEqual(self.group.name, 'Entente namuroise')

    def test_local_name_clash_keeps_a_path_derived_name(self):
        BeekeeperGroup.objects.create(name='Entente namuroise', path='/beekeepers/other')
        by_path, children = self._keycloak()
        with by_path, children:
            self.assertEqual(self._put(self.owner_user, self.group_path).status_code, 200)
        self.group.refresh_from_db()
        self.assertEqual(self.group.name, 'beekeepers / ena')


class TrapOwnerChangeTests(TrapTestCase):
    def _put(self, user, guid):
        request = self.factory.put(f'/traps/{self.trap.id}/owner/', {'owner_guid': str(guid)})
        force_authenticate(request, user=user)
        return TrapViewSet.as_view({'put': 'owner'})(request, pk=self.trap.id)

    def test_admin_reassigns_a_bequeathed_trap(self):
        response = self._put(self.admin_user, self.member_guid)
        self.assertEqual(response.status_code, 200)
        self.trap.refresh_from_db()
        self.assertEqual(self.trap.owner_id, self.member.pk)

    def test_owner_cannot_reassign(self):
        self.assertEqual(self._put(self.owner_user, self.member_guid).status_code, 403)

    def test_unknown_user_is_rejected(self):
        self.assertEqual(self._put(self.admin_user, uuid_module.uuid4()).status_code, 400)


class TrapPhotoTests(TrapTestCase):
    def test_upload_is_resized_and_served_to_allowed_users_only(self):
        request = self.factory.post(f'/traps/{self.trap.id}/photo/',
                                    {'photo': _image_file()}, format='multipart')
        force_authenticate(request, user=self.owner_user)
        response = TrapViewSet.as_view({'post': 'photo'})(request, pk=self.trap.id)
        self.assertEqual(response.status_code, 200)

        self.trap.refresh_from_db()
        with Image.open(self.trap.photo.path) as image:
            self.assertLessEqual(max(image.size), 1600)
        self.addCleanup(self.trap.photo.delete, save=False)
        self.addCleanup(self.trap.photo_thumbnail.delete, save=False)

        path = self.trap.photo.name
        self.trap.visibility = Trap.VISIBILITY_GROUP
        self.trap.group = self.group
        self.trap.save()

        media_request = self.factory.get(f'/api/media/{path}')
        force_authenticate(media_request, user=self.member_user)
        self.assertEqual(media_view(media_request, path=path).status_code, 200)

        denied = self.factory.get(f'/api/media/{path}')
        force_authenticate(denied, user=self.stranger_user)
        self.assertEqual(media_view(denied, path=path).status_code, 404)

    def test_non_image_upload_is_rejected(self):
        bad = SimpleUploadedFile('note.txt', b'not an image', content_type='text/plain')
        request = self.factory.post(f'/traps/{self.trap.id}/photo/', {'photo': bad},
                                    format='multipart')
        force_authenticate(request, user=self.owner_user)
        response = TrapViewSet.as_view({'post': 'photo'})(request, pk=self.trap.id)
        self.assertEqual(response.status_code, 400)

    def test_path_traversal_is_refused(self):
        request = self.factory.get('/api/media/../secret')
        self.assertEqual(media_view(request, path='../secret').status_code, 404)

    def test_trap_type_photos_are_public(self):
        request = self.factory.get('/api/media/trap-types/unknown.jpg')
        # Public prefix, but the file does not exist
        self.assertEqual(media_view(request, path='trap-types/unknown.jpg').status_code, 404)


class TrapTypeAdminTests(TrapTestCase):
    def test_listing_is_open_to_any_authenticated_role(self):
        request = self.factory.get('/trap-types/')
        force_authenticate(request, user=self.owner_user)
        response = TrapTypeViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(any(t['slug'] == 'homemade' for t in response.data))

    def test_only_admin_can_create(self):
        payload = {'name': 'Nouveau type'}
        request = self.factory.post('/trap-types/', payload)
        force_authenticate(request, user=self.owner_user)
        self.assertEqual(TrapTypeViewSet.as_view({'post': 'create'})(request).status_code, 403)

        request = self.factory.post('/trap-types/', payload)
        force_authenticate(request, user=self.admin_user)
        self.assertEqual(TrapTypeViewSet.as_view({'post': 'create'})(request).status_code, 201)

    def test_deleting_a_type_in_use_returns_409_with_the_count(self):
        request = self.factory.delete(f'/trap-types/{self.trap_type.id}/')
        force_authenticate(request, user=self.admin_user)
        response = TrapTypeViewSet.as_view({'delete': 'destroy'})(request, pk=self.trap_type.id)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['trap_count'], 1)

    def test_deleting_an_unused_type_succeeds(self):
        unused = TrapType.objects.create(slug='unused', name='Inutilisé')
        request = self.factory.delete(f'/trap-types/{unused.id}/')
        force_authenticate(request, user=self.admin_user)
        response = TrapTypeViewSet.as_view({'delete': 'destroy'})(request, pk=unused.id)
        self.assertEqual(response.status_code, 204)

    def test_the_slug_is_derived_from_the_name(self):
        request = self.factory.post('/trap-types/', {'name': 'Piège cloche'})
        force_authenticate(request, user=self.admin_user)
        response = TrapTypeViewSet.as_view({'post': 'create'})(request)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['slug'], 'piege-cloche')

    def test_a_duplicate_name_still_gets_its_own_slug(self):
        TrapType.objects.create(slug='piege-cloche', name='Piège cloche')
        request = self.factory.post('/trap-types/', {'name': 'Piège cloche'})
        force_authenticate(request, user=self.admin_user)
        response = TrapTypeViewSet.as_view({'post': 'create'})(request)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['slug'], 'piege-cloche-1')

    def test_the_slug_is_not_writable(self):
        # It keys the seed migration and the API write fields: renaming a type
        # must not break the traps that point at it.
        request = self.factory.patch(
            f'/trap-types/{self.trap_type.id}/', {'slug': 'renamed', 'name': 'Renommé'})
        force_authenticate(request, user=self.admin_user)
        response = TrapTypeViewSet.as_view({'patch': 'partial_update'})(
            request, pk=self.trap_type.id)
        self.assertEqual(response.status_code, 200)
        self.trap_type.refresh_from_db()
        self.assertEqual(self.trap_type.slug, 'homemade')
        self.assertEqual(self.trap_type.name, 'Renommé')


class KeycloakGroupLookupTests(TestCase):
    """
    The fallback that reads a user's groups straight from Keycloak.

    It is only reached for a user who has not authenticated since their groups
    were last mirrored, so a wrong call signature stays invisible until that
    rare path runs. The mock is built from the real python-keycloak method, so
    passing an argument it does not accept fails here rather than in production.
    """

    def test_group_paths_are_read_with_a_supported_call(self):
        from unittest.mock import create_autospec, patch
        from keycloak import KeycloakAdmin
        from hornet_finder_api.utils import get_user_group_paths

        admin = create_autospec(KeycloakAdmin, instance=True)
        admin.get_user_groups.return_value = [
            {'id': '1', 'path': '/beekeepers/ena/admin'},
            {'id': '2', 'path': '/volunteers'},
            {'id': '3'},  # a group without a path is skipped
        ]
        with patch('hornet_finder_api.utils._get_keycloak_admin', return_value=admin):
            paths = get_user_group_paths('some-guid')

        self.assertEqual(paths, ['/beekeepers/ena/admin', '/volunteers'])
        admin.get_user_groups.assert_called_once_with('some-guid')

    def test_a_keycloak_failure_yields_no_group(self):
        from unittest.mock import patch
        from hornet_finder_api.utils import get_user_group_paths

        with patch('hornet_finder_api.utils._get_keycloak_admin', side_effect=RuntimeError('down')):
            self.assertEqual(get_user_group_paths('some-guid'), [])


# -- signed QR tags ------------------------------------------------------------

import base64 as _base64
import secrets as _secrets

from django.test import override_settings

from .models import Tag
from .tag_views import TagViewSet
from . import tags as tag_crypto

_KEY0 = _base64.urlsafe_b64encode(_secrets.token_bytes(32)).decode().rstrip('=')
_KEY1 = _base64.urlsafe_b64encode(_secrets.token_bytes(32)).decode().rstrip('=')
TAG_SETTINGS = dict(TAG_HMAC_KEYS=f'0:{_KEY0},1:{_KEY1}', TAG_HMAC_ACTIVE_INDEX='1',
                    TAG_SITE_ID='test.velutina', TAG_URL_HOST='test.velutina.ovh')


def _tamper(value, position):
    """Flip one bit of the decoded tag and re-encode it."""
    raw = bytearray(tag_crypto._b64decode(value))
    raw[position] ^= 0x01
    return _base64.urlsafe_b64encode(bytes(raw)).decode().rstrip('=')


@override_settings(**TAG_SETTINGS)
class TagCryptoTests(TestCase):
    def test_the_qr_code_carries_the_logo_on_its_centre(self):
        url = 'https://test.velutina.ovh/tag/' + tag_crypto.generate_tag_value()
        qr = tag_crypto.qr_code(url)
        self.assertEqual(qr.error, 'Q')
        offset, size = tag_crypto.logo_plate(qr)
        self.assertEqual(2 * offset + size, len(qr.matrix))
        svg = _base64.b64decode(tag_crypto.qr_svg_data_uri(url).split(',', 1)[1]).decode()
        self.assertIn('<image ', svg)
        self.assertIn('viewBox', svg)

    def test_round_trip_with_the_active_key(self):
        value = tag_crypto.generate_tag_value()
        self.assertEqual(len(value), 44)
        self.assertEqual(tag_crypto._b64decode(value)[0], 1)
        self.assertTrue(tag_crypto.verify_tag_value(value).valid)

    def test_an_older_key_stays_valid_after_rotation(self):
        value = tag_crypto.generate_tag_value()
        with override_settings(TAG_HMAC_KEYS=f'1:{_KEY1},2:{_KEY0}', TAG_HMAC_ACTIVE_INDEX='2'):
            self.assertTrue(tag_crypto.verify_tag_value(value).valid)

    def test_a_retired_key_invalidates_its_tags(self):
        value = tag_crypto.generate_tag_value()
        with override_settings(TAG_HMAC_KEYS=f'0:{_KEY0}', TAG_HMAC_ACTIVE_INDEX='0'):
            result = tag_crypto.verify_tag_value(value)
        self.assertFalse(result.valid)
        self.assertEqual((result.key_index, result.reason), (1, 'unknown key'))

    def test_any_altered_byte_is_rejected(self):
        value = tag_crypto.generate_tag_value()
        # 0: key index (both keys exist), 5: random part, 30: MAC
        for position in (0, 5, 30):
            self.assertFalse(tag_crypto.verify_tag_value(_tamper(value, position)).valid, position)

    def test_another_site_id_is_rejected(self):
        value = tag_crypto.generate_tag_value()
        with override_settings(TAG_SITE_ID='other.site'):
            self.assertFalse(tag_crypto.verify_tag_value(value).valid)

    def test_malformed_values_are_rejected(self):
        value = tag_crypto.generate_tag_value()
        for bad in ('', value[:43], value + 'A', value[:43] + '=', value[:43] + '+', None):
            self.assertEqual(tag_crypto.verify_tag_value(bad).reason, 'format', bad)

    def test_configuration_is_validated(self):
        bad_specs = [f'{_KEY0}', f'x:{_KEY0}', f'300:{_KEY0}', f'0:{_KEY0},0:{_KEY1}', '0:c2hvcnQ']
        for spec in bad_specs:
            with self.assertRaises(tag_crypto.TagConfigurationError, msg=spec):
                tag_crypto.parse_keys(spec)
        for overrides in ({'TAG_HMAC_KEYS': ''}, {'TAG_SITE_ID': ''},
                          {'TAG_HMAC_ACTIVE_INDEX': '7'}, {'TAG_HMAC_ACTIVE_INDEX': ''}):
            with override_settings(**overrides), self.assertRaises(
                    tag_crypto.TagConfigurationError, msg=str(overrides)):
                tag_crypto.get_config()


@override_settings(**TAG_SETTINGS)
class TagApiTests(TrapTestCase):
    def _tag_call(self, method, url, actions, user, data=None, **view_kwargs):
        request = getattr(self.factory, method)(url, data, format='json')
        force_authenticate(request, user=user)
        return TagViewSet.as_view(actions)(request, **view_kwargs)

    def _batch(self, user, count=2):
        return self._tag_call('post', '/tags/batch/', {'post': 'batch'}, user, {'count': count})

    def _resolve(self, value, user):
        return self._tag_call('get', f'/tags/{value}/', {'get': 'retrieve'}, user, value=value)

    def _associate(self, value, user, trap_id, replace=None):
        data = {'trap_id': trap_id}
        if replace is not None:
            data['replace'] = replace
        return self._tag_call('post', f'/tags/{value}/associate/', {'post': 'associate'},
                              user, data, value=value)

    def _new_tag(self, user=None):
        return self._batch(user or self.owner_user, 1).data[0]['value']

    def test_batch_creates_signed_free_tags(self):
        response = self._batch(self.owner_user, 3)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data), 3)
        first = response.data[0]
        self.assertTrue(first['url'].startswith('https://test.velutina.ovh/tag/'))
        self.assertTrue(first['qr_svg'].startswith('data:image/svg+xml'))
        tag = Tag.objects.get(value=first['value'])
        self.assertEqual((tag.key_index, tag.generated_by_id), (1, self.owner_guid))
        self.assertEqual(self._resolve(first['value'], self.owner_user).data['status'],
                         'unassociated')

    def test_batch_size_is_bounded(self):
        self.assertEqual(self._batch(self.owner_user, 0).status_code, 400)
        self.assertEqual(self._batch(self.owner_user, 49).status_code, 400)

    def test_a_forged_tag_is_rejected_and_logged(self):
        forged = _tamper(self._new_tag(), 30)
        with self.assertLogs('hornet.tag_views', level='WARNING') as logs:
            response = self._resolve(forged, self.owner_user)
        self.assertEqual((response.status_code, response.data['code']), (400, 'invalid'))
        self.assertIn('invalid signature', logs.output[0])

    def test_a_signed_but_unknown_tag_is_rejected_and_logged(self):
        value = tag_crypto.generate_tag_value()
        with self.assertLogs('hornet.tag_views', level='WARNING'):
            response = self._resolve(value, self.owner_user)
        self.assertEqual(response.status_code, 404)

    def test_owner_associates_and_the_tag_resolves_to_the_trap(self):
        value = self._new_tag()
        response = self._associate(value, self.owner_user, self.trap.id)
        self.assertEqual(response.status_code, 200)
        resolved = self._resolve(value, self.member_user)
        self.assertEqual(resolved.data['status'], 'associated')
        self.assertEqual(resolved.data['trap']['id'], self.trap.id)
        self.assertEqual(resolved.data['trap']['tag_short'], value[2:10])

    def test_a_stranger_cannot_associate(self):
        value = self._new_tag(self.stranger_user)
        with self.assertLogs('hornet.tag_views', level='WARNING'):
            response = self._associate(value, self.stranger_user, self.trap.id)
        self.assertEqual(response.status_code, 403)
        self.assertIsNone(Tag.objects.get(value=value).trap_id)

    def test_an_admin_associates_any_tag_with_any_trap(self):
        value = self._new_tag(self.stranger_user)
        self.assertEqual(self._associate(value, self.admin_user, self.trap.id).status_code, 200)

    def test_replacing_needs_confirmation_and_revokes_the_old_tag(self):
        old, new = self._new_tag(), self._new_tag()
        self._associate(old, self.owner_user, self.trap.id)

        refused = self._associate(new, self.owner_user, self.trap.id)
        self.assertEqual((refused.status_code, refused.data['code']), (409, 'trap_has_tag'))
        self.assertEqual(refused.data['existing_short'], old[2:10])

        self.assertEqual(self._associate(new, self.owner_user, self.trap.id, True).status_code, 200)
        self.assertEqual(self._resolve(old, self.owner_user).status_code, 410)
        self.assertEqual(self._resolve(new, self.owner_user).data['trap']['id'], self.trap.id)
        self.assertEqual(Tag.objects.filter(trap=self.trap, revoked_at__isnull=True).count(), 1)

    def test_an_associated_tag_cannot_be_moved(self):
        value = self._new_tag()
        self._associate(value, self.owner_user, self.trap.id)
        other = Trap.objects.create(latitude=50.6, longitude=4.6, owner=self.owner,
                                    trap_type=self.trap_type, installed_at=timezone.now().date())
        self.assertEqual(self._associate(value, self.owner_user, other.id).status_code, 409)

    def test_a_group_trap_is_hidden_from_strangers(self):
        value = self._new_tag()
        self._associate(value, self.owner_user, self.trap.id)
        self.trap.group, self.trap.visibility = self.group, Trap.VISIBILITY_GROUP
        self.trap.save()
        with self.assertLogs('hornet.tag_views', level='WARNING'):
            self.assertEqual(self._resolve(value, self.stranger_user).status_code, 403)

    def test_candidates_are_the_owners_traps(self):
        value = self._new_tag()
        def candidates(user):
            return self._tag_call('get', f'/tags/{value}/candidates/', {'get': 'candidates'},
                                  user, value=value).data
        self.assertEqual([c['id'] for c in candidates(self.owner_user)], [self.trap.id])
        self.assertEqual(candidates(self.stranger_user), [])
        self.assertEqual([c['id'] for c in candidates(self.admin_user)], [self.trap.id])

    def test_missing_configuration_answers_503(self):
        with override_settings(TAG_HMAC_KEYS=''):
            with self.assertLogs('hornet.tag_views', level='ERROR'):
                self.assertEqual(self._batch(self.owner_user).status_code, 503)


@override_settings(**TAG_SETTINGS)
class TagAdminApiTests(TrapTestCase):
    """The administration endpoints: listing, key usage, revocation."""

    def setUp(self):
        super().setUp()
        request = self.factory.post('/tags/batch/', {'count': 3}, format='json')
        force_authenticate(request, user=self.owner_user)
        values = [t['value'] for t in TagViewSet.as_view({'post': 'batch'})(request).data]
        self.free, self.attached, self.revoked = (Tag.objects.get(value=v) for v in values)
        self.attached.trap = self.trap
        self.attached.save()
        self.revoked.revoked_at = timezone.now()
        self.revoked.save()

    def _admin(self, method, url, actions, user, **view_kwargs):
        request = getattr(self.factory, method)(url)
        force_authenticate(request, user=user)
        from .tag_views import TagAdminViewSet
        return TagAdminViewSet.as_view(actions)(request, **view_kwargs)

    def test_only_admins_get_in(self):
        self.assertEqual(self._admin('get', '/admin/tags/', {'get': 'list'}, self.owner_user).status_code, 403)

    def test_list_filters_by_status(self):
        for state, expected in (('free', self.free), ('associated', self.attached), ('revoked', self.revoked)):
            response = self._admin('get', f'/admin/tags/?status={state}', {'get': 'list'}, self.admin_user)
            self.assertEqual([row['id'] for row in response.data['results']], [expected.id], state)
            self.assertEqual(response.data['results'][0]['status'], state)
        everything = self._admin('get', '/admin/tags/', {'get': 'list'}, self.admin_user)
        self.assertEqual(everything.data['count'], 3)

    def test_search_by_trap_id(self):
        response = self._admin('get', f'/admin/tags/?q={self.trap.id}', {'get': 'list'}, self.admin_user)
        self.assertIn(self.attached.id, [row['id'] for row in response.data['results']])

    def test_key_usage(self):
        response = self._admin('get', '/admin/tags/keys/', {'get': 'keys'}, self.admin_user)
        rows = {row['index']: row for row in response.data}
        self.assertEqual(rows[1], {'index': 1, 'state': 'active', 'associated': 1, 'free': 1, 'revoked': 1})
        self.assertEqual(rows[0]['state'], 'configured')

    def test_revoke_then_scan_is_refused(self):
        response = self._admin('post', f'/admin/tags/{self.attached.id}/revoke/', {'post': 'revoke'},
                               self.admin_user, pk=self.attached.id)
        self.assertEqual((response.status_code, response.data['status']), (200, 'revoked'))
        request = self.factory.get(f'/tags/{self.attached.value}/')
        force_authenticate(request, user=self.owner_user)
        scanned = TagViewSet.as_view({'get': 'retrieve'})(request, value=self.attached.value)
        self.assertEqual(scanned.status_code, 410)
        again = self._admin('post', f'/admin/tags/{self.attached.id}/revoke/', {'post': 'revoke'},
                            self.admin_user, pk=self.attached.id)
        self.assertEqual(again.status_code, 409)

    def _sheet(self, user, values):
        request = self.factory.post('/tags/sheet/', {'values': values}, format='json')
        force_authenticate(request, user=user)
        return TagViewSet.as_view({'post': 'sheet'})(request)

    def test_owner_prints_a_pdf_of_their_live_tags_only(self):
        values = [self.free.value, self.attached.value, self.revoked.value]
        response = self._sheet(self.owner_user, values)
        self.assertEqual((response.status_code, response.data['count']), (200, 2))
        pdf = self.client.get(response.data['url'])
        self.assertEqual((pdf.status_code, pdf['Content-Type']), (200, 'application/pdf'))
        self.assertTrue(pdf.content.startswith(b'%PDF'))
        self.assertTrue(pdf['Content-Disposition'].startswith('inline'))
        # Somebody else's tags, or only unprintable ones: nothing to print
        self.assertEqual(self._sheet(self.member_user, [self.free.value, self.attached.value]).status_code, 400)
        self.assertEqual(self._sheet(self.owner_user, [self.revoked.value]).status_code, 400)
        self.assertEqual(self._sheet(self.owner_user, []).status_code, 400)

    def test_an_admin_prints_any_live_tag(self):
        response = self._sheet(self.admin_user, [self.attached.value])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._sheet(self.admin_user, [self.revoked.value]).status_code, 400)

    def test_a_sheet_link_is_signed_and_expires(self):
        from django.core import signing
        from .tag_views import SHEET_LINK_SECONDS
        url = self._sheet(self.owner_user, [self.free.value]).data['url']
        self.assertEqual(self.client.get(url).status_code, 200)
        # A link naming other tags cannot be forged
        forged = url.replace(url.rstrip('/').rsplit('/', 1)[1], signing.dumps({'ids': [self.attached.id]}))
        with self.assertLogs('hornet.tag_views', level='WARNING'):
            self.assertEqual(self.client.get(forged).status_code, 404)
        with patch('django.core.signing.time.time', return_value=time.time() + SHEET_LINK_SECONDS + 5):
            self.assertEqual(self.client.get(url).status_code, 410)
        # Revoked since the link was made: nothing left to print
        self.free.revoked_at = timezone.now()
        self.free.save()
        self.assertEqual(self.client.get(url).status_code, 410)

    def test_tags_in_use_are_listed_with_their_trap(self):
        request = self.factory.get('/tags/?associated=1')
        force_authenticate(request, user=self.owner_user)
        rows = TagViewSet.as_view({'get': 'list'})(request).data
        self.assertEqual([row['value'] for row in rows], [self.attached.value])
        self.assertEqual(rows[0]['caption'], f"Piège #{self.trap.id}")
        request = self.factory.get('/tags/?associated=1')
        force_authenticate(request, user=self.member_user)
        self.assertEqual(TagViewSet.as_view({'get': 'list'})(request).data, [])

    def test_an_admin_reprints_a_selection(self):
        from .tag_views import TagAdminViewSet
        def sheet(user, ids):
            request = self.factory.post('/admin/tags/sheet/', {'ids': ids}, format='json')
            force_authenticate(request, user=user)
            return TagAdminViewSet.as_view({'post': 'sheet'})(request)
        response = sheet(self.admin_user, [self.attached.id, self.free.id, self.revoked.id])
        self.assertEqual(response.data['count'], 2)
        self.assertTrue(self.client.get(response.data['url']).content.startswith(b'%PDF'))
        self.assertEqual(sheet(self.admin_user, [self.revoked.id]).status_code, 400)
        self.assertEqual(sheet(self.admin_user, ['x']).status_code, 400)
        self.assertEqual(sheet(self.owner_user, [self.free.id]).status_code, 403)


class TrapCatchTests(TrapTestCase):
    """One visit's catches: several species recorded together."""

    def _post_catches(self, items, user=None, **extra):
        data = {'performed_at': timezone.now().isoformat(), 'items': json.dumps(items)}
        data.update(extra)
        request = self.factory.post(f'/traps/{self.trap.id}/catches/', data, format='multipart')
        force_authenticate(request, user=user or self.owner_user)
        return TrapViewSet.as_view({'post': 'catches'})(request, pk=self.trap.id)

    def _delete_batch(self, batch, user=None):
        request = self.factory.delete(f'/traps/{self.trap.id}/catches/{batch}/')
        force_authenticate(request, user=user or self.owner_user)
        return TrapViewSet.as_view({'delete': 'delete_catches'})(
            request, pk=self.trap.id, batch=batch)

    def _cleanup_photos(self):
        for photo in TrapPhoto.objects.filter(trap=self.trap):
            self.addCleanup(photo.image.delete, save=False)
            self.addCleanup(photo.thumbnail.delete, save=False)

    def test_one_event_per_species_sharing_a_batch_and_a_time(self):
        response = self._post_catches([
            {'species_slug': 'vespa-velutina', 'quantity': 12},
            {'species_slug': 'apis-mellifera', 'quantity': 3},
            {'species_slug': 'vespa-crabro', 'quantity': 1},
        ], comments='Harpe pleine')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data), 3)

        events = TrapEvent.objects.filter(trap=self.trap)
        self.assertEqual({event.batch for event in events}, {events[0].batch})
        self.assertIsNotNone(events[0].batch)
        self.assertEqual(len({event.performed_at for event in events}), 1)
        # The comment belongs to the visit, it is not repeated per species
        self.assertEqual([e.comments for e in events if e.comments], ['Harpe pleine'])

        self.trap.refresh_from_db()
        self.assertEqual(self.trap.hornet_catch_count, 12)

    def test_each_item_gets_its_own_photo(self):
        response = self._post_catches(
            [{'species_slug': 'vespa-velutina', 'quantity': 2},
             {'species_slug': 'apis-mellifera', 'quantity': 1}],
            photo_1=_image_file(),
        )
        self._cleanup_photos()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data[0]['photos'], [])
        self.assertEqual(len(response.data[1]['photos']), 1)

    def test_an_invalid_item_records_nothing(self):
        response = self._post_catches([
            {'species_slug': 'vespa-velutina', 'quantity': 2},
            {'species_slug': 'unknown-species', 'quantity': 1},
        ])
        self.assertEqual(response.status_code, 400)
        self.assertFalse(TrapEvent.objects.filter(trap=self.trap).exists())

    def test_a_bad_photo_rolls_the_whole_visit_back(self):
        bad = SimpleUploadedFile('note.txt', b'not an image', content_type='text/plain')
        response = self._post_catches(
            [{'species_slug': 'vespa-velutina', 'quantity': 2},
             {'species_slug': 'apis-mellifera', 'quantity': 1}],
            photo_0=_image_file(), photo_1=bad,
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(TrapEvent.objects.filter(trap=self.trap).exists())
        self.assertFalse(TrapPhoto.objects.filter(trap=self.trap).exists())

    def test_duplicates_and_empty_lists_are_refused(self):
        self.assertEqual(self._post_catches(
            [{'species_slug': 'vespa-velutina', 'quantity': 1},
             {'species_slug': 'vespa-velutina', 'quantity': 2}]).status_code, 400)
        self.assertEqual(self._post_catches([]).status_code, 400)

    def test_a_reading_without_catch_keeps_a_zero_hornet_event(self):
        response = self._post_catches([{'species_slug': 'vespa-velutina', 'quantity': 0}],
                                      bycatch_counted='true')
        self.assertEqual(response.status_code, 201)
        event = TrapEvent.objects.get(trap=self.trap)
        self.assertEqual((event.species.slug, event.quantity), ('vespa-velutina', 0))
        self.assertTrue(event.bycatch_counted)
        self.trap.refresh_from_db()
        self.assertEqual(self.trap.hornet_catch_count, 0)

    def test_only_the_asian_hornet_can_be_recorded_at_zero(self):
        response = self._post_catches([{'species_slug': 'vespa-velutina', 'quantity': 2},
                                       {'species_slug': 'apis-mellifera', 'quantity': 0}])
        self.assertEqual(response.status_code, 400)
        self.assertFalse(TrapEvent.objects.filter(trap=self.trap).exists())

    def test_bycatch_counted_is_stored_on_every_catch_of_the_reading(self):
        self._post_catches([{'species_slug': 'vespa-velutina', 'quantity': 3}],
                           bycatch_counted='false')
        self.assertEqual(list(TrapEvent.objects.values_list('bycatch_counted', flat=True)),
                         [False])

    def test_bycatch_counted_is_unknown_when_not_said(self):
        self._post_catches([{'species_slug': 'vespa-velutina', 'quantity': 3}])
        self.assertIsNone(TrapEvent.objects.get(trap=self.trap).bycatch_counted)

    def test_recording_another_species_means_the_bycatch_was_counted(self):
        self._post_catches([{'species_slug': 'vespa-velutina', 'quantity': 3},
                            {'species_slug': 'apis-mellifera', 'quantity': 1}],
                           bycatch_counted='false')
        self.assertEqual(set(TrapEvent.objects.values_list('bycatch_counted', flat=True)),
                         {True})

    def test_actions_of_the_visit_join_its_batch(self):
        response = self._post_catches([{'species_slug': 'vespa-velutina', 'quantity': 4}],
                                      actions=json.dumps(['cleaning', 'repair']))
        self.assertEqual(response.status_code, 201)
        events = TrapEvent.objects.filter(trap=self.trap)
        self.assertEqual(sorted(event.kind for event in events),
                         ['catch', 'cleaning', 'repair'])
        self.assertEqual(len({event.batch for event in events}), 1)
        self.assertEqual(len({event.performed_at for event in events}), 1)
        actions = events.exclude(kind=TrapEvent.KIND_CATCH)
        self.assertEqual({(e.species_id, e.quantity, e.bycatch_counted) for e in actions},
                         {(None, None, None)})

        self.assertEqual(self._delete_batch(response.data[0]['batch']).status_code, 204)
        self.assertFalse(TrapEvent.objects.filter(trap=self.trap).exists())

    def test_a_visit_takes_only_maintenance_actions_once(self):
        for actions in (['removal'], ['catch'], ['cleaning', 'cleaning']):
            response = self._post_catches([{'species_slug': 'vespa-velutina', 'quantity': 1}],
                                          actions=json.dumps(actions))
            self.assertEqual(response.status_code, 400, actions)
        self.assertFalse(TrapEvent.objects.filter(trap=self.trap).exists())

    def test_a_stranger_cannot_record_catches(self):
        response = self._post_catches([{'species_slug': 'vespa-velutina', 'quantity': 1}],
                                      user=self.stranger_user)
        self.assertEqual(response.status_code, 403)

    def test_deleting_a_batch_removes_all_its_events(self):
        created = self._post_catches(
            [{'species_slug': 'vespa-velutina', 'quantity': 5},
             {'species_slug': 'apis-mellifera', 'quantity': 1}],
            photo_0=_image_file(),
        )
        photo = TrapPhoto.objects.get(trap=self.trap)
        batch = created.data[0]['batch']

        response = self._delete_batch(batch)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(TrapEvent.objects.filter(trap=self.trap).exists())
        self.assertFalse(photo.image.storage.exists(photo.image.name))
        self.trap.refresh_from_db()
        self.assertEqual(self.trap.hornet_catch_count, 0)

    def test_deleting_a_batch_requires_every_event_to_be_deletable(self):
        created = self._post_catches([{'species_slug': 'vespa-velutina', 'quantity': 5}])
        response = self._delete_batch(created.data[0]['batch'], user=self.stranger_user)
        self.assertEqual(response.status_code, 403)
        self.assertTrue(TrapEvent.objects.filter(trap=self.trap).exists())

    def test_unknown_batch_is_404(self):
        self.assertEqual(self._delete_batch(str(uuid_module.uuid4())).status_code, 404)

    def test_a_trap_that_does_not_accumulate_is_always_emptied(self):
        self._post_catches([{'species_slug': 'vespa-velutina', 'quantity': 4}], emptied='false')
        event = TrapEvent.objects.get(trap=self.trap)
        self.assertEqual((event.observed_quantity, event.quantity, event.emptied), (4, 4, True))
        self.trap.refresh_from_db()
        self.assertIsNone(self.trap.contents)


class TrapAccumulationTests(TrapTestCase):
    """Readings of a trap whose catches pile up between emptyings."""

    def setUp(self):
        super().setUp()
        self.trap.trap_type = TrapType.objects.create(slug='harp-test', name='Harpe test',
                                                      accumulates=True)
        self.trap.save()
        self.day = timezone.now() - timedelta(days=30)

    def _read(self, day, emptied, hornets, bees=None, **extra):
        items = [{'species_slug': 'vespa-velutina', 'quantity': hornets}]
        if bees is not None:
            items.append({'species_slug': 'apis-mellifera', 'quantity': bees})
        data = {'performed_at': (self.day + timedelta(days=day)).isoformat(),
                'items': json.dumps(items), **extra}
        if emptied is not None:
            data['emptied'] = 'true' if emptied else 'false'
        request = self.factory.post(f'/traps/{self.trap.id}/catches/', data, format='multipart')
        force_authenticate(request, user=self.owner_user)
        return TrapViewSet.as_view({'post': 'catches'})(request, pk=self.trap.id)

    def _caught(self, slug='vespa-velutina'):
        """Derived catches of each reading of a species, oldest first."""
        return list(TrapEvent.objects.filter(trap=self.trap, species__slug=slug)
                    .order_by('performed_at').values_list('quantity', flat=True))

    def test_the_trap_must_say_whether_it_was_emptied(self):
        response = self._read(0, None, 3)
        self.assertEqual(response.status_code, 400)
        self.assertIn('emptied', response.data)

    def test_catches_are_what_was_seen_beyond_what_was_left(self):
        response = self._read(0, False, 5)
        self.assertEqual(response.data[0]['quantity'], 5)
        self.trap.refresh_from_db()
        self.assertEqual(self.trap.contents['items'],
                         [{'species_slug': 'vespa-velutina', 'quantity': 5}])

        response = self._read(7, True, 8)
        self.assertEqual((response.data[0]['quantity'], response.data[0]['observed_quantity']),
                         (3, 8))
        self.trap.refresh_from_db()
        self.assertIsNone(self.trap.contents)
        self.assertEqual(self.trap.hornet_catch_count, 8)

        # Emptied: the next reading starts from zero again
        self._read(14, False, 2)
        self.assertEqual(self._caught(), [5, 3, 2])

    def test_fewer_insects_than_left_is_no_catch_not_a_negative_one(self):
        self._read(0, False, 5)
        self._read(7, False, 3)
        self._read(14, False, 6)
        self.assertEqual(self._caught(), [5, 0, 3])

    def test_a_reading_recorded_late_shifts_the_following_ones(self):
        self._read(0, False, 5)
        self._read(14, False, 9)
        self.assertEqual(self._caught(), [5, 4])
        # Forgotten reading of day 7, where the trap was emptied
        self._read(7, True, 7)
        self.assertEqual(self._caught(), [5, 2, 9])
        self.trap.refresh_from_db()
        self.assertEqual(self.trap.hornet_catch_count, 16)

    def test_deleting_a_reading_shifts_the_following_ones(self):
        first = self._read(0, False, 5)
        self._read(7, True, 8)
        request = self.factory.delete(f'/traps/{self.trap.id}/catches/{first.data[0]["batch"]}/')
        force_authenticate(request, user=self.owner_user)
        TrapViewSet.as_view({'delete': 'delete_catches'})(
            request, pk=self.trap.id, batch=first.data[0]['batch'])
        self.assertEqual(self._caught(), [8])

    def test_correcting_a_count_shifts_the_following_readings(self):
        first = self._read(0, False, 5)
        self._read(7, True, 8)
        request = self.factory.patch(f'/trap-events/{first.data[0]["id"]}/', {'quantity': 6},
                                     format='json')
        force_authenticate(request, user=self.owner_user)
        response = TrapEventViewSet.as_view({'patch': 'partial_update'})(
            request, pk=first.data[0]['id'])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['observed_quantity'], 6)
        self.assertEqual(self._caught(), [6, 2])

    def test_other_species_left_in_place_are_not_caught_twice(self):
        self._read(0, False, 2, bees=3)
        # Still three bees, no new one: recorded all the same, as what is there
        response = self._read(7, False, 2, bees=3)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self._caught('apis-mellifera'), [3, 0])
        self._read(14, True, 4, bees=5)
        self.assertEqual(self._caught('apis-mellifera'), [3, 0, 2])
        self.assertEqual(set(TrapEvent.objects.values_list('bycatch_counted', flat=True)), {True})

    def test_other_species_left_uncounted_keep_the_next_reading_out_of_selectivity(self):
        self._read(0, False, 2, bycatch_counted='false')
        self.trap.refresh_from_db()
        self.assertFalse(self.trap.contents['others_counted'])
        # The bees were there already, how many is unknown: not a selectivity reading
        self._read(7, True, 3, bees=4)
        reading = TrapEvent.objects.filter(trap=self.trap).order_by('-performed_at')
        self.assertEqual({event.bycatch_counted for event in reading[:2]}, {False})
        self.assertEqual(self._caught(), [2, 1])
        # Emptied since: the next reading is complete again
        self._read(14, True, 1, bees=1)
        self.assertTrue(TrapEvent.objects.filter(trap=self.trap).order_by('-performed_at')
                        .first().bycatch_counted)

    def test_an_installation_puts_the_trap_in_service_empty(self):
        self._read(0, False, 5)
        TrapEvent.objects.create(trap=self.trap, kind=TrapEvent.KIND_INSTALLATION,
                                 performed_at=self.day + timedelta(days=3))
        self.trap.recompute_catches()
        self._read(7, False, 2)
        self.assertEqual(self._caught(), [5, 2])

    def test_the_trap_exposes_its_type_and_contents(self):
        self._read(0, False, 5)
        data = TrapSerializer(Trap.objects.get(pk=self.trap.pk)).data
        self.assertTrue(data['trap_type']['accumulates'])
        self.assertEqual(data['contents']['items'],
                         [{'species_slug': 'vespa-velutina', 'quantity': 5}])


class SpeciesAdminTests(TrapTestCase):
    def test_admin_uploads_a_photo_served_publicly(self):
        self.other_species.photo_credit = 'Someone — CC BY-SA 4.0, Wikimedia Commons'
        self.other_species.save()
        request = self.factory.patch(f'/species/{self.other_species.id}/',
                                     {'photo': _image_file()}, format='multipart')
        force_authenticate(request, user=self.admin_user)
        response = SpeciesViewSet.as_view({'patch': 'partial_update'})(
            request, pk=self.other_species.id)
        self.assertEqual(response.status_code, 200)

        self.other_species.refresh_from_db()
        self.addCleanup(self.other_species.photo.delete, save=False)
        self.addCleanup(self.other_species.photo_thumbnail.delete, save=False)
        path = self.other_species.photo_thumbnail.name
        self.assertTrue(path.startswith('species/'))
        # The Wikipedia credit does not describe the uploaded picture
        self.assertEqual(self.other_species.photo_credit, '')

        # No authentication at all: species pictures are public
        anonymous = self.factory.get(f'/api/media/{path}')
        self.assertEqual(media_view(anonymous, path=path).status_code, 200)

    def test_the_slug_is_derived_on_creation(self):
        request = self.factory.post('/species/', {'name': 'Frelon oriental',
                                                  'scientific_name': 'Vespa orientalis'})
        force_authenticate(request, user=self.admin_user)
        response = SpeciesViewSet.as_view({'post': 'create'})(request)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['slug'], 'vespa-orientalis')
        # A new species goes to the end of the list
        self.assertEqual(response.data['sort_order'], Species.objects.count() - 1)

    def _reorder(self, user, ids):
        request = self.factory.post('/species/reorder/', {'ids': ids}, format='json')
        force_authenticate(request, user=user)
        return SpeciesViewSet.as_view({'post': 'reorder'})(request)

    def test_admin_reorders_the_species(self):
        ids = list(Species.objects.values_list('id', flat=True))[::-1]
        self.assertEqual(self._reorder(self.admin_user, ids).status_code, 204)
        self.assertEqual(list(Species.objects.values_list('id', flat=True)), ids)
        self.assertEqual(list(Species.objects.values_list('sort_order', flat=True)),
                         list(range(len(ids))))

    def test_reordering_needs_every_species_exactly_once(self):
        ids = list(Species.objects.values_list('id', flat=True))
        before = list(Species.objects.values_list('sort_order', flat=True))
        for bad in (ids[:-1], ids + [ids[0]], ids + [max(ids) + 1], 'x', None):
            self.assertEqual(self._reorder(self.admin_user, bad).status_code, 400)
        self.assertEqual(list(Species.objects.values_list('sort_order', flat=True)), before)

    def test_only_admins_reorder_the_species(self):
        ids = list(Species.objects.values_list('id', flat=True))
        self.assertEqual(self._reorder(self.owner_user, ids).status_code, 403)

    def test_the_listing_counts_the_events(self):
        TrapEvent.objects.create(trap=self.trap, kind=TrapEvent.KIND_CATCH,
                                 performed_at=timezone.now(), species=self.velutina, quantity=2)
        request = self.factory.get('/species/')
        force_authenticate(request, user=self.owner_user)
        response = SpeciesViewSet.as_view({'get': 'list'})(request)
        counts = {row['slug']: row['event_count'] for row in response.data}
        self.assertEqual(counts['vespa-velutina'], 1)
        self.assertEqual(counts['apis-mellifera'], 0)


class FetchSpeciesPhotosTests(TestCase):
    """The Wikipedia lookup, with the network replaced by canned answers."""

    def setUp(self):
        self.species = Species.objects.get(slug='apis-mellifera')
        buffer = io.BytesIO()
        Image.new('RGB', (800, 600), (200, 180, 40)).save(buffer, format='JPEG')
        self.jpeg = buffer.getvalue()

    def _fake_get(self, url):
        if '/api/rest_v1/page/summary/' in url:
            # The accented title must reach the API percent-encoded
            self.assertIn('Abeille_europ%C3%A9enne', url)
            return json.dumps({'originalimage': {
                'source': 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Apis_%281%29.jpg',
            }}).encode()
        if '/w/api.php' in url:
            self.assertIn('File%3AApis_%281%29.jpg', url)
            return json.dumps({'query': {'pages': [{'imageinfo': [{
                'url': 'https://upload.wikimedia.org/full.jpg',
                'thumburl': 'https://upload.wikimedia.org/thumb.jpg',
                'descriptionurl': 'https://commons.wikimedia.org/wiki/File:Apis_(1).jpg',
                'extmetadata': {
                    'Artist': {'value': '<a href="//commons.wikimedia.org/wiki/User:X">Jane &amp; Co</a>'},
                    'LicenseShortName': {'value': 'CC BY-SA 4.0'},
                },
            }]}]}}).encode()
        self.assertEqual(url, 'https://upload.wikimedia.org/thumb.jpg')
        return self.jpeg

    def test_stores_the_lead_image_with_its_credit(self):
        with patch('hornet.management.commands.fetch_species_photos._get', side_effect=self._fake_get), \
                patch('hornet.management.commands.fetch_species_photos.time.sleep'):
            call_command('fetch_species_photos', slug=['apis-mellifera'], stdout=io.StringIO())

        self.species.refresh_from_db()
        self.addCleanup(self.species.photo.delete, save=False)
        self.addCleanup(self.species.photo_thumbnail.delete, save=False)
        self.assertTrue(self.species.photo.name.startswith('species/'))
        self.assertTrue(self.species.photo_thumbnail)
        self.assertEqual(self.species.photo_credit, 'Jane & Co — CC BY-SA 4.0, Wikimedia Commons')
        self.assertEqual(self.species.photo_source_url,
                         'https://commons.wikimedia.org/wiki/File:Apis_(1).jpg')

    def test_the_original_name_is_read_behind_a_thumbnail_url(self):
        from hornet.management.commands.fetch_species_photos import _file_name
        self.assertEqual(_file_name(
            'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/'
            '%28MHNT%29_Apis.jpg/3840px-%28MHNT%29_Apis.jpg'), '(MHNT)_Apis.jpg')
        self.assertEqual(_file_name(
            'https://upload.wikimedia.org/wikipedia/commons/a/ab/Apis_%281%29.jpg'), 'Apis_(1).jpg')

    def test_species_with_a_photo_are_skipped_without_force(self):
        self.species.photo = 'species/existing.jpg'
        self.species.save()
        with patch('hornet.management.commands.fetch_species_photos._get') as fake_get:
            call_command('fetch_species_photos', slug=['apis-mellifera'], stdout=io.StringIO())
        fake_get.assert_not_called()


# -- profile photo -------------------------------------------------------------

import os
import shutil as _shutil
import tempfile as _tempfile
from pathlib import Path

from .profile_views import my_avatar

_AVATAR_MEDIA = Path(_tempfile.mkdtemp(prefix='avatar-tests-'))


@override_settings(MEDIA_ROOT=_AVATAR_MEDIA, PUBLIC_HOST='test.velutina.ovh')
class AvatarTests(TestCase):
    """Upload, replacement and removal of the signed-in user's photo."""

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        _shutil.rmtree(_AVATAR_MEDIA, ignore_errors=True)

    def setUp(self):
        self.factory = APIRequestFactory()
        self.guid = uuid_module.uuid4()
        self.user = User.objects.create(guid=self.guid)
        self.jwt_user = FakeTrapUser(['trapper'], self.guid)
        patcher = patch('hornet.profile_views.set_user_picture')
        self.set_picture = patcher.start()
        self.addCleanup(patcher.stop)

    def _call(self, method, data=None, user='self'):
        kwargs = {'format': 'multipart'} if data is not None else {}
        request = getattr(self.factory, method)('/api/me/avatar/', data, **kwargs)
        if user == 'self':
            force_authenticate(request, user=self.jwt_user)
        return my_avatar(request)

    def test_upload_stores_a_public_square_photo_and_updates_keycloak(self):
        response = self._call('post', {'photo': _image_file(size=(1200, 800))})
        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()
        with Image.open(self.user.avatar.path) as image:
            self.assertEqual(image.size, (256, 256))
        url = response.data['url']
        self.assertEqual(
            url, f'https://test.velutina.ovh/api/media/{self.user.avatar.name}')
        self.assertTrue(self.user.avatar.name.startswith(f'avatars/{self.guid}/'))
        self.set_picture.assert_called_once_with(str(self.guid), url)

        # Public: the Keycloak account console loads it without any token
        anonymous = self.factory.get(f'/api/media/{self.user.avatar.name}')
        self.assertEqual(media_view(anonymous, path=self.user.avatar.name).status_code, 200)

    def test_replacing_the_photo_removes_the_previous_file(self):
        self._call('post', {'photo': _image_file()})
        self.user.refresh_from_db()
        first = self.user.avatar.path

        self._call('post', {'photo': _image_file()})
        self.user.refresh_from_db()
        self.assertNotEqual(self.user.avatar.path, first)
        self.assertFalse(os.path.exists(first))

    def test_removal_deletes_the_file_and_the_keycloak_attribute(self):
        self._call('post', {'photo': _image_file()})
        self.user.refresh_from_db()
        path = self.user.avatar.path

        response = self._call('delete')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['url'])
        self.user.refresh_from_db()
        self.assertFalse(self.user.avatar)
        self.assertFalse(os.path.exists(path))
        self.set_picture.assert_called_with(str(self.guid), None)

    def test_get_returns_the_current_url(self):
        self.assertIsNone(self._call('get').data['url'])
        self.set_picture.assert_not_called()

    def test_social_photo_is_used_and_synced_without_upload(self):
        self.jwt_user.token_info = {'social_picture': 'https://lh3.example/me.jpg'}
        self.assertEqual(self._call('get').data['url'], 'https://lh3.example/me.jpg')
        self.set_picture.assert_called_once_with(str(self.guid), 'https://lh3.example/me.jpg')

        # Already in step with the token: no Keycloak write
        self.set_picture.reset_mock()
        self.jwt_user.token_info['picture'] = 'https://lh3.example/me.jpg'
        self._call('get')
        self.set_picture.assert_not_called()

    def test_uploaded_photo_wins_over_the_social_one(self):
        self.jwt_user.token_info = {'social_picture': 'https://lh3.example/me.jpg'}
        url = self._call('post', {'photo': _image_file()}).data['url']
        self.assertIn('/api/media/avatars/', url)
        self.assertEqual(self._call('get').data['url'], url)

        # Removing the upload falls back to the social photo
        response = self._call('delete')
        self.assertEqual(response.data['url'], 'https://lh3.example/me.jpg')
        self.set_picture.assert_called_with(str(self.guid), 'https://lh3.example/me.jpg')

    def test_non_image_is_rejected(self):
        bad = SimpleUploadedFile('note.txt', b'not an image', content_type='text/plain')
        self.assertEqual(self._call('post', {'photo': bad}).status_code, 400)
        self.set_picture.assert_not_called()

    def test_anonymous_is_refused(self):
        self.assertIn(self._call('get', user=None).status_code, (401, 403))


class KeycloakPictureTests(TestCase):
    """The `picture` attribute is written without losing the other attributes."""

    def _admin(self, attributes):
        from unittest.mock import create_autospec
        from keycloak import KeycloakAdmin

        admin = create_autospec(KeycloakAdmin, instance=True)
        admin.get_user.return_value = {'id': 'g', 'username': 'u', 'attributes': attributes}
        return admin

    def test_setting_keeps_other_attributes(self):
        from hornet_finder_api.utils import set_user_picture

        admin = self._admin({'facebook_id': ['42']})
        with patch('hornet_finder_api.utils._get_keycloak_admin', return_value=admin):
            set_user_picture('g', 'https://x/a.jpg')
        payload = admin.update_user.call_args.args[1]
        self.assertEqual(payload['attributes'],
                         {'facebook_id': ['42'], 'picture': ['https://x/a.jpg']})
        self.assertEqual(payload['username'], 'u')

    def test_removal_drops_only_the_picture(self):
        from hornet_finder_api.utils import set_user_picture

        admin = self._admin({'facebook_id': ['42'], 'picture': ['https://x/a.jpg']})
        with patch('hornet_finder_api.utils._get_keycloak_admin', return_value=admin):
            set_user_picture('g', None)
        self.assertEqual(admin.update_user.call_args.args[1]['attributes'],
                         {'facebook_id': ['42']})


# ---------------------------------------------------------------------------
# Apiaries
# ---------------------------------------------------------------------------

from .apiary_permissions import association_path
from .apiary_views import ApiaryViewSet
from .models import Apiary, ApiaryGroupPermission


class ApiaryTestCase(TrapTestCase):
    """The trap fixtures (owner, group member, group admin, stranger, admin) as beekeepers."""

    def setUp(self):
        super().setUp()
        self.owner_user.roles = ['beekeeper']
        self.stranger_user.roles = ['beekeeper']
        self.apiary = Apiary.objects.create(
            latitude=50.5, longitude=4.5, infestation_level=1,
            created_by=self.owner, owner=self.owner,
        )

    def _api(self, method, url, actions, user, data=None, pk=None, **kwargs):
        request = getattr(self.factory, method)(url, data, **kwargs)
        force_authenticate(request, user=user)
        view_kwargs = {'pk': pk} if pk is not None else {}
        return ApiaryViewSet.as_view(actions)(request, **view_kwargs)

    def _ids(self, user, query=''):
        response = self._api('get', f'/apiaries/?lat=50.5&lon=4.5&radius=5{query}',
                             {'get': 'list'}, user)
        self.assertEqual(response.status_code, 200)
        return {a['id'] for a in response.data}

    def _share(self, can_update=False, can_read=True):
        return ApiaryGroupPermission.objects.create(
            apiary=self.apiary, group=self.group, can_read=can_read, can_update=can_update,
        )


class ApiaryVisibilityTests(ApiaryTestCase):
    def test_private_apiary_seen_by_owner_and_admin_only(self):
        self.assertEqual(self._ids(self.owner_user), {self.apiary.id})
        self.assertEqual(self._ids(self.admin_user), {self.apiary.id})
        self.assertEqual(self._ids(self.member_user), set())
        self.assertEqual(self._ids(self.stranger_user), set())

    def test_shared_apiary_seen_by_members_including_admin_subgroup(self):
        self._share()
        for user in (self.member_user, self.group_admin_user):
            with self.subTest(user=user.guid):
                self.assertEqual(self._ids(user), {self.apiary.id})
        self.assertEqual(self._ids(self.stranger_user), set())

    def test_mine_keeps_own_apiaries_only(self):
        self._share()
        own = Apiary.objects.create(latitude=50.5, longitude=4.5, infestation_level=2,
                                    created_by=self.member, owner=self.member)
        self.assertEqual(self._ids(self.member_user), {self.apiary.id, own.id})
        self.assertEqual(self._ids(self.member_user, '&mine=true'), {own.id})

    def test_trappers_and_hunters_have_no_access(self):
        self.member_user.roles = ['trapper', 'hunter']
        response = self._api('get', '/apiaries/?lat=50.5&lon=4.5', {'get': 'list'},
                             self.member_user)
        self.assertEqual(response.status_code, 403)

    def test_representation_carries_owner_and_permissions(self):
        self._share(can_update=True)
        response = self._api('get', f'/apiaries/{self.apiary.id}/', {'get': 'retrieve'},
                             self.member_user, pk=self.apiary.id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['owner']['guid'], str(self.owner_guid))
        self.assertEqual(response.data['permissions'],
                         {'read': True, 'update': True, 'delete': False, 'share': False,
                          'change_owner': False})


class ApiaryWriteTests(ApiaryTestCase):
    def test_creation_sets_creator_and_owner_and_ignores_sent_owner(self):
        response = self._api('post', '/apiaries/', {'post': 'create'}, self.member_user, {
            'latitude': 50.4, 'longitude': 4.4, 'infestation_level': 2,
            'afsca_number': ' 2.123.456.789 ', 'owner': str(self.stranger_guid),
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        apiary = Apiary.objects.get(pk=response.data['id'])
        self.assertEqual(apiary.owner_id, self.member_guid)
        self.assertEqual(apiary.created_by_id, self.member_guid)
        self.assertEqual(apiary.afsca_number, '2.123.456.789')

    def test_the_infestation_level_is_optional_and_can_be_cleared(self):
        response = self._api('post', '/apiaries/', {'post': 'create'}, self.owner_user, {
            'latitude': 50.4, 'longitude': 4.4,
        }, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data['infestation_level'])

        # The form sends an empty value to clear it
        response = self._api('patch', '/', {'patch': 'partial_update'}, self.owner_user,
                             {'infestation_level': ''}, pk=self.apiary.id, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.apiary.refresh_from_db()
        self.assertIsNone(self.apiary.infestation_level)

        response = self._api('patch', '/', {'patch': 'partial_update'}, self.owner_user,
                             {'infestation_level': 4}, pk=self.apiary.id, format='json')
        self.assertEqual(response.status_code, 400)

    def test_update_needs_owner_or_update_grant(self):
        patch_data = {'afsca_number': '9.005.577.599'}
        response = self._api('patch', '/', {'patch': 'partial_update'}, self.member_user,
                             patch_data, pk=self.apiary.id, format='json')
        self.assertEqual(response.status_code, 403)

        self._share(can_update=False)
        response = self._api('patch', '/', {'patch': 'partial_update'}, self.member_user,
                             patch_data, pk=self.apiary.id, format='json')
        self.assertEqual(response.status_code, 403)

        ApiaryGroupPermission.objects.filter(apiary=self.apiary).update(can_update=True)
        response = self._api('patch', '/', {'patch': 'partial_update'}, self.member_user,
                             patch_data, pk=self.apiary.id, format='json')
        self.assertEqual(response.status_code, 200)

    def test_delete_stays_with_owner(self):
        self._share(can_update=True)
        response = self._api('delete', '/', {'delete': 'destroy'}, self.member_user,
                             pk=self.apiary.id)
        self.assertEqual(response.status_code, 403)
        response = self._api('delete', '/', {'delete': 'destroy'}, self.owner_user,
                             pk=self.apiary.id)
        self.assertEqual(response.status_code, 204)

    def test_photo_is_stored_and_served_to_readers_only(self):
        response = self._api('post', '/', {'post': 'photo'}, self.owner_user,
                             {'photo': _image_file()}, pk=self.apiary.id, format='multipart')
        self.assertEqual(response.status_code, 200)
        self.apiary.refresh_from_db()
        self.addCleanup(self.apiary.photo.delete, save=False)
        self.addCleanup(self.apiary.photo_thumbnail.delete, save=False)
        path = self.apiary.photo.name
        self.assertTrue(path.startswith(f'apiaries/{self.apiary.id}/'))

        def fetch(user):
            request = self.factory.get(f'/api/media/{path}')
            force_authenticate(request, user=user)
            return media_view(request, path=path).status_code

        self.assertEqual(fetch(self.owner_user), 200)
        self.assertEqual(fetch(self.member_user), 404)
        self._share()
        self.assertEqual(fetch(self.member_user), 200)
        self.assertEqual(fetch(self.stranger_user), 404)


class ApiarySharingTests(ApiaryTestCase):
    def test_association_path(self):
        self.assertEqual(association_path('/beekeepers/ena'), '/beekeepers/ena')
        self.assertEqual(association_path('/beekeepers/ena/admin'), '/beekeepers/ena')
        self.assertIsNone(association_path('/beekeepers'))

    def test_owner_is_offered_their_associations(self):
        self.owner.group_paths = ['/beekeepers', '/beekeepers/vsab/admin', self.group_path]
        self.owner.save()
        response = self._api('get', '/', {'get': 'sharing'}, self.owner_user, pk=self.apiary.id)
        self.assertTrue(response.data['can_share'])
        self.assertEqual([g['path'] for g in response.data['allowed_groups']],
                         ['/beekeepers/ena', '/beekeepers/vsab'])

    def test_owner_shares_then_unshares(self):
        response = self._api('put', '/', {'put': 'sharing'}, self.owner_user,
                             {'group_path': self.group_path, 'can_update': True},
                             pk=self.apiary.id, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['extended_permissions'][0]['group'], self.group_path)
        self.assertTrue(response.data['extended_permissions'][0]['can_update'])
        self.assertEqual(self._ids(self.member_user), {self.apiary.id})

        response = self._api('delete', f'/?group_path={self.group_path}', {'delete': 'sharing'},
                             self.owner_user, pk=self.apiary.id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['extended_permissions'], [])
        self.assertEqual(self._ids(self.member_user), set())

    def test_owner_cannot_share_with_a_foreign_group(self):
        response = self._api('put', '/', {'put': 'sharing'}, self.owner_user,
                             {'group_path': '/beekeepers/other'}, pk=self.apiary.id, format='json')
        self.assertEqual(response.status_code, 403)

    def test_members_cannot_change_sharing(self):
        self._share(can_update=True)
        response = self._api('put', '/', {'put': 'sharing'}, self.member_user,
                             {'group_path': self.group_path, 'can_update': True},
                             pk=self.apiary.id, format='json')
        self.assertEqual(response.status_code, 403)

    def test_only_admin_changes_owner(self):
        data = {'owner_guid': str(self.member_guid)}
        response = self._api('put', '/', {'put': 'owner'}, self.owner_user, data,
                             pk=self.apiary.id, format='json')
        self.assertEqual(response.status_code, 403)
        response = self._api('put', '/', {'put': 'owner'}, self.admin_user, data,
                             pk=self.apiary.id, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['owner']['guid'], str(self.member_guid))


# ---------------------------------------------------------------------------
# Trap manager (`GET /traps/managed/`)
# ---------------------------------------------------------------------------

from datetime import timedelta

from django.db import connection
from django.test.utils import CaptureQueriesContext


class TrapManagerTests(TrapTestCase):
    """Scopes, filters, sorting and pagination of the trap manager."""

    def setUp(self):
        super().setUp()
        today = timezone.now().date()
        # Owned by the member, delegated to the owner's group
        self.delegated = Trap.objects.create(
            latitude=50.6, longitude=4.6, owner=self.member, trap_type=self.trap_type,
            installed_at=today, group=self.group, address='Rue des Abeilles 3',
        )
        # Owned by the member, public, not delegated: not the owner's business
        self.foreign = Trap.objects.create(
            latitude=50.5, longitude=4.5, owner=self.member, trap_type=self.trap_type,
            installed_at=today,
        )
        # A second trap of the owner, put away, far from the first one
        self.removed = Trap.objects.create(
            latitude=51.2, longitude=4.4, owner=self.owner, trap_type=self.trap_type,
            installed_at=today, active=False, address='Quai du Port',
        )

    def _managed(self, user, query=''):
        return self._call('get', f'/traps/managed/?{query}', {'get': 'managed'}, user=user)

    def _ids(self, response):
        self.assertEqual(response.status_code, 200, response.data)
        return [trap['id'] for trap in response.data['results']]

    def test_mine_lists_only_owned_active_traps_by_default(self):
        self.assertEqual(self._ids(self._managed(self.owner_user)), [self.trap.id])

    def test_mine_with_inactive_traps(self):
        ids = self._ids(self._managed(self.owner_user, 'active=all'))
        self.assertEqual(set(ids), {self.trap.id, self.removed.id})
        ids = self._ids(self._managed(self.owner_user, 'active=false'))
        self.assertEqual(ids, [self.removed.id])

    def test_delegated_lists_traps_of_my_groups_but_not_my_own(self):
        self.trap.group = self.group
        self.trap.save()
        # The owner sees the member's delegated trap, not their own nor the public one
        self.assertEqual(self._ids(self._managed(self.owner_user, 'scope=delegated')),
                         [self.delegated.id])

    def test_delegated_includes_the_parent_of_an_admin_subgroup(self):
        ids = self._ids(self._managed(self.group_admin_user, 'scope=delegated'))
        self.assertEqual(ids, [self.delegated.id])

    def test_delegated_excludes_public_traps_of_strangers(self):
        self.assertEqual(self._ids(self._managed(self.stranger_user, 'scope=delegated')), [])

    def test_all_is_reserved_to_platform_admins(self):
        self.assertEqual(self._managed(self.owner_user, 'scope=all').status_code, 403)
        ids = self._ids(self._managed(self.admin_user, 'scope=all&active=all'))
        self.assertEqual(set(ids), {self.trap.id, self.delegated.id, self.foreign.id,
                                    self.removed.id})

    def test_unknown_scope_or_ordering_is_rejected(self):
        self.assertEqual(self._managed(self.owner_user, 'scope=everyone').status_code, 400)
        self.assertEqual(self._managed(self.owner_user, 'ordering=owner').status_code, 400)

    def test_anonymous_is_rejected(self):
        self.assertEqual(self._managed(None).status_code, 403)

    def test_search_by_address_number_and_tag(self):
        ids = self._ids(self._managed(self.owner_user, 'active=all&q=port'))
        self.assertEqual(ids, [self.removed.id])
        ids = self._ids(self._managed(self.owner_user, f'active=all&q=%23{self.trap.id}'))
        self.assertEqual(ids, [self.trap.id])
        tag = Tag.objects.create(value='AAbcdefgh' + 'x' * 30, key_index=0, trap=self.trap)
        ids = self._ids(self._managed(self.owner_user, f'active=all&q={tag.short}'))
        self.assertEqual(ids, [self.trap.id])

    def test_has_tag_filter(self):
        Tag.objects.create(value='AAtagged' + 'y' * 30, key_index=0, trap=self.removed)
        self.assertEqual(self._ids(self._managed(self.owner_user, 'active=all&has_tag=true')),
                         [self.removed.id])
        self.assertEqual(self._ids(self._managed(self.owner_user, 'active=all&has_tag=false')),
                         [self.trap.id])

    def test_group_filter(self):
        ids = self._ids(self._managed(self.admin_user,
                                      f'scope=all&group={self.group_path}'))
        self.assertEqual(ids, [self.delegated.id])

    def test_default_order_puts_the_most_overdue_first(self):
        # Journals opened by hand: one visited long ago, one never visited
        self.trap.events.all().delete()
        TrapEvent.objects.create(trap=self.removed, kind=TrapEvent.KIND_INSPECTION,
                                 performed_at=timezone.now() - timedelta(days=30))
        never = Trap.objects.create(latitude=50.5, longitude=4.5, owner=self.owner,
                                    trap_type=self.trap_type, installed_at=timezone.now().date())
        TrapEvent.objects.create(trap=self.trap, kind=TrapEvent.KIND_INSPECTION,
                                 performed_at=timezone.now())
        response = self._managed(self.owner_user, 'active=all')
        self.assertEqual(self._ids(response), [never.id, self.removed.id, self.trap.id])
        self.assertIsNone(response.data['results'][0]['last_event_at'])
        self.assertIsNotNone(response.data['results'][2]['last_event_at'])
        response = self._managed(self.owner_user, 'active=all&ordering=-last_event_at')
        self.assertEqual(self._ids(response), [self.trap.id, self.removed.id, never.id])

    def test_there_is_no_ordering_by_distance(self):
        response = self._managed(self.owner_user, 'active=all&ordering=distance&lat=51.2&lon=4.4')
        self.assertEqual(response.status_code, 400)

    def test_pagination(self):
        for _ in range(3):
            Trap.objects.create(latitude=50.5, longitude=4.5, owner=self.owner,
                                trap_type=self.trap_type, installed_at=timezone.now().date())
        response = self._managed(self.owner_user, 'page_size=2')
        self.assertEqual(response.data['count'], 4)
        self.assertEqual(len(response.data['results']), 2)
        self.assertIsNotNone(response.data['next'])

    def test_query_count_does_not_grow_with_the_page(self):
        def count_queries():
            with CaptureQueriesContext(connection) as context:
                self._ids(self._managed(self.owner_user, 'active=all'))
            return len(context.captured_queries)

        few = count_queries()
        for _ in range(10):
            Trap.objects.create(latitude=50.5, longitude=4.5, owner=self.owner,
                                trap_type=self.trap_type, installed_at=timezone.now().date())
        self.assertEqual(count_queries(), few)

    def test_owner_name_is_looked_up_once_per_page(self):
        for _ in range(3):
            Trap.objects.create(latitude=50.5, longitude=4.5, owner=self.owner,
                                trap_type=self.trap_type, installed_at=timezone.now().date())
        with patch('hornet.serializers.get_user_display_name', return_value='Tester') as lookup:
            self._ids(self._managed(self.owner_user, 'active=all'))
        self.assertEqual(lookup.call_count, 1)


# ---------------------------------------------------------------------------
# Apiary manager (`GET /apiaries/managed/`)
# ---------------------------------------------------------------------------

class ApiaryManagerTests(ApiaryTestCase):
    """Scopes, filters, sorting and pagination of the apiary manager."""

    def setUp(self):
        super().setUp()
        self.apiary.address = 'Rue du Verger 1'
        self.apiary.save()
        # The member's apiary, shared with the owner's group
        self.shared = Apiary.objects.create(
            latitude=50.6, longitude=4.6, infestation_level=3, address='Chemin des Ruches 7',
            created_by=self.member, owner=self.member,
        )
        ApiaryGroupPermission.objects.create(apiary=self.shared, group=self.group, can_read=True)
        # The member's private apiary: nobody else's business
        self.private = Apiary.objects.create(
            latitude=50.5, longitude=4.5, infestation_level=2,
            created_by=self.member, owner=self.member,
        )
        # A second apiary of the owner, far from the first one
        self.far = Apiary.objects.create(
            latitude=51.2, longitude=4.4, infestation_level=2, afsca_number='2.111.222',
            created_by=self.owner, owner=self.owner,
        )

    def _managed(self, user, query=''):
        return self._api('get', f'/apiaries/managed/?{query}', {'get': 'managed'}, user)

    def _list(self, response):
        self.assertEqual(response.status_code, 200, response.data)
        return [apiary['id'] for apiary in response.data['results']]

    def test_mine_lists_owned_apiaries_most_infested_first(self):
        self.assertEqual(self._list(self._managed(self.owner_user)), [self.far.id, self.apiary.id])

    def test_shared_lists_apiaries_of_my_groups_but_not_my_own(self):
        self._share()  # the owner's own apiary, shared with their group
        self.assertEqual(self._list(self._managed(self.owner_user, 'scope=shared')),
                         [self.shared.id])

    def test_shared_includes_the_parent_of_an_admin_subgroup(self):
        self.assertEqual(self._list(self._managed(self.group_admin_user, 'scope=shared')),
                         [self.shared.id])
        self.assertEqual(self._list(self._managed(self.stranger_user, 'scope=shared')), [])

    def test_all_is_reserved_to_platform_admins(self):
        self.assertEqual(self._managed(self.owner_user, 'scope=all').status_code, 403)
        ids = self._list(self._managed(self.admin_user, 'scope=all'))
        self.assertEqual(set(ids), {self.apiary.id, self.shared.id, self.private.id, self.far.id})

    def test_unknown_scope_or_ordering_is_rejected(self):
        self.assertEqual(self._managed(self.owner_user, 'scope=everyone').status_code, 400)
        self.assertEqual(self._managed(self.owner_user, 'ordering=owner').status_code, 400)
        self.assertEqual(self._managed(self.owner_user, 'ordering=distance').status_code, 400)
        self.assertEqual(self._managed(self.owner_user, 'infestation_level=x').status_code, 400)

    def test_trappers_and_hunters_have_no_access(self):
        self.owner_user.roles = ['trapper', 'hunter']
        self.assertEqual(self._managed(self.owner_user).status_code, 403)

    def test_search_by_address_afsca_and_number(self):
        self.assertEqual(self._list(self._managed(self.owner_user, 'q=verger')), [self.apiary.id])
        self.assertEqual(self._list(self._managed(self.owner_user, 'q=2.111')), [self.far.id])
        self.assertEqual(self._list(self._managed(self.owner_user, f'q=%23{self.far.id}')),
                         [self.far.id])

    def test_group_and_infestation_filters(self):
        ids = self._list(self._managed(self.admin_user, f'scope=all&group={self.group_path}'))
        self.assertEqual(ids, [self.shared.id])
        ids = self._list(self._managed(self.admin_user, 'scope=all&infestation_level=2'))
        self.assertEqual(set(ids), {self.private.id, self.far.id})
        self.far.infestation_level = None
        self.far.save()
        ids = self._list(self._managed(self.admin_user, 'scope=all&infestation_level=none'))
        self.assertEqual(ids, [self.far.id])

    def test_apiaries_not_assessed_come_last_in_both_directions(self):
        self.far.infestation_level = None
        self.far.save()
        self.assertEqual(self._list(self._managed(self.owner_user)), [self.apiary.id, self.far.id])
        self.assertEqual(self._list(self._managed(self.owner_user, 'ordering=infestation_level')),
                         [self.apiary.id, self.far.id])

    def test_there_is_no_ordering_by_distance(self):
        # It would locate the apiaries: refused, even with a position
        response = self._managed(self.owner_user, 'ordering=distance&lat=51.2&lon=4.4')
        self.assertEqual(response.status_code, 400)

    def test_rows_carry_address_and_permissions(self):
        response = self._managed(self.member_user, 'scope=mine')
        row = next(r for r in response.data['results'] if r['id'] == self.shared.id)
        self.assertEqual(row['address'], 'Chemin des Ruches 7')
        self.assertEqual(row['permissions'], {
            'read': True, 'update': True, 'delete': True, 'share': True, 'change_owner': False})

    def test_pagination(self):
        response = self._managed(self.owner_user, 'page_size=1')
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 1)
        self.assertIsNotNone(response.data['next'])

    def test_owner_name_is_looked_up_once_per_page(self):
        with patch('hornet.serializers.get_user_display_name', return_value='Tester') as lookup:
            self._list(self._managed(self.owner_user))
        self.assertEqual(lookup.call_count, 1)

    def test_query_count_does_not_grow_with_the_page(self):
        def count_queries():
            with CaptureQueriesContext(connection) as context:
                self._list(self._managed(self.owner_user))
            return len(context.captured_queries)

        few = count_queries()
        for _ in range(5):
            Apiary.objects.create(latitude=50.5, longitude=4.5, infestation_level=1,
                                  created_by=self.owner, owner=self.owner)
        self.assertEqual(count_queries(), few)


# ---------------------------------------------------------------------------
# Beekeeper group invitations
# ---------------------------------------------------------------------------

from datetime import timedelta as _timedelta
from unittest.mock import create_autospec as _autospec

from .invitation_views import GroupInvitationViewSet, MyGroupInvitationViewSet
from .models import GroupInvitation, InvitationThrottle

_ENA = '/beekeepers/ena'
_VSAB = '/beekeepers/vsab'


class _FakeKeycloak:
    """In-memory stand-in for the Keycloak helpers the invitations use."""

    def __init__(self):
        self.groups = {
            _ENA: {'id': 'gid-ena', 'path': _ENA, 'name': 'ena',
                   'description': "école namuroise d'apiculture", 'attributes': {}},
            _VSAB: {'id': 'gid-vsab', 'path': _VSAB, 'name': 'vsab', 'attributes': {}},
        }
        self.accounts = {}      # lowercased email -> user representation
        self.memberships = {}   # guid -> group paths
        self.down = False
        self.lookups = 0
        self.added = []
        self.members = {}       # group id -> list of user representations
        self.removed = []

    def _check(self):
        if self.down:
            raise RuntimeError('Keycloak down')

    def find_active_user_by_email(self, email):
        self._check()
        self.lookups += 1
        return self.accounts.get(email.strip().lower())

    def get_group_by_path(self, path):
        self._check()
        return self.groups.get(path)

    def get_child_groups(self, path):
        self._check()
        return [g for p, g in self.groups.items() if p.startswith(path + '/')]

    def get_user_group_paths(self, guid):
        return self.memberships.get(guid, [])

    def add_user_to_group(self, guid, group_id):
        self._check()
        self.added.append((guid, group_id))
        if guid not in {m['id'] for m in self.members.get(group_id, [])}:
            self.members.setdefault(group_id, []).append({'id': guid})

    def get_group_members(self, group_id, limit=1000):
        self._check()
        return list(self.members.get(group_id, []))

    def remove_user_from_group(self, guid, group_id):
        self._check()
        self.removed.append((guid, group_id))
        self.members[group_id] = [m for m in self.members.get(group_id, []) if m['id'] != guid]

    def get_user_display_name(self, guid, allow_email=True):
        assert not allow_email, 'invitations must never show an email address'
        return f'Name {guid[:8]}'

    def get_active_user_email(self, guid):
        self._check()
        return next((a['email'] for a in self.accounts.values() if a['id'] == guid), None)


def _email_theme_dir():
    """The Keycloak email theme: mounted in the API container, else in the repository."""
    from pathlib import Path
    from django.conf import settings as django_settings

    for candidate in (Path(django_settings.EMAIL_THEME_DIR),
                      Path(django_settings.BASE_DIR).parent / 'auth/themes/velutina/email'):
        if (candidate / 'html/template.ftl').exists():
            return candidate
    return None


_THEME_DIR = _email_theme_dir()


class GroupInvitationTestCase(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.kc = _FakeKeycloak()
        for name in ('find_active_user_by_email', 'get_group_by_path', 'get_child_groups',
                     'get_user_group_paths', 'add_user_to_group', 'get_user_display_name',
                     'get_active_user_email', 'get_group_members', 'remove_user_from_group'):
            patcher = patch(f'hornet_finder_api.utils.{name}', side_effect=getattr(self.kc, name))
            patcher.start()
            self.addCleanup(patcher.stop)
        if _THEME_DIR:
            theme = override_settings(EMAIL_THEME_DIR=str(_THEME_DIR))
            theme.enable()
            self.addCleanup(theme.disable)

        self.aga = self._user(['beekeeper'], [f'{_ENA}/admin'])
        self.member = self._user(['beekeeper'], [_ENA])
        self.trappers_admin = self._user(['trapper'], ['/trappers/admin'])
        self.admin = self._user(['admin'], ['/admins'])

        self.invitee_guid = str(uuid_module.uuid4())
        self.kc.accounts['pi@example.org'] = {
            'id': self.invitee_guid, 'email': 'pi@example.org', 'enabled': True, 'emailVerified': True,
        }
        self.invitee = FakeTrapUser(['trapper'], self.invitee_guid, ['/trappers'])

    def _user(self, roles, membership):
        guid = uuid_module.uuid4()
        User.objects.create(guid=guid, group_paths=membership)
        return FakeTrapUser(roles, guid, membership)

    def _call(self, viewset, method, url, actions, user, data=None, **view_kwargs):
        request = getattr(self.factory, method)(url, data, format='json')
        force_authenticate(request, user=user)
        return viewset.as_view(actions)(request, **view_kwargs)

    def _invite(self, user=None, email='pi@example.org', group=_ENA):
        return self._call(GroupInvitationViewSet, 'post', '/api/group-invitations/',
                          {'post': 'create'}, user or self.aga, {'group_path': group, 'email': email})

    def _throttle(self, user=None):
        return InvitationThrottle.objects.get(user__guid=(user or self.aga).guid)


class GroupInvitationRightsTests(GroupInvitationTestCase):
    def test_a_group_admin_invites_an_active_user(self):
        response = self._invite(email='  PI@Example.org ')
        self.assertEqual(response.status_code, 201, response.data)
        invitation = GroupInvitation.objects.get()
        self.assertEqual(str(invitation.invitee_id), self.invitee_guid)
        self.assertEqual(str(invitation.invited_by_id), self.aga.guid)
        self.assertEqual(invitation.group_path, _ENA)
        self.assertEqual(invitation.group_name, "école namuroise d'apiculture")
        self.assertEqual(invitation.status, GroupInvitation.STATUS_PENDING)
        # The email address is never kept
        stored = [str(getattr(invitation, f.attname)) for f in GroupInvitation._meta.fields]
        self.assertFalse(any('example.org' in value.lower() for value in stored))

    def test_the_invitee_is_emailed_at_their_account_address(self):
        from django.core import mail

        self.kc.accounts['pi@example.org']['email'] = 'pi@example.org'
        response = self._invite(email='  PI@Example.org ')
        self.assertTrue(response.data['notified'])
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ['pi@example.org'])
        self.assertIn("école namuroise d'apiculture", message.subject)
        self.assertIn(f'Name {self.aga.guid[:8]}', message.body)
        self.assertIn('/invitations', message.body)
        self.assertEqual(GroupInvitation.objects.get().last_notified_at is not None, True)
        if _THEME_DIR:
            html = message.alternatives[0].content
            self.assertIn('cid:vsab-logo@velutina', html)
            self.assertIn('/invitations">Voir l\'invitation</a>', html)
            # Escaped in the HTML part
            self.assertIn('école namuroise d&#x27;apiculture', html)

    def test_a_mail_failure_keeps_the_invitation_and_never_logs_the_address(self):
        from smtplib import SMTPRecipientsRefused

        refused = SMTPRecipientsRefused({'pi@example.org': (550, b'no')})
        with patch('hornet.emails.BrandedEmail.send', side_effect=refused), \
                self.assertLogs('hornet.invitation_views', level='INFO') as logs:
            response = self._invite()
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data['notified'])
        self.assertTrue(GroupInvitation.objects.exists())
        self.assertFalse(any('example.org' in line for line in logs.output))

    def test_no_email_when_the_invitation_is_refused(self):
        from django.core import mail

        self._invite(email='nobody@example.org')
        self._invite(user=self.member)
        self.assertEqual(mail.outbox, [])

    def test_a_plain_member_cannot_invite(self):
        self.assertEqual(self._invite(user=self.member).status_code, 403)

    def test_a_group_admin_cannot_invite_to_another_group(self):
        self.assertEqual(self._invite(group=_VSAB).status_code, 403)

    def test_only_beekeeper_associations_are_invitable(self):
        for path in (f'{_ENA}/admin', '/beekeepers', '/beekeepers/admin', '/admins', '/trappers', '/hunters'):
            with self.subTest(path=path):
                self.assertEqual(self._invite(user=self.admin, group=path).status_code, 403)

    def test_the_administrator_of_the_trappers_cannot_invite(self):
        self.assertEqual(self._invite(user=self.trappers_admin, group='/trappers').status_code, 403)

    def test_a_platform_admin_invites_to_any_beekeeper_group(self):
        self.assertEqual(self._invite(user=self.admin, group=_VSAB).status_code, 201)

    def test_an_unknown_group_is_rejected_without_a_lookup(self):
        response = self._invite(user=self.admin, group='/beekeepers/ghost')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.kc.lookups, 0)

    def test_invitable_groups_of_a_group_admin_and_of_an_admin(self):
        url = '/api/group-invitations/invitable/'
        response = self._call(GroupInvitationViewSet, 'get', url, {'get': 'invitable'}, self.aga)
        self.assertEqual(response.data['groups'],
                         [{'path': _ENA, 'name': "école namuroise d'apiculture"}])
        self.assertEqual(response.data['lookup'], {'remaining_attempts': 10, 'locked_until': None})

        response = self._call(GroupInvitationViewSet, 'get', url, {'get': 'invitable'}, self.admin)
        self.assertEqual([g['path'] for g in response.data['groups']], [_ENA, _VSAB])

        response = self._call(GroupInvitationViewSet, 'get', url, {'get': 'invitable'}, self.member)
        self.assertEqual(response.data['groups'], [])

    def test_conflicts(self):
        self.assertEqual(self._invite().status_code, 201)
        response = self._invite()
        self.assertEqual((response.status_code, response.data['code']), (409, 'already_invited'))

        self.kc.memberships[self.invitee_guid] = [f'{_VSAB}/admin']
        response = self._invite(user=self.admin, group=_VSAB)
        self.assertEqual((response.status_code, response.data['code']), (409, 'already_member'))

        self.kc.accounts['aga@example.org'] = {'id': self.aga.guid, 'email': 'aga@example.org',
                                               'enabled': True, 'emailVerified': True}
        response = self._invite(email='aga@example.org')
        self.assertEqual((response.status_code, response.data['code']), (409, 'self'))
        # None of these is a failed lookup
        self.assertEqual(self._throttle().failures, 0)

    def test_keycloak_failure_is_a_503_and_not_a_failed_lookup(self):
        self.kc.down = True
        self.assertEqual(self._invite(email='nobody@example.org').status_code, 503)
        self.assertFalse(InvitationThrottle.objects.filter(failures__gt=0).exists())


class GroupInvitationThrottleTests(GroupInvitationTestCase):
    def test_an_unknown_address_is_counted(self):
        response = self._invite(email='nobody@example.org')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data['code'], 'no_active_user')
        self.assertEqual(response.data['remaining_attempts'], 9)
        self.assertIsNone(response.data['locked_until'])

    def test_a_malformed_address_is_not_counted(self):
        self.assertEqual(self._invite(email='pi@').status_code, 400)
        self.assertEqual(self.kc.lookups, 0)

    def test_ten_failures_lock_invitations_for_24_hours(self):
        for attempt in range(9):
            self.assertEqual(self._invite(email=f'x{attempt}@example.org').status_code, 404)
        start = timezone.now()
        response = self._invite(email='x9@example.org')
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data['code'], 'locked')
        locked_until = self._throttle().locked_until
        self.assertAlmostEqual((locked_until - start).total_seconds(), 24 * 3600, delta=60)
        self.assertGreater(int(response['Retry-After']), 24 * 3600 - 60)

        # Locked: even a right address is refused, without asking Keycloak
        lookups = self.kc.lookups
        self.assertEqual(self._invite().status_code, 429)
        self.assertEqual(self.kc.lookups, lookups)
        # The limit is per inviter
        self.assertEqual(self._invite(user=self.admin).status_code, 201)

        with patch('django.utils.timezone.now', return_value=locked_until + _timedelta(seconds=1)):
            response = self._invite(email='again@example.org')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data['remaining_attempts'], 9)

    def test_a_success_does_not_reset_the_count(self):
        for attempt in range(9):
            self._invite(email=f'x{attempt}@example.org')
        self.assertEqual(self._invite().status_code, 201)
        self.assertEqual(self._invite(email='x9@example.org').status_code, 429)

    def test_failures_older_than_the_window_are_forgotten(self):
        for attempt in range(9):
            self._invite(email=f'x{attempt}@example.org')
        later = timezone.now() + InvitationThrottle.WINDOW + _timedelta(minutes=1)
        with patch('django.utils.timezone.now', return_value=later):
            response = self._invite(email='x9@example.org')
        self.assertEqual((response.status_code, response.data['remaining_attempts']), (404, 9))

    def test_invitable_reports_the_lock(self):
        for attempt in range(10):
            self._invite(email=f'x{attempt}@example.org')
        response = self._call(GroupInvitationViewSet, 'get', '/api/group-invitations/invitable/',
                              {'get': 'invitable'}, self.aga)
        self.assertEqual(response.data['lookup']['remaining_attempts'], 0)
        self.assertIsNotNone(response.data['lookup']['locked_until'])


class GroupInvitationLifecycleTests(GroupInvitationTestCase):
    def setUp(self):
        super().setUp()
        self.assertEqual(self._invite().status_code, 201)
        self.invitation = GroupInvitation.objects.get()

    def _mine(self, user=None):
        return self._call(MyGroupInvitationViewSet, 'get', '/api/me/group-invitations/',
                          {'get': 'list'}, user or self.invitee)

    def _respond(self, verb, user=None):
        return self._call(MyGroupInvitationViewSet, 'post',
                          f'/api/me/group-invitations/{self.invitation.id}/{verb}/',
                          {'post': verb}, user or self.invitee, pk=self.invitation.id)

    def test_the_invitee_sees_and_accepts_the_invitation(self):
        listed = self._mine().data
        self.assertEqual([i['id'] for i in listed], [self.invitation.id])
        self.assertEqual(listed[0]['group_name'], "école namuroise d'apiculture")
        self.assertEqual(listed[0]['invited_by_name'], f'Name {self.aga.guid[:8]}')

        response = self._respond('accept')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.kc.added, [(self.invitee_guid, 'gid-ena')])
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, GroupInvitation.STATUS_ACCEPTED)
        self.assertIsNotNone(self.invitation.responded_at)
        self.assertEqual(self._mine().data, [])
        self.assertEqual(self._respond('accept').status_code, 404)

    def test_declining_leaves_keycloak_alone(self):
        self.assertEqual(self._respond('decline').status_code, 200)
        self.assertEqual(self.kc.added, [])
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, GroupInvitation.STATUS_DECLINED)

    def test_nobody_else_can_answer(self):
        self.assertEqual(self._mine(user=self.member).data, [])
        self.assertEqual(self._respond('accept', user=self.member).status_code, 404)
        self.assertEqual(self.kc.added, [])

    def test_a_failed_keycloak_call_keeps_the_invitation_pending(self):
        self.kc.down = True
        self.assertEqual(self._respond('accept').status_code, 503)
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, GroupInvitation.STATUS_PENDING)

    def test_an_expired_invitation_can_no_longer_be_accepted_nor_blocks_a_new_one(self):
        GroupInvitation.objects.filter(pk=self.invitation.pk).update(
            created_at=timezone.now() - GroupInvitation.VALIDITY - _timedelta(minutes=1))
        self.assertEqual(self._mine().data, [])
        self.assertEqual(self._respond('accept').status_code, 404)
        self.assertEqual(self._invite().status_code, 201)
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, GroupInvitation.STATUS_EXPIRED)

    def test_administrators_list_and_withdraw_pending_invitations(self):
        self.assertEqual(self._invite(user=self.admin, group=_VSAB).status_code, 201)
        listing = {'get': 'list'}
        aga_view = self._call(GroupInvitationViewSet, 'get', '/api/group-invitations/', listing, self.aga)
        self.assertEqual([i['group_path'] for i in aga_view.data], [_ENA])
        self.assertEqual(aga_view.data[0]['invitee_name'], f'Name {self.invitee_guid[:8]}')
        admin_view = self._call(GroupInvitationViewSet, 'get', '/api/group-invitations/', listing, self.admin)
        self.assertEqual(sorted(i['group_path'] for i in admin_view.data), [_ENA, _VSAB])

        url = f'/api/group-invitations/{self.invitation.id}/'
        destroy = {'delete': 'destroy'}
        self.assertEqual(self._call(GroupInvitationViewSet, 'delete', url, destroy, self.member,
                                    pk=self.invitation.id).status_code, 404)
        self.assertEqual(self._call(GroupInvitationViewSet, 'delete', url, destroy, self.aga,
                                    pk=self.invitation.id).status_code, 204)
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, GroupInvitation.STATUS_CANCELLED)
        self.assertEqual(self._respond('accept').status_code, 404)


class GroupInvitationReminderTests(GroupInvitationTestCase):
    def setUp(self):
        super().setUp()
        self.assertEqual(self._invite().status_code, 201)
        self.invitation = GroupInvitation.objects.get()

    def _remind(self, user=None, when=None):
        call = lambda: self._call(  # noqa: E731
            GroupInvitationViewSet, 'post', f'/api/group-invitations/{self.invitation.id}/remind/',
            {'post': 'remind'}, user or self.aga, pk=self.invitation.id)
        if when is None:
            return call()
        with patch('django.utils.timezone.now', return_value=when):
            return call()

    def _tomorrow(self):
        return self.invitation.created_at + GroupInvitation.REMINDER_INTERVAL + _timedelta(minutes=1)

    def test_the_invitation_email_counts_as_the_first_of_the_day(self):
        response = self._remind()
        self.assertEqual((response.status_code, response.data['code']), (429, 'too_soon'))
        self.invitation.refresh_from_db()
        self.assertEqual(response.data['next_reminder_at'], self.invitation.next_reminder_at)
        self.assertGreater(int(response['Retry-After']), 24 * 3600 - 120)

    def test_one_reminder_per_day(self):
        from django.core import mail

        mail.outbox.clear()
        tomorrow = self._tomorrow()
        response = self._remind(when=tomorrow)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['reminders_sent'], 1)
        self.assertEqual(response.data['next_reminder_at'], tomorrow + GroupInvitation.REMINDER_INTERVAL)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['pi@example.org'])
        self.assertTrue(mail.outbox[0].subject.startswith('Rappel'))
        self.assertIn('Pour rappel', mail.outbox[0].body)

        later = tomorrow + _timedelta(hours=23)
        self.assertEqual(self._remind(when=later).status_code, 429)
        self.assertEqual(self._remind(when=tomorrow + _timedelta(hours=25)).status_code, 200)

    def test_a_reminder_is_immediate_when_no_email_ever_left(self):
        GroupInvitation.objects.filter(pk=self.invitation.pk).update(last_notified_at=None)
        self.assertEqual(self._remind().status_code, 200)

    def test_only_the_administrators_of_the_group_can_remind(self):
        tomorrow = self._tomorrow()
        self.assertEqual(self._remind(user=self.member, when=tomorrow).status_code, 404)
        self.assertEqual(self._remind(user=self.admin, when=tomorrow).status_code, 200)

    def test_an_account_no_longer_active_is_not_reminded(self):
        self.kc.accounts.clear()
        response = self._remind(when=self._tomorrow())
        self.assertEqual((response.status_code, response.data['code']), (409, 'inactive'))

    def test_a_failed_reminder_can_be_retried_at_once(self):
        tomorrow = self._tomorrow()
        with patch('hornet.emails.BrandedEmail.send', side_effect=OSError('down')):
            response = self._remind(when=tomorrow)
        self.assertEqual((response.status_code, response.data['code']), (502, 'mail_failed'))
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.reminders_sent, 0)
        self.assertEqual(self._remind(when=tomorrow).status_code, 200)

    def test_answered_or_expired_invitations_are_not_reminded(self):
        after_expiry = self.invitation.created_at + GroupInvitation.VALIDITY + _timedelta(minutes=1)
        self.assertEqual(self._remind(when=after_expiry).status_code, 404)

    def test_the_administrators_listing_tells_when_to_remind(self):
        listed = self._call(GroupInvitationViewSet, 'get', '/api/group-invitations/',
                            {'get': 'list'}, self.aga).data[0]
        self.invitation.refresh_from_db()
        self.assertEqual(listed['next_reminder_at'], self.invitation.next_reminder_at)
        self.assertEqual(listed['reminders_sent'], 0)
        # The invitee does not see the administrators' bookkeeping
        mine = self._call(MyGroupInvitationViewSet, 'get', '/api/me/group-invitations/',
                          {'get': 'list'}, self.invitee).data[0]
        self.assertNotIn('next_reminder_at', mine)


class EmailLayoutTests(TestCase):
    """The API's emails reuse the Keycloak email theme without copying it."""

    def setUp(self):
        if _THEME_DIR is None:
            self.skipTest('Keycloak email theme not available')

    def test_the_real_theme_resolves_completely(self):
        from .emails import email_layout

        html = email_layout(_THEME_DIR)
        self.assertEqual(html.count('<#nested>'), 1)
        self.assertNotIn('${', html)
        self.assertIn('lang="fr"', html)
        self.assertIn('src="cid:vsab-logo@velutina"', html)

    def test_an_unknown_expression_is_refused(self):
        import tempfile
        from pathlib import Path
        from .emails import LayoutError, email_layout

        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / 'html').mkdir()
            (Path(tmp) / 'html/template.ftl').write_text(
                '<#macro emailLayout><p>${user.firstName}</p><#nested></#macro>')
            with self.assertRaises(LayoutError):
                email_layout(tmp)

    def test_the_logo_travels_inline_next_to_the_html(self):
        from .emails import BrandedEmail

        with override_settings(EMAIL_THEME_DIR=str(_THEME_DIR)):
            message = BrandedEmail('Sujet', 'Texte', '<p>Texte</p>', ['x@example.org']).message()
        self.assertEqual(message.get_content_type(), 'multipart/alternative')
        text, related = message.get_payload()
        self.assertEqual(text.get_content_type(), 'text/plain')
        self.assertEqual(related.get_content_type(), 'multipart/related')
        html, logo = related.get_payload()
        self.assertIn('<p>Texte</p>', html.get_content())
        self.assertEqual((logo.get_content_type(), logo['Content-ID']), ('image/png', '<vsab-logo@velutina>'))

    def test_without_the_theme_the_message_goes_as_plain_text(self):
        from django.core import mail
        from .emails import BrandedEmail

        with override_settings(EMAIL_THEME_DIR='/nonexistent'), self.assertLogs('hornet.emails', 'WARNING'):
            BrandedEmail('Sujet', 'Texte', '<p>Texte</p>', ['x@example.org']).send()
        self.assertEqual(mail.outbox[0].alternatives, [])
        self.assertEqual(mail.outbox[0].message().get_content_type(), 'text/plain')


class KeycloakInvitationHelperTests(TestCase):
    """The Keycloak helpers, against a mock built from the real python-keycloak class."""

    def _admin(self):
        from keycloak import KeycloakAdmin
        return _autospec(KeycloakAdmin, instance=True)

    def test_only_an_exact_enabled_and_verified_address_matches(self):
        from hornet_finder_api.utils import find_active_user_by_email

        admin = self._admin()
        admin.get_users.return_value = [
            {'id': '1', 'email': 'pi@example.org.evil', 'enabled': True, 'emailVerified': True},
            {'id': '2', 'email': 'pi@example.org', 'enabled': False, 'emailVerified': True},
        ]
        with patch('hornet_finder_api.utils._get_keycloak_admin', return_value=admin):
            self.assertIsNone(find_active_user_by_email('PI@example.org'))
        admin.get_users.assert_called_once_with({'email': 'pi@example.org', 'exact': 'true'})

        admin.get_users.return_value = [
            {'id': '3', 'email': 'pi@example.org', 'enabled': True, 'emailVerified': False},
            {'id': '4', 'email': 'PI@example.org', 'enabled': True, 'emailVerified': True},
        ]
        with patch('hornet_finder_api.utils._get_keycloak_admin', return_value=admin):
            self.assertEqual(find_active_user_by_email('pi@example.org')['id'], '4')

    def test_a_missing_group_is_none_and_other_errors_propagate(self):
        from keycloak.exceptions import KeycloakGetError
        from hornet_finder_api.utils import get_group_by_path

        admin = self._admin()
        admin.get_group_by_path.side_effect = KeycloakGetError('missing', response_code=404)
        with patch('hornet_finder_api.utils._get_keycloak_admin', return_value=admin):
            self.assertIsNone(get_group_by_path('/beekeepers/ghost'))
        admin.get_group_by_path.side_effect = KeycloakGetError('boom', response_code=500)
        with patch('hornet_finder_api.utils._get_keycloak_admin', return_value=admin):
            with self.assertRaises(KeycloakGetError):
                get_group_by_path('/beekeepers/ena')

    def test_a_group_is_shown_by_its_description(self):
        from hornet_finder_api.utils import group_display_name

        self.assertEqual(group_display_name({'name': 'vsab', 'description': "Vedrin s'abeille"}),
                         "Vedrin s'abeille")
        self.assertEqual(group_display_name({'name': 'vsab', 'description': '  '}), 'vsab')
        self.assertEqual(group_display_name({'name': 'vsab'}), 'vsab')

    def test_active_email_of_an_account(self):
        from keycloak.exceptions import KeycloakGetError
        from hornet_finder_api.utils import get_active_user_email

        admin = self._admin()
        cases = [
            ({'email': 'pi@example.org', 'enabled': True, 'emailVerified': True}, 'pi@example.org'),
            ({'email': 'pi@example.org', 'enabled': False, 'emailVerified': True}, None),
            ({'email': 'pi@example.org', 'enabled': True, 'emailVerified': False}, None),
        ]
        for user, expected in cases:
            admin.get_user.return_value = user
            with patch('hornet_finder_api.utils._get_keycloak_admin', return_value=admin):
                self.assertEqual(get_active_user_email('g'), expected)
        admin.get_user.side_effect = KeycloakGetError('gone', response_code=404)
        with patch('hornet_finder_api.utils._get_keycloak_admin', return_value=admin):
            self.assertIsNone(get_active_user_email('g'))

    def test_display_name_without_email(self):
        from hornet_finder_api.utils import get_user_display_name

        admin = self._admin()
        admin.get_user.return_value = {'id': 'g', 'username': 'pi@example.org',
                                       'email': 'pi@example.org'}
        with patch('hornet_finder_api.utils._get_keycloak_admin', return_value=admin):
            self.assertEqual(get_user_display_name('g'), 'pi@example.org')
            self.assertIsNone(get_user_display_name('g', allow_email=False))
        admin.get_user.return_value = {'id': 'g', 'firstName': 'Maya', 'lastName': 'Abeille'}
        with patch('hornet_finder_api.utils._get_keycloak_admin', return_value=admin):
            self.assertEqual(get_user_display_name('g', allow_email=False), 'Maya Abeille')

    def test_children_and_membership_use_supported_calls(self):
        from hornet_finder_api.utils import add_user_to_group, get_child_groups

        admin = self._admin()
        admin.get_group_by_path.return_value = {'id': 'root', 'path': '/beekeepers'}
        admin.get_group_children.return_value = [{'id': 'c', 'path': '/beekeepers/ena'}]
        with patch('hornet_finder_api.utils._get_keycloak_admin', return_value=admin):
            self.assertEqual(get_child_groups('/beekeepers'), [{'id': 'c', 'path': '/beekeepers/ena'}])
            add_user_to_group('guid', 'gid')
        admin.get_group_children.assert_called_once_with('root', {'briefRepresentation': 'false'})
        admin.group_user_add.assert_called_once_with('guid', 'gid')


from .group_views import GroupViewSet

_ENA_ADMIN = f'{_ENA}/admin'


class GroupMembersTests(GroupInvitationTestCase):
    """Members of a group: listing, removal, and naming or dismissing administrators."""

    def setUp(self):
        super().setUp()
        self.kc.groups[_ENA_ADMIN] = {'id': 'gid-ena-admin', 'path': _ENA_ADMIN, 'name': 'admin',
                                      'attributes': {}}
        # `aga` administers ena and is listed in its admin subgroup only; `member` and `bee` are
        # direct members; `second` is a direct member and a second administrator
        self.bee = self._user(['beekeeper'], [_ENA])
        self.second = self._user(['beekeeper'], [_ENA, _ENA_ADMIN])
        self.kc.members['gid-ena'] = [
            {'id': self.member.guid, 'firstName': 'Anne', 'lastName': 'Bastin'},
            {'id': self.bee.guid, 'firstName': '', 'lastName': ''},
            {'id': self.second.guid, 'firstName': 'Zoé', 'lastName': 'Zimmer'},
        ]
        self.kc.members['gid-ena-admin'] = [
            {'id': self.aga.guid, 'firstName': 'Jean', 'lastName': 'Lambert'},
            {'id': self.second.guid, 'firstName': 'Zoé', 'lastName': 'Zimmer'},
        ]

    def _members(self, user, group=_ENA):
        return self._call(GroupViewSet, 'get', f'/api/groups/members/?group_path={group}',
                          {'get': 'members'}, user)

    def _remove(self, target, user, group=_ENA):
        return self._call(GroupViewSet, 'delete', f'/api/groups/members/{target.guid}/?group_path={group}',
                          {'delete': 'member'}, user, guid=target.guid)

    def _name(self, target, user, group=_ENA):
        return self._call(GroupViewSet, 'put', f'/api/groups/members/{target.guid}/admin/?group_path={group}',
                          {'put': 'member_admin', 'delete': 'dismiss_admin'}, user, guid=target.guid)

    def _dismiss(self, target, user, group=_ENA):
        return self._call(GroupViewSet, 'delete', f'/api/groups/members/{target.guid}/admin/?group_path={group}',
                          {'put': 'member_admin', 'delete': 'dismiss_admin'}, user, guid=target.guid)

    def test_the_roster_unites_both_groups_with_administrators_first(self):
        response = self._members(self.aga)
        self.assertEqual(response.status_code, 200)
        rows = response.data['members']
        self.assertEqual([r['name'] for r in rows], ['Jean Lambert', 'Zoé Zimmer', 'Anne Bastin', None])
        self.assertEqual([r['is_admin'] for r in rows], [True, True, False, False])
        self.assertEqual([r['is_self'] for r in rows], [True, False, False, False])
        self.assertTrue(response.data['has_admin_group'])
        self.assertNotIn('email', str(response.data))

    def test_only_administrators_of_the_group_read_its_members(self):
        self.assertEqual(self._members(self.member).status_code, 403)
        self.assertEqual(self._members(self.aga, _VSAB).status_code, 403)
        self.assertEqual(self._members(self.admin).status_code, 200)

    def test_a_group_admin_removes_a_member(self):
        self.assertEqual(self._remove(self.member, self.aga).status_code, 204)
        self.assertEqual(self.kc.removed, [(str(self.member.guid), 'gid-ena')])

    def test_a_group_admin_cannot_remove_an_administrator_or_themselves(self):
        refused = self._remove(self.second, self.aga)
        self.assertEqual((refused.status_code, refused.data['code']), (403, 'admin_member'))
        own = self._remove(self.aga, self.aga)
        self.assertEqual((own.status_code, own.data['code']), (409, 'self'))
        self.assertEqual(self.kc.removed, [])

    def test_a_platform_admin_removes_an_administrator_from_both_groups(self):
        self.assertEqual(self._remove(self.second, self.admin).status_code, 204)
        self.assertEqual(set(self.kc.removed),
                         {(str(self.second.guid), 'gid-ena-admin'), (str(self.second.guid), 'gid-ena')})

    def test_the_last_administrator_cannot_be_removed(self):
        self.kc.members['gid-ena-admin'] = [{'id': self.second.guid}]
        response = self._remove(self.second, self.admin)
        self.assertEqual((response.status_code, response.data['code']), (409, 'last_admin'))

    def test_removing_a_stranger_is_not_found(self):
        self.assertEqual(self._remove(self.trappers_admin, self.aga).status_code, 404)

    def test_naming_an_administrator_is_for_platform_admins(self):
        self.assertEqual(self._name(self.member, self.aga).status_code, 403)
        response = self._name(self.member, self.admin)
        self.assertEqual((response.status_code, response.data['is_admin']), (200, True))
        self.assertEqual(self.kc.added, [(str(self.member.guid), 'gid-ena-admin')])
        again = self._name(self.second, self.admin)
        self.assertEqual((again.status_code, again.data['code']), (409, 'already_admin'))

    def test_naming_needs_an_admin_subgroup(self):
        del self.kc.groups[_ENA_ADMIN]
        response = self._name(self.member, self.admin)
        self.assertEqual((response.status_code, response.data['code']), (409, 'no_admin_group'))

    def test_dismissing_is_for_platform_admins_and_keeps_one_administrator(self):
        self.assertEqual(self._dismiss(self.second, self.aga).status_code, 403)
        self.assertEqual(self._dismiss(self.second, self.admin).status_code, 200)
        self.assertEqual(self.kc.removed, [(str(self.second.guid), 'gid-ena-admin')])
        last = self._dismiss(self.aga, self.admin)
        self.assertEqual((last.status_code, last.data['code']), (409, 'last_admin'))

    def test_dismissing_an_administrator_listed_only_in_admin_keeps_the_membership(self):
        self._name(self.member, self.admin)
        response = self._dismiss(self.aga, self.admin)
        self.assertEqual(response.status_code, 200)
        self.assertIn((str(self.aga.guid), 'gid-ena'), self.kc.added)

    def test_a_keycloak_failure_is_a_503(self):
        self.kc.down = True
        self.assertEqual(self._members(self.admin).status_code, 503)


# ---------------------------------------------------------------------------
# Roles: one trade each (hunter, trapper, beekeeper, admin)
# ---------------------------------------------------------------------------

from hornet_finder_api.authentication import JWTUser
from hornet_finder_api.roles import normalize as normalize_roles


class RoleNormalizationTests(TestCase):
    def test_the_legacy_volunteer_role_held_both_trades(self):
        self.assertEqual(normalize_roles(['volunteer']), ['hunter', 'trapper'])

    def test_current_roles_are_kept_once_and_in_order(self):
        self.assertEqual(normalize_roles(['trapper', 'volunteer', 'admin']), ['trapper', 'hunter', 'admin'])
        self.assertEqual(normalize_roles(None), [])

    def test_a_token_issued_before_the_rename_keeps_its_rights(self):
        user = JWTUser({'sub': 'x', 'realm_access': {'roles': ['volunteer', 'offline_access']}})
        self.assertEqual(user.roles, ['hunter', 'trapper', 'offline_access'])


class TradeSeparationTests(TestCase):
    """Sightings and every nest for hunters; a trapper reports nests and sees their own."""

    def setUp(self):
        self.factory = APIRequestFactory()
        patcher = patch('hornet.serializers.get_user_display_name', return_value='Tester')
        patcher.start()
        self.addCleanup(patcher.stop)
        self.trapper_guid = uuid_module.uuid4()
        self.trapper = User.objects.create(guid=self.trapper_guid)
        self.trapper_user = FakeTrapUser(['trapper'], self.trapper_guid)
        self.hunter_user = FakeTrapUser(['hunter'], uuid_module.uuid4())
        self.own_nest = _make_nest(timezone.now().year)
        self.own_nest.created_by = self.trapper
        self.own_nest.save()
        self.other_nest = _make_nest(timezone.now().year)

    def _nests(self, user, action):
        request = self.factory.get(f'/nests/{action + "/" if action != "list" else ""}?lat=50.5&lon=4.5&radius=5')
        force_authenticate(request, user=user)
        return NestViewSet.as_view({'get': action})(request)

    def test_a_trapper_cannot_record_a_hornet(self):
        request = self.factory.post('/hornets/', {'latitude': 50.5, 'longitude': 4.5, 'direction': 90})
        force_authenticate(request, user=self.trapper_user)
        self.assertEqual(HornetViewSet.as_view({'post': 'create'})(request).status_code, 403)

    def test_a_hunter_records_a_hornet(self):
        request = self.factory.post('/hornets/', {'latitude': 50.5, 'longitude': 4.5, 'direction': 90})
        force_authenticate(request, user=self.hunter_user)
        self.assertEqual(HornetViewSet.as_view({'post': 'create'})(request).status_code, 201)

    def test_a_trapper_reports_a_nest(self):
        request = self.factory.post('/nests/', {'latitude': 50.5, 'longitude': 4.5})
        force_authenticate(request, user=self.trapper_user)
        self.assertEqual(NestViewSet.as_view({'post': 'create'})(request).status_code, 201)

    def test_a_trapper_sees_only_their_own_nests(self):
        self.assertEqual(self._nests(self.trapper_user, 'list').status_code, 403)
        response = self._nests(self.trapper_user, 'my')
        self.assertEqual(response.status_code, 200)
        self.assertEqual({n['id'] for n in response.data}, {self.own_nest.id})

    def test_a_hunter_sees_every_nest(self):
        response = self._nests(self.hunter_user, 'list')
        self.assertEqual({n['id'] for n in response.data}, {self.own_nest.id, self.other_nest.id})


_TRAPPERS_ADMIN = '/trappers/admin'


class TrapperRosterTests(GroupInvitationTestCase):
    """`/trappers/admin` lists every trapper; only platform admins remove one."""

    def setUp(self):
        super().setUp()
        self.kc.groups['/trappers'] = {'id': 'gid-trappers', 'path': '/trappers', 'name': 'trappers',
                                       'description': 'Piégeurs', 'attributes': {}}
        self.kc.groups[_TRAPPERS_ADMIN] = {'id': 'gid-trappers-admin', 'path': _TRAPPERS_ADMIN,
                                           'name': 'admin', 'attributes': {}}
        self.coordinator = self._user(['trapper'], [_TRAPPERS_ADMIN])
        self.trapper = self._user(['trapper'], ['/trappers'])
        self.kc.members['gid-trappers'] = [{'id': self.trapper.guid, 'firstName': 'Paul', 'lastName': 'Piret'}]
        self.kc.members['gid-trappers-admin'] = [{'id': self.coordinator.guid, 'firstName': 'Cléo', 'lastName': 'Collin'}]

    def _list(self, user):
        return self._call(GroupViewSet, 'get', '/api/groups/', {'get': 'list'}, user)

    def _members(self, user, group='/trappers'):
        return self._call(GroupViewSet, 'get', f'/api/groups/members/?group_path={group}',
                          {'get': 'members'}, user)

    def _remove(self, target, user):
        return self._call(GroupViewSet, 'delete', f'/api/groups/members/{target.guid}/?group_path=/trappers',
                          {'delete': 'member'}, user, guid=target.guid)

    def test_the_coordinator_administers_the_trappers_only(self):
        self.assertEqual([g['path'] for g in self._list(self.coordinator).data], ['/trappers'])
        self.assertEqual(self._members(self.coordinator, _ENA).status_code, 403)

    def test_the_coordinator_lists_every_trapper(self):
        response = self._members(self.coordinator)
        self.assertEqual(response.status_code, 200)
        self.assertEqual({m['guid'] for m in response.data['members']},
                         {self.trapper.guid, self.coordinator.guid})

    def test_a_beekeeper_group_admin_does_not_see_the_trappers(self):
        self.assertEqual(self._members(self.aga).status_code, 403)
        self.assertNotIn('/trappers', [g['path'] for g in self._list(self.aga).data])

    def test_the_platform_admin_sees_the_trappers_among_the_groups(self):
        self.assertIn('/trappers', [g['path'] for g in self._list(self.admin).data])

    def test_only_a_platform_admin_removes_a_trapper(self):
        response = self._remove(self.trapper, self.coordinator)
        self.assertEqual((response.status_code, response.data['code']), (403, 'platform_only'))
        self.assertEqual(self._remove(self.trapper, self.admin).status_code, 204)
        self.assertIn((str(self.trapper.guid), 'gid-trappers'), self.kc.removed)


# ---------------------------------------------------------------------------
# Nests: photos, editing, destruction date, nearby apiaries
# ---------------------------------------------------------------------------

from .models import Apiary, NestPhoto

_NEST_MEDIA = Path(_tempfile.mkdtemp(prefix='nest-tests-'))
_HUNTERS_ADMIN = '/hunters/admin'


@override_settings(MEDIA_ROOT=_NEST_MEDIA)
class NestManagementTests(TestCase):
    """Admins and `/hunters/admin` manage the content of a nest; a destroyed nest stays so."""

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        _shutil.rmtree(_NEST_MEDIA, ignore_errors=True)

    def setUp(self):
        self.factory = APIRequestFactory()
        patcher = patch('hornet.serializers.get_user_display_name', return_value='Tester')
        patcher.start()
        self.addCleanup(patcher.stop)

        self.reporter_guid = uuid_module.uuid4()
        self.reporter = User.objects.create(guid=self.reporter_guid, group_paths=['/trappers'])
        self.reporter_user = FakeTrapUser(['trapper'], self.reporter_guid, ['/trappers'])
        self.hunter_user = FakeTrapUser(['hunter'], uuid_module.uuid4(), ['/hunters'])
        self.coordinator_user = FakeTrapUser(['hunter'], uuid_module.uuid4(), [_HUNTERS_ADMIN])
        # Administers a group, but not the hunters'
        self.trappers_admin_user = FakeTrapUser(['trapper'], uuid_module.uuid4(), ['/trappers/admin'])
        self.admin_user = FakeTrapUser(['admin'], uuid_module.uuid4(), ['/admins'])
        self.stranger_user = FakeTrapUser(['trapper'], uuid_module.uuid4(), ['/trappers'])

        self.nest = Nest.objects.create(latitude=50.5, longitude=4.5, created_by=self.reporter,
                                        comments='Dans le chêne')

    def _call(self, method, path, actions, user, data=None, fmt=None, **kwargs):
        request = getattr(self.factory, method)(path, data, format=fmt) if data is not None \
            else getattr(self.factory, method)(path)
        force_authenticate(request, user=user)
        return NestViewSet.as_view(actions)(request, **kwargs)

    def _patch(self, user, data):
        return self._call('patch', f'/nests/{self.nest.id}/', {'patch': 'partial_update'}, user,
                          data, 'json', pk=self.nest.id)

    def _add_photos(self, user, count=1):
        files = [_image_file(f'p{i}.jpg') for i in range(count)]
        return self._call('post', f'/nests/{self.nest.id}/photos/', {'post': 'add_photos'}, user,
                          {'photos': files}, 'multipart', pk=self.nest.id)

    def _delete_photo(self, user, photo_id):
        return self._call('delete', f'/nests/{self.nest.id}/photos/{photo_id}/',
                          {'delete': 'delete_photo'}, user, pk=self.nest.id, photo_id=photo_id)

    def _nearby(self, user):
        return self._call('get', f'/nests/{self.nest.id}/nearby-apiaries/',
                          {'get': 'nearby_apiaries'}, user, pk=self.nest.id)

    # -- creation ---------------------------------------------------------------

    def test_a_nest_is_reported_with_several_photos(self):
        files = [_image_file('a.jpg'), _image_file('b.jpg')]
        response = self._call('post', '/nests/', {'post': 'create'}, self.reporter_user,
                              {'latitude': 50.5, 'longitude': 4.5, 'photos': files}, 'multipart')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data['photos']), 2)
        nest = Nest.objects.get(pk=response.data['id'])
        self.assertEqual(nest.created_by, self.reporter)
        for photo in nest.photos.all():
            self.assertTrue(photo.image.name.startswith(f'nests/{nest.id}/'))
            with Image.open(photo.image.path) as image:
                self.assertLessEqual(max(image.size), 1600)

    def test_a_rejected_photo_creates_no_nest(self):
        bad = SimpleUploadedFile('note.txt', b'not an image', content_type='text/plain')
        response = self._call('post', '/nests/', {'post': 'create'}, self.reporter_user,
                              {'latitude': 50.6, 'longitude': 4.6, 'photos': [_image_file(), bad]},
                              'multipart')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Nest.objects.filter(latitude=50.6).exists())
        self.assertFalse(NestPhoto.objects.exists())

    def test_the_reporter_cannot_be_chosen(self):
        response = self._call('post', '/nests/', {'post': 'create'}, self.reporter_user,
                              {'latitude': 50.5, 'longitude': 4.5,
                               'created_by': str(uuid_module.uuid4())}, 'json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['created_by']['guid'], str(self.reporter_guid))

    def test_a_nest_reported_destroyed_gets_a_date(self):
        response = self._call('post', '/nests/', {'post': 'create'}, self.reporter_user,
                              {'latitude': 50.5, 'longitude': 4.5, 'destroyed': True}, 'json')
        self.assertEqual(response.status_code, 201)
        self.assertIsNotNone(Nest.objects.get(pk=response.data['id']).destroyed_at)

    # -- editing ----------------------------------------------------------------

    def test_the_admin_and_the_hunters_admin_edit_a_nest(self):
        for user in (self.admin_user, self.coordinator_user):
            response = self._patch(user, {'comments': f'Vu par {user.guid}'})
            self.assertEqual(response.status_code, 200)
            self.nest.refresh_from_db()
            self.assertEqual(self.nest.comments, f'Vu par {user.guid}')

    def test_others_do_not_edit_a_nest(self):
        for user in (self.reporter_user, self.hunter_user, self.trappers_admin_user):
            self.assertEqual(self._patch(user, {'comments': 'non'}).status_code, 403)
        self.nest.refresh_from_db()
        self.assertEqual(self.nest.comments, 'Dans le chêne')

    def test_editing_keeps_the_reporter(self):
        response = self._patch(self.coordinator_user, {'created_by': str(uuid_module.uuid4())})
        self.assertEqual(response.status_code, 200)
        self.nest.refresh_from_db()
        self.assertEqual(self.nest.created_by, self.reporter)

    def test_the_permissions_follow_the_requester(self):
        response = self._call('get', '/nests/?lat=50.5&lon=4.5&radius=5', {'get': 'list'},
                              self.coordinator_user)
        self.assertEqual(response.data[0]['permissions'], {
            'update': True, 'photos': True, 'reactivate': False, 'delete': False,
            'nearby_apiaries': True,
        })
        response = self._call('get', '/nests/?lat=50.5&lon=4.5&radius=5', {'get': 'list'},
                              self.hunter_user)
        self.assertFalse(any(response.data[0]['permissions'].values()))

    # -- destruction ------------------------------------------------------------

    def test_destroying_a_nest_records_the_date(self):
        before = timezone.now()
        response = self._patch(self.coordinator_user, {'destroyed': True})
        self.assertEqual(response.status_code, 200)
        self.nest.refresh_from_db()
        self.assertTrue(self.nest.destroyed)
        self.assertGreaterEqual(self.nest.destroyed_at, before)

    def test_the_destruction_date_can_be_given_and_corrected(self):
        given = timezone.now() - timedelta(days=3)
        self._patch(self.coordinator_user, {'destroyed': True, 'destroyed_at': given.isoformat()})
        self.nest.refresh_from_db()
        self.assertEqual(self.nest.destroyed_at, given)
        # Editing something else keeps the date
        self._patch(self.coordinator_user, {'comments': 'Neutralisé à la perche'})
        self.nest.refresh_from_db()
        self.assertEqual(self.nest.destroyed_at, given)
        corrected = given - timedelta(days=1)
        self._patch(self.coordinator_user, {'destroyed_at': corrected.isoformat()})
        self.nest.refresh_from_db()
        self.assertEqual(self.nest.destroyed_at, corrected)

    def test_the_destruction_date_is_not_in_the_future(self):
        future = timezone.now() + timedelta(days=1)
        response = self._patch(self.coordinator_user, {'destroyed': True, 'destroyed_at': future.isoformat()})
        self.assertEqual(response.status_code, 400)
        self.assertIn('destroyed_at', response.data)

    def test_only_an_admin_reactivates_a_destroyed_nest(self):
        self._patch(self.coordinator_user, {'destroyed': True})
        response = self._patch(self.coordinator_user, {'destroyed': False})
        self.assertEqual(response.status_code, 400)
        self.assertIn('destroyed', response.data)
        self.nest.refresh_from_db()
        self.assertTrue(self.nest.destroyed)

        response = self._patch(self.admin_user, {'destroyed': False})
        self.assertEqual(response.status_code, 200)
        self.nest.refresh_from_db()
        self.assertFalse(self.nest.destroyed)
        self.assertIsNone(self.nest.destroyed_at)

    def test_a_nest_destroyed_before_the_dates_were_kept_keeps_no_invented_date(self):
        Nest.objects.filter(pk=self.nest.pk).update(destroyed=True, destroyed_at=None)
        self._patch(self.coordinator_user, {'comments': 'Ancien nid'})
        self.nest.refresh_from_db()
        self.assertIsNone(self.nest.destroyed_at)

    # -- photos -----------------------------------------------------------------

    def test_the_hunters_admin_adds_and_deletes_photos(self):
        response = self._add_photos(self.coordinator_user, count=2)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['photos']), 2)
        photo = self.nest.photos.first()
        path = photo.image.path
        self.assertTrue(os.path.exists(path))

        response = self._delete_photo(self.coordinator_user, photo.id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['photos']), 1)
        self.assertFalse(os.path.exists(path))

    def test_the_admin_adds_and_deletes_photos(self):
        self.assertEqual(self._add_photos(self.admin_user).status_code, 200)
        photo = self.nest.photos.get()
        self.assertEqual(self._delete_photo(self.admin_user, photo.id).status_code, 200)
        self.assertFalse(self.nest.photos.exists())

    def test_others_do_not_change_the_photos(self):
        self._add_photos(self.admin_user)
        photo = self.nest.photos.get()
        for user in (self.reporter_user, self.hunter_user, self.trappers_admin_user):
            self.assertEqual(self._add_photos(user).status_code, 403)
            self.assertEqual(self._delete_photo(user, photo.id).status_code, 403)
        self.assertEqual(self.nest.photos.count(), 1)

    def test_a_photo_of_another_nest_is_not_deleted(self):
        other = Nest.objects.create(latitude=50.5, longitude=4.5)
        photo = NestPhoto.objects.create(nest=other, image='nests/x/y.jpg')
        self.assertEqual(self._delete_photo(self.admin_user, photo.id).status_code, 404)
        self.assertTrue(NestPhoto.objects.filter(pk=photo.pk).exists())

    def test_deleting_a_nest_removes_its_files(self):
        self._add_photos(self.admin_user)
        path = self.nest.photos.get().image.path
        response = self._call('delete', f'/nests/{self.nest.id}/', {'delete': 'destroy'},
                              self.admin_user, pk=self.nest.id)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(os.path.exists(path))

    def test_the_photos_are_served_to_who_sees_the_nest(self):
        self._add_photos(self.admin_user)
        path = self.nest.photos.get().image.name
        for user, expected in ((self.reporter_user, 200), (self.hunter_user, 200),
                               (self.admin_user, 200), (self.stranger_user, 404)):
            request = self.factory.get(f'/api/media/{path}')
            force_authenticate(request, user=user)
            self.assertEqual(media_view(request, path=path).status_code, expected, user.roles)
        self.assertEqual(media_view(self.factory.get(f'/api/media/{path}'), path=path).status_code, 404)

    def test_the_public_list_shows_no_photo(self):
        self._add_photos(self.admin_user)
        Nest.objects.filter(pk=self.nest.pk).update(destroyed=True)
        response = NestViewSet.as_view({'get': 'destroyed'})(
            self.factory.get('/nests/destroyed/?lat=50.5&lon=4.5&radius=5'))
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('photos', response.data[0])

    # -- nearby apiaries ----------------------------------------------------------

    def test_the_afsca_numbers_within_one_km_are_listed(self):
        # 0.001° of latitude is about 111 m
        Apiary.objects.create(latitude=50.5081, longitude=4.5, afsca_number='2.000.000.900')  # ~900 m
        Apiary.objects.create(latitude=50.5027, longitude=4.5, afsca_number='3.000.000.300')  # ~300 m
        Apiary.objects.create(latitude=50.5054, longitude=4.5, afsca_number='3.000.000.300')  # same number
        Apiary.objects.create(latitude=50.5009, longitude=4.5, afsca_number='')               # no number
        Apiary.objects.create(latitude=50.5099, longitude=4.5, afsca_number='1.000.001.100')  # ~1100 m
        response = self._nearby(self.coordinator_user)
        self.assertEqual(response.status_code, 200)
        # Sorted by number, never by distance, and no distance given
        self.assertEqual(response.data, ['2.000.000.900', '3.000.000.300'])

    def test_the_nearby_apiaries_are_for_the_managers(self):
        Apiary.objects.create(latitude=50.5027, longitude=4.5, afsca_number='3.000.000.300')
        self.assertEqual(self._nearby(self.admin_user).status_code, 200)
        for user in (self.reporter_user, self.hunter_user, self.trappers_admin_user):
            self.assertEqual(self._nearby(user).status_code, 403)


# ---------------------------------------------------------------------------
# AFSCA numbers: X.XXX.XXX.XXX
# ---------------------------------------------------------------------------

from .afsca import normalize_afsca


class AfscaNumberTests(ApiaryTestCase):
    def _create(self, number):
        return self._api('post', '/apiaries/', {'post': 'create'}, self.owner_user, {
            'latitude': 50.4, 'longitude': 4.4, 'afsca_number': number,
        }, format='json')

    def test_the_number_is_normalized(self):
        for typed in ('9005577599', '9.005.577.599', ' 9 005 577 599 ', '9-005-577-599'):
            self.assertEqual(normalize_afsca(typed), '9.005.577.599', typed)
        self.assertEqual(normalize_afsca(''), '')

    def test_a_malformed_number_is_refused(self):
        for typed in ('900557759', '90055775990', 'BE9005577599', 'X1'):
            self.assertIsNone(normalize_afsca(typed), typed)
            response = self._create(typed)
            self.assertEqual(response.status_code, 400, typed)
            self.assertIn('afsca_number', response.data)

    def test_the_stored_form_is_formatted(self):
        response = self._create('9005577599')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Apiary.objects.get(pk=response.data['id']).afsca_number, '9.005.577.599')

    def test_a_number_recorded_before_the_format_can_be_kept(self):
        Apiary.objects.filter(pk=self.apiary.pk).update(afsca_number='BE-123')
        response = self._api('patch', '/', {'patch': 'partial_update'}, self.owner_user,
                             {'afsca_number': 'BE-123', 'comments': 'ok'}, pk=self.apiary.id,
                             format='json')
        self.assertEqual(response.status_code, 200, response.data)
        response = self._api('patch', '/', {'patch': 'partial_update'}, self.owner_user,
                             {'afsca_number': 'BE-124'}, pk=self.apiary.id, format='json')
        self.assertEqual(response.status_code, 400)

    def test_the_search_finds_a_number_typed_without_dots(self):
        Apiary.objects.filter(pk=self.apiary.pk).update(afsca_number='9.005.577.599')
        request = self.factory.get('/apiaries/managed/?q=5577599')
        force_authenticate(request, user=self.owner_user)
        response = ApiaryViewSet.as_view({'get': 'managed'})(request)
        self.assertEqual([a['id'] for a in response.data['results']], [self.apiary.id])


# ---------------------------------------------------------------------------
# Apiary hand-over (`/apiaries/<id>/owner/`)
# ---------------------------------------------------------------------------

class ApiaryOwnerTransferTests(GroupInvitationTestCase):
    """A platform admin, or the administrator of the owner's group, hands an apiary over."""

    def setUp(self):
        super().setUp()
        patcher = patch('hornet.serializers.get_user_display_name', return_value='Tester')
        patcher.start()
        self.addCleanup(patcher.stop)
        self.kc.groups[_ENA_ADMIN] = {'id': 'gid-ena-admin', 'path': _ENA_ADMIN, 'name': 'admin',
                                      'attributes': {}}
        # `aga` administers ena; `member` is a direct member; `newcomer` never signed in here
        self.newcomer_guid = str(uuid_module.uuid4())
        self.kc.members['gid-ena'] = [
            {'id': self.member.guid, 'firstName': 'Anne', 'lastName': 'Bastin',
             'email': 'anne@example.org'},
            {'id': self.newcomer_guid, 'firstName': 'Zoé', 'lastName': 'Zimmer'},
        ]
        self.kc.members['gid-ena-admin'] = [{'id': self.aga.guid, 'firstName': 'Jean', 'lastName': 'Lambert'}]
        self.kc.members['gid-vsab'] = [{'id': self.invitee_guid, 'firstName': 'Pi', 'lastName': 'Abeille'}]
        # The administrator created the apiary for a member who is not at ease with the app
        self.apiary = Apiary.objects.create(
            latitude=50.5, longitude=4.5, created_by_id=self.aga.guid, owner_id=self.aga.guid)

    def _owner(self, method, user, data=None, query=''):
        return self._call(ApiaryViewSet, method, f'/api/apiaries/{self.apiary.id}/owner/{query}',
                          {'get': 'owner', 'put': 'owner'}, user, data, pk=self.apiary.id)

    def test_group_admin_hands_the_apiary_over_to_a_member(self):
        response = self._owner('put', self.aga, {'owner_guid': self.member.guid, 'group_path': _ENA})
        self.assertEqual(response.status_code, 200, response.data)
        self.apiary.refresh_from_db()
        self.assertEqual(str(self.apiary.owner_id), self.member.guid)
        # The creator is kept, and the former owner no longer sees it
        self.assertEqual(str(self.apiary.created_by_id), self.aga.guid)
        self.assertFalse(response.data['permissions']['read'])

    def test_a_member_who_never_signed_in_gets_a_local_user(self):
        response = self._owner('put', self.aga, {'owner_guid': self.newcomer_guid, 'group_path': _ENA})
        self.assertEqual(response.status_code, 200, response.data)
        self.apiary.refresh_from_db()
        self.assertEqual(str(self.apiary.owner_id), self.newcomer_guid)

    def test_candidates_are_named_without_email(self):
        response = self._owner('get', self.aga, query=f'?group_path={_ENA}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([g['path'] for g in response.data['groups']], [_ENA])
        self.assertEqual([m['name'] for m in response.data['members']], ['Anne Bastin', 'Jean Lambert', 'Zoé Zimmer'])
        self.assertNotIn('example.org', str(response.data))

    def test_the_target_must_belong_to_the_group(self):
        outsider = str(uuid_module.uuid4())
        data = {'owner_guid': outsider, 'group_path': _ENA}
        self.assertEqual(self._owner('put', self.aga, data).status_code, 400)
        data = {'owner_guid': self.invitee_guid, 'group_path': _ENA}
        self.assertEqual(self._owner('put', self.aga, data).status_code, 400)
        self.assertEqual(self._owner('put', self.aga, {'owner_guid': 'x', 'group_path': _ENA}).status_code, 400)
        self.assertEqual(self._owner('put', self.aga, {'owner_guid': self.member.guid}).status_code, 400)

    def test_group_admin_cannot_use_another_group(self):
        data = {'owner_guid': self.invitee_guid, 'group_path': _VSAB}
        self.assertEqual(self._owner('put', self.aga, data).status_code, 403)
        self.assertEqual(self._owner('get', self.aga, query=f'?group_path={_VSAB}').status_code, 403)
        self.apiary.refresh_from_db()
        self.assertEqual(str(self.apiary.owner_id), self.aga.guid)

    def test_group_admin_cannot_take_the_apiary_of_someone_outside_the_group(self):
        outsider = User.objects.create(guid=uuid_module.uuid4(), group_paths=[_VSAB])
        Apiary.objects.filter(pk=self.apiary.pk).update(owner=outsider)
        data = {'owner_guid': self.member.guid, 'group_path': _ENA}
        self.assertEqual(self._owner('put', self.aga, data).status_code, 403)
        self.assertEqual(self._owner('get', self.aga).status_code, 403)

    def test_members_and_plain_owners_cannot_hand_over(self):
        Apiary.objects.filter(pk=self.apiary.pk).update(owner_id=self.member.guid)
        data = {'owner_guid': self.newcomer_guid, 'group_path': _ENA}
        for user in (self.member, self.trappers_admin):
            self.assertEqual(self._owner('put', user, data).status_code, 403)
            self.assertEqual(self._owner('get', user).status_code, 403)

    def test_platform_admin_chooses_any_association(self):
        response = self._owner('get', self.admin)
        self.assertEqual([g['path'] for g in response.data['groups']], [_ENA, _VSAB])
        data = {'owner_guid': self.invitee_guid, 'group_path': _VSAB}
        self.assertEqual(self._owner('put', self.admin, data).status_code, 200)
        self.apiary.refresh_from_db()
        self.assertEqual(str(self.apiary.owner_id), self.invitee_guid)

    def test_platform_admin_can_still_name_a_known_user_directly(self):
        response = self._owner('put', self.admin, {'owner_guid': self.member.guid})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self._owner('put', self.admin, {'owner_guid': str(uuid_module.uuid4())}).status_code, 400)

    def test_permissions_tell_who_may_hand_over(self):
        def flag(user):
            request = self.factory.get(f'/api/apiaries/{self.apiary.id}/')
            force_authenticate(request, user=user)
            response = ApiaryViewSet.as_view({'get': 'retrieve'})(request, pk=self.apiary.id)
            self.assertEqual(response.status_code, 200, response.data)
            return response.data['permissions']['change_owner']
        self.assertTrue(flag(self.aga))      # owner and administrator
        self.assertTrue(flag(self.admin))
        # Shared with the group, a member's apiary is readable by its administrator, not handed over by peers
        Apiary.objects.filter(pk=self.apiary.pk).update(owner_id=self.member.guid)
        ApiaryGroupPermission.objects.create(
            apiary=self.apiary, group=BeekeeperGroup.objects.create(name='ena', path=_ENA), can_read=True)
        self.assertTrue(flag(self.aga))
        self.assertFalse(flag(self.member))
