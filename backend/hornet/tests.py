from datetime import datetime, timezone as dt_timezone

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
        force_authenticate(request, user=FakeUser(roles=['volunteer']))
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


class NestArchiveFilterTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.current_year = timezone.now().year
        self.current_year_nest = _make_nest(self.current_year)
        self.past_year_nest = _make_nest(self.current_year - 1)

    def test_default_list_requires_auth_and_shows_current_year_only(self):
        request = self.factory.get('/nests/?lat=50.5&lon=4.5&radius=5')
        force_authenticate(request, user=FakeUser(roles=['volunteer']))
        view = NestViewSet.as_view({'get': 'list'})
        response = view(request)
        ids = {item['id'] for item in response.data}
        self.assertEqual(ids, {self.current_year_nest.id})

    def test_bulk_archive_forbidden_for_non_admin(self):
        request = self.factory.post('/nests/bulk_archive/?year=2024')
        force_authenticate(request, user=FakeUser(roles=['volunteer']))
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
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from PIL import Image

from .models import BeekeeperGroup, Species, Trap, TrapEvent, TrapPhoto, TrapType, User
from .trap_views import SpeciesViewSet, TrapEventViewSet, TrapTypeViewSet, TrapViewSet
from .media_views import media_view


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
        self.owner_user = FakeTrapUser(['volunteer'], self.owner_guid, [self.group_path])

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
        self.stranger_user = FakeTrapUser(['volunteer'], self.stranger_guid,
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

    def test_volunteer_can_create(self):
        response = self._create(self.owner_user)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['owner']['guid'], str(self.owner_guid))

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
        self.owner.group_paths = ['/volunteers/elsewhere']
        self.owner.save()
        self.assertEqual(self._put(self.group_admin_user, self.group_path).status_code, 403)

    def test_member_without_admin_subgroup_cannot_delegate(self):
        self.assertEqual(self._put(self.member_user, self.group_path).status_code, 403)

    def test_platform_admin_can_delegate_to_any_group(self):
        self.assertEqual(self._put(self.admin_user, '/beekeepers/whatever').status_code, 200)

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

    def test_zero_quantity_duplicates_and_empty_lists_are_refused(self):
        self.assertEqual(self._post_catches(
            [{'species_slug': 'vespa-velutina', 'quantity': 0}]).status_code, 400)
        self.assertEqual(self._post_catches(
            [{'species_slug': 'vespa-velutina', 'quantity': 1},
             {'species_slug': 'vespa-velutina', 'quantity': 2}]).status_code, 400)
        self.assertEqual(self._post_catches([]).status_code, 400)

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
        self.jwt_user = FakeTrapUser(['volunteer'], self.guid)
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

    def test_volunteers_have_no_access(self):
        self.member_user.roles = ['volunteer']
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
                         {'update': True, 'delete': False, 'share': False})


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

    def test_update_needs_owner_or_update_grant(self):
        patch_data = {'afsca_number': 'X1'}
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

    def test_distance_ordering_has_no_radius_limit(self):
        # The removed trap is ~80 km away: far beyond the 5 km of the map listing
        ids = self._ids(self._managed(self.owner_user,
                                      'active=all&ordering=distance&lat=51.2&lon=4.4'))
        self.assertEqual(ids, [self.removed.id, self.trap.id])
        self.assertEqual(self._managed(self.owner_user, 'ordering=distance').status_code, 400)

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

    def test_volunteers_have_no_access(self):
        self.owner_user.roles = ['volunteer']
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

    def test_distance_ordering_has_no_radius_limit(self):
        ids = self._list(self._managed(self.owner_user, 'ordering=distance&lat=51.2&lon=4.4'))
        self.assertEqual(ids, [self.far.id, self.apiary.id])

    def test_rows_carry_address_and_permissions(self):
        response = self._managed(self.member_user, 'scope=mine')
        row = next(r for r in response.data['results'] if r['id'] == self.shared.id)
        self.assertEqual(row['address'], 'Chemin des Ruches 7')
        self.assertEqual(row['permissions'], {'update': True, 'delete': True, 'share': True})

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
