import datetime
import uuid
from unittest.mock import patch

from django.test import override_settings
from django.utils import timezone

from audit.models import AuditEvent
from hornet.models import ApiaryGroupPermission, BeekeeperGroup
from hornet.tests import _image_file

from .models import Colony, Inspection, Visit
from .tests import ENA, OTHER
from .tests_colonies import ColonyTestCase
from .visit_views import can_read_visit_file


class VisitTestCase(ColonyTestCase):
    """The TBH and the nucleus of the member's apiary, a colony in each."""

    def setUp(self):
        super().setUp()
        self.colony = self._colony(bars=10)
        self.waiting = self._colony(hive=self.nucleus, name='Nucleus', bars=4)
        Colony.objects.filter(pk=self.waiting.pk).update(requeening_since=datetime.date(2026, 5, 1))
        self.when = (timezone.now() - datetime.timedelta(hours=2)).replace(microsecond=0)

    def _visit(self, user=None, **data):
        payload = {
            'apiary': self.apiary.pk, 'started_at': self.when.isoformat(), 'title': 'Contrôle',
            'kinds': ['control', 'feeding'], 'guest_names': 'Marie D.', 'participants': [self.member.guid],
            'inspections': [
                {'colony': str(self.colony.pk), 'bars': 11, 'temper': 'calm', 'feeding': 'syrup',
                 'feeding_amount': '1.5', 'feeding_unit': 'l', 'notes': 'Belle colonie'},
                {'colony': str(self.waiting.pk), 'eggs_seen': True},
            ],
            **data,
        }
        return self._as(user or self.member).post('/api/visits/', payload, format='json')

    def _created(self, **data):
        response = self._visit(**data)
        self.assertEqual(response.status_code, 201, response.data)
        return Visit.objects.get(pk=response.data['id'])


class VisitRecordTests(VisitTestCase):
    def test_a_visit_tells_what_became_of_its_colonies(self):
        response = self._visit()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(response.data['inspections']), 2)
        self.assertEqual(response.data['participants'][0]['guid'], self.member.guid)
        self.colony.refresh_from_db()
        self.waiting.refresh_from_db()
        self.assertEqual(self.colony.bars, 11)
        self.assertEqual(self.waiting.laying_since, self.when.date())
        event = AuditEvent.objects.get(action='apiary_visit.created')
        self.assertIn(f'apiary:{self.apiary.pk}', event.refs)
        self.assertIn(f'colony:{self.colony.pk}', event.refs)
        self.assertIn(f'user:{self.member.guid}', event.refs)
        self.assertNotIn('Marie', str(event.changes))
        self.assertEqual(AuditEvent.objects.get(action='colony.updated').changes, {'bars': [10, 11]})
        self.assertTrue(AuditEvent.objects.filter(action='colony.laying').exists())

    def test_an_older_visit_does_not_overwrite_the_count(self):
        self._created()
        older = (self.when - datetime.timedelta(days=10)).isoformat()
        self._created(started_at=older, inspections=[{'colony': str(self.colony.pk), 'bars': 5}])
        self.colony.refresh_from_db()
        self.assertEqual(self.colony.bars, 11)

    def test_what_a_visit_cannot_hold(self):
        tomorrow = (timezone.now() + datetime.timedelta(days=1)).isoformat()
        self.assertEqual(self._visit(started_at=tomorrow).status_code, 400)
        self.assertEqual(self._visit(inspections=[{'colony': str(self.colony.pk)}, {'colony': str(self.colony.pk)}]).status_code, 400)
        elsewhere = self.apiary.__class__.objects.create(latitude=50.4, longitude=4.4, owner_id=self.member.guid)
        far = self._hive(apiary=elsewhere.pk, name='Ailleurs')
        self.assertEqual(self._visit(inspections=[{'hive': str(far.pk)}]).status_code, 400)
        self.assertEqual(self._visit(inspections=[{'colony': str(self.colony.pk), 'temper': 'grumpy'}]).status_code, 400)
        # More bars than the hive holds: nothing is recorded
        self.assertEqual(self._visit(inspections=[{'colony': str(self.colony.pk), 'bars': 30}]).status_code, 400)
        self.assertFalse(Visit.objects.exists())

    def test_sent_again_with_its_id_it_is_not_created_twice(self):
        visit_id = str(uuid.uuid4())
        self.assertEqual(self._visit(id=visit_id).status_code, 201)
        self.assertEqual(self._visit(id=visit_id).status_code, 200)
        self.assertEqual(Visit.objects.count(), 1)

    def test_participants_are_members_of_ones_associations(self):
        self.assertEqual(self._visit(participants=[self.stranger.guid]).status_code, 400)
        self.assertEqual(self._visit(participants=[self.group_admin.guid]).status_code, 201)


