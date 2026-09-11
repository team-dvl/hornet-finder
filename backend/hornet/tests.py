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