class VisitAccessTests(VisitTestCase):
    def test_who_records_reads_and_edits(self):
        self.assertEqual(self._visit(user=self.stranger).status_code, 403)
        visit = self._created(participants=[self.member.guid, self.group_admin.guid])
        self.assertEqual(self._as(self.stranger).get(f'/api/visits/{visit.pk}/').status_code, 404)
        # A participant edits it
        response = self._as(self.group_admin).patch(f'/api/visits/{visit.pk}/', {'report': 'Tout va bien'},
                                                    format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(AuditEvent.objects.get(action='apiary_visit.updated').changes, {'report': ['', 'Tout va bien']})
        # Who sees the apiary reads it, without editing it
        other = BeekeeperGroup.objects.create(name='other', path=OTHER)
        ApiaryGroupPermission.objects.create(apiary=self.apiary, group=other)
        response = self._as(self.stranger).get(f'/api/visits/{visit.pk}/')
        self.assertEqual((response.status_code, response.data['permissions']['edit']), (200, False))
        self.assertEqual(self._as(self.stranger).patch(f'/api/visits/{visit.pk}/', {'report': 'x'},
                                                       format='json').status_code, 403)

    def test_the_list_by_colony(self):
        visit = self._created()
        response = self._as(self.member).get(f'/api/visits/?colony={self.waiting.pk}')
        self.assertEqual([v['id'] for v in response.data['results']], [str(visit.pk)])
        self.assertEqual(self._as(self.stranger).get('/api/visits/').data['results'], [])


class VisitEditTests(VisitTestCase):
    def test_inspections_are_updated_added_and_removed(self):
        visit = self._created()
        kept = visit.inspections.get(colony=self.colony)
        response = self._as(self.member).patch(f'/api/visits/{visit.pk}/', {'inspections': [
            {'id': kept.pk, 'colony': str(self.colony.pk), 'bars': 12, 'notes': 'Revu'},
        ]}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([i['id'] for i in response.data['inspections']], [kept.pk])
        self.colony.refresh_from_db()
        self.assertEqual(self.colony.bars, 12)
        self.assertIn('inspections', AuditEvent.objects.get(action='apiary_visit.updated').changes)

    def test_a_visit_of_a_hive_deleted_since_stays_editable(self):
        visit = self._created()
        inspection = visit.inspections.get(colony=self.waiting)
        Inspection.objects.filter(pk=inspection.pk).update(hive=None, colony=None)
        items = [{'id': i.pk, 'hive': str(i.hive_id) if i.hive_id else None,
                  'colony': str(i.colony_id) if i.colony_id else None} for i in visit.inspections.all()]
        response = self._as(self.member).patch(f'/api/visits/{visit.pk}/', {'inspections': items}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        kept = Inspection.objects.get(pk=inspection.pk)
        self.assertEqual(kept.hive_label, 'Nucleus 1')

    @override_settings(MEDIA_USE_X_ACCEL=False)
    def test_photos_are_seen_by_who_sees_the_visit(self):
        visit = self._created()
        response = self._as(self.member).post(f'/api/visits/{visit.pk}/photos/',
                                              {'photos': [_image_file()]}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        photo = visit.photos.get()
        path = photo.image.name
        self.assertTrue(path.startswith(f'visits/{visit.pk}/'))
        request = type('R', (), {'user': self.member})()
        self.assertTrue(can_read_visit_file(request, path))
        request.user = self.stranger
        self.assertFalse(can_read_visit_file(request, path))
        response = self._as(self.member).delete(f'/api/visits/{visit.pk}/photos/{photo.pk}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['photos'], [])
        self.assertEqual(AuditEvent.objects.filter(action__startswith='apiary_visit.photo').count(), 2)

    def test_a_deleted_visit_leaves_its_snapshot(self):
        visit = self._created()
        self.assertEqual(self._as(self.member).delete(f'/api/visits/{visit.pk}/').status_code, 204)
        self.assertFalse(Inspection.objects.exists())
        event = AuditEvent.objects.get(action='apiary_visit.deleted')
        self.assertEqual(event.changes['title'], 'Contrôle')
        self.assertEqual(len(event.changes['inspections']), 2)
        self.assertIn(f'colony:{self.colony.pk}', event.refs)


OPEN_METEO_DAY = {
    'hourly': {
        'time': [f'2026-05-10T{hour:02d}:00' for hour in range(24)],
        'temperature_2m': [10 + hour * 0.5 for hour in range(24)],
        'precipitation': [0.0] * 14 + [1.2] + [0.0] * 9,
        'cloud_cover': [40] * 24,
        'wind_speed_10m': [12.5] * 24,
        'weather_code': [2] * 14 + [95] + [2] * 9,
    },
}


class VisitWeatherTests(VisitTestCase):
    def _weather(self, at, user=None):
        return self._as(user or self.member).get(f'/api/visits/weather/?apiary={self.apiary.pk}&at={at}')

    def test_the_weather_of_the_hour_nearest_the_visit(self):
        with patch('apiculture.weather._get', return_value=OPEN_METEO_DAY) as get:
            response = self._weather('2026-05-10T14:20:00Z')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data, {
            'temperature': 17.0, 'precipitation': 1.2, 'wind': 12.5, 'cloud_cover': 40,
            'summary': 'thunderstorm', 'hour': '2026-05-10T14:00:00+00:00', 'source': 'open-meteo'})
        url, params = get.call_args.args
        # The position goes out rounded (about 1 km): the apiary is not given away
        self.assertEqual((params['latitude'], params['longitude']), (50.5, 4.5))
        self.assertEqual((params['start_date'], params['end_date']), ('2026-05-10', '2026-05-10'))
        with patch('apiculture.weather._get', return_value=OPEN_METEO_DAY):
            self.assertEqual(self._weather('2026-05-10T14:40:00Z').data['summary'], 'partly_cloudy')

    def test_old_days_come_from_the_archive(self):
        with patch('apiculture.weather._get', return_value={'hourly': {
                'time': ['2024-06-01T10:00'], 'temperature_2m': [20.1], 'weather_code': [0]}}) as get:
            response = self._weather('2024-06-01T10:05:00Z')
        self.assertEqual(response.data['summary'], 'clear')
        self.assertIn('archive', get.call_args.args[0])

    def test_no_answer_and_no_access(self):
        with patch('apiculture.weather._get', side_effect=OSError('unreachable')):
            self.assertEqual(self._weather('2026-05-10T14:20:00Z').status_code, 503)
        with patch('apiculture.weather._get', return_value=OPEN_METEO_DAY):
            self.assertEqual(self._weather('2026-05-10T14:20:00Z', user=self.stranger).status_code, 404)
            self.assertEqual(self._weather('pas une date').status_code, 400)

    def test_a_visit_keeps_its_weather(self):
        visit = self._created(weather_temperature='17.5', weather_wind='12.5', weather_cloud_cover=40,
                              weather_summary='thunderstorm', weather_source='open-meteo')
        self.assertEqual((float(visit.weather_temperature), visit.weather_summary), (17.5, 'thunderstorm'))
        self.assertEqual(self._visit(weather_summary='tornado').status_code, 400)
        self.assertEqual(self._visit(weather_cloud_cover=140).status_code, 400)
        event = AuditEvent.objects.get(action='apiary_visit.created')
        self.assertEqual(event.changes['weather_summary'], 'thunderstorm')
