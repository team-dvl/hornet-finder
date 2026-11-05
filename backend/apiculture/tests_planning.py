import datetime
from unittest.mock import MagicMock, patch

from django.test import override_settings
from django.utils import timezone

from audit.models import AuditEvent
from hornet import notification_kinds as kinds
from hornet import pending, scheduled
from hornet.models import PlatformSettings, PushNotification, PushSubscription, User

from . import planning
from .models import Visit
from .tests import ENA
from .tests_visits import VisitTestCase

KEYS = {'VAPID_PUBLIC_KEY': 'public', 'VAPID_PRIVATE_KEY': 'private', 'PUSH_SYNC': True}


def local(day, hour, minute=0):
    return timezone.make_aware(datetime.datetime(2026, 6, day, hour, minute))


class PlanningTestCase(VisitTestCase):
    def _plan(self, when, user=None, **data):
        return self._visit(user=user, **{'status': 'planned', 'started_at': when.isoformat(), 'inspections': [], **data})

    def _planned(self, when, **data):
        response = self._plan(when, **data)
        self.assertEqual(response.status_code, 201, response.data)
        return Visit.objects.get(pk=response.data['id'])


class PlannedVisitTests(PlanningTestCase):
    def test_a_planned_visit_is_in_the_future_and_leaves_the_colonies_alone(self):
        tomorrow = timezone.now() + datetime.timedelta(days=1)
        response = self._plan(tomorrow, inspections=[{'colony': str(self.colony.pk), 'bars': 15}])
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['status'], 'planned')
        self.colony.refresh_from_db()
        self.assertEqual(self.colony.bars, 10)
        self.assertTrue(AuditEvent.objects.filter(action='apiary_visit.planned').exists())

    def test_a_done_visit_is_not_in_the_future(self):
        response = self._visit(started_at=(timezone.now() + datetime.timedelta(days=1)).isoformat())
        self.assertEqual(response.status_code, 400)
        self.assertIn('started_at', response.data)

    def test_completing_applies_the_inspections_and_cannot_be_undone(self):
        visit = self._planned(timezone.now() + datetime.timedelta(hours=3),
                              inspections=[{'colony': str(self.colony.pk), 'bars': 13}])
        # Done means it took place: its time cannot stay in the future
        response = self._as(self.member).patch(f'/api/visits/{visit.pk}/', {'status': 'done'}, format='json')
        self.assertEqual(response.status_code, 400)
        response = self._as(self.member).patch(f'/api/visits/{visit.pk}/', {
            'status': 'done', 'started_at': self.when.isoformat()}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.colony.refresh_from_db()
        self.assertEqual(self.colony.bars, 13)
        self.assertTrue(AuditEvent.objects.filter(action='apiary_visit.completed').exists())
        response = self._as(self.member).patch(f'/api/visits/{visit.pk}/', {'status': 'planned'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_a_later_planned_visit_does_not_hide_the_latest_done_one(self):
        self._planned(timezone.now() + datetime.timedelta(days=2),
                      inspections=[{'colony': str(self.colony.pk), 'bars': 20}])
        self._created()
        self.colony.refresh_from_db()
        self.assertEqual(self.colony.bars, 11)

    def test_the_journal_and_the_agenda_list_apart(self):
        done = self._created()
        later = self._planned(timezone.now() + datetime.timedelta(days=3))
        sooner = self._planned(timezone.now() + datetime.timedelta(days=1))
        journal = self._as(self.member).get('/api/visits/').data['results']
        self.assertEqual([row['id'] for row in journal], [str(done.pk)])
        agenda = self._as(self.member).get('/api/visits/', {'status': 'planned'}).data['results']
        self.assertEqual([row['id'] for row in agenda], [str(sooner.pk), str(later.pk)])
        self.assertEqual(self._as(self.member).get('/api/visits/', {'status': 'all'}).data['count'], 3)
        self.assertEqual(self._as(self.member).get('/api/visits/', {'status': 'soon'}).status_code, 400)

    def test_moving_a_visit_clears_its_reminder(self):
        visit = self._planned(timezone.now() + datetime.timedelta(days=1))
        Visit.objects.filter(pk=visit.pk).update(reminded_at=timezone.now())
        later = timezone.now() + datetime.timedelta(days=2)
        self._as(self.member).patch(f'/api/visits/{visit.pk}/', {'title': 'Autre'}, format='json')
        visit.refresh_from_db()
        self.assertIsNotNone(visit.reminded_at)
        self._as(self.member).patch(f'/api/visits/{visit.pk}/', {'started_at': later.isoformat()}, format='json')
        visit.refresh_from_db()
        self.assertIsNone(visit.reminded_at)


class PendingTests(PlanningTestCase):
    def test_the_badge_counts_today_and_late_visits_one_takes_part_in(self):
        self.assertIs(pending.COUNTERS['apiaries'], planning.due_count)
        late = self._planned(timezone.now() + datetime.timedelta(days=1))
        Visit.objects.filter(pk=late.pk).update(started_at=timezone.now() - datetime.timedelta(days=2))
        self._planned(timezone.now() + datetime.timedelta(days=5))
        self._created()
        response = self._as(self.member).get('/api/pending/')
        self.assertEqual(response.data['apiaries'], 1)
        self.assertEqual(self._as(self.stranger).get('/api/pending/').data['apiaries'], 0)


@override_settings(**KEYS)
class ReminderTests(PlanningTestCase):
    def setUp(self):
        super().setUp()
        webpush = patch('hornet.push.webpush', return_value=MagicMock(status_code=201))
        webpush.start()
        self.addCleanup(webpush.stop)
        self.apiary.name = 'Verger'
        self.apiary.save()
        self.friend = self._user(['beekeeper'], [ENA])
        for guid in (self.member.guid, self.friend.guid):
            PushSubscription.objects.create(user_id=guid, endpoint=f'https://push.example/{guid}',
                                            p256dh='p', auth='a', device='Android · Chrome')

    def _visit_at(self, when):
        visit = self._planned(timezone.now() + datetime.timedelta(days=1), guest_names='')
        visit.participants.add(User.objects.get(guid=self.friend.guid))
        Visit.objects.filter(pk=visit.pk).update(started_at=when)
        return visit

    def test_the_reminder_leaves_the_evening_before_once_and_names_no_address(self):
        visit = self._visit_at(local(12, 8, 30))
        self.assertEqual(planning.run(now=local(11, 17, 50))['notifications'], 0)
        result = planning.run(now=local(11, 18, 0))
        self.assertEqual(result['notifications'], 1)
        notification = PushNotification.objects.get(kind=planning.VISIT_REMINDER)
        self.assertEqual(notification.title, 'Visite demain à 08:30')
        self.assertIn('Verger', notification.body)
        self.assertNotIn(self.apiary.address, notification.body)
        self.assertEqual(notification.recipients_count, 2)
        self.assertEqual(notification.url, f'/apiaries/visits?visit={visit.pk}')
        self.assertEqual(planning.run(now=local(11, 19, 0))['notifications'], 0)

    def test_no_reminder_at_night_and_one_at_once_for_a_late_planning(self):
        self._visit_at(local(12, 9, 0))
        self.assertEqual(planning.run(now=local(11, 22, 0))['skipped'], 'quiet hours')
        self.assertEqual(planning.run(now=local(12, 7, 0))['notifications'], 1)

    def test_a_kind_turned_off_or_paused_is_respected(self):
        self._visit_at(local(12, 9, 0))
        User.objects.filter(guid=self.friend.guid).update(notification_prefs={planning.VISIT_REMINDER: False})
        planning.run(now=local(11, 18, 0))
        self.assertEqual(PushNotification.objects.get().recipients_count, 1)

        self._visit_at(local(14, 9, 0))
        settings = PlatformSettings.load()
        settings.paused_kinds = [planning.VISIT_REMINDER]
        settings.save()
        self.assertEqual(planning.run(now=local(13, 18, 0))['skipped'], 'paused by the platform')

    def test_a_done_or_passed_visit_is_not_reminded(self):
        self._visit_at(local(11, 17, 0))
        self.assertEqual(planning.run(now=local(11, 18, 0))['notifications'], 0)


class RegistrationTests(PlanningTestCase):
    def test_the_kind_and_the_job_are_hooked_into_hornet(self):
        self.assertIn(planning.VISIT_REMINDER, kinds.KINDS)
        self.assertIn(('visit reminders', planning.run), scheduled.JOBS)
        beekeeper = User(guid='00000000-0000-0000-0000-000000000001', group_paths=['/beekeepers/ena'])
        trapper = User(guid='00000000-0000-0000-0000-000000000002', group_paths=['/trappers'])
        self.assertTrue(kinds.concerns(beekeeper, planning.VISIT_REMINDER))
        self.assertFalse(kinds.concerns(trapper, planning.VISIT_REMINDER))


class CommandTests(PlanningTestCase):
    def test_the_dry_run_sends_nothing(self):
        from io import StringIO
        from django.core.management import call_command
        visit = self._planned(timezone.now() + datetime.timedelta(days=1))
        Visit.objects.filter(pk=visit.pk).update(started_at=local(12, 9, 0))
        out = StringIO()
        call_command('send_visit_reminders', '--dry-run', '--now', '2026-06-11T18:30:00+02:00', stdout=out)
        self.assertIn('1 notification(s) would be sent', out.getvalue())
        visit.refresh_from_db()
        self.assertIsNone(visit.reminded_at)


class CalendarRangeTests(PlanningTestCase):
    def test_a_month_lists_its_planned_and_done_visits_soonest_first(self):
        done = self._created()
        planned = self._planned(timezone.now() + datetime.timedelta(days=2))
        later = self._planned(timezone.now() + datetime.timedelta(days=60))
        today = timezone.localdate()
        response = self._as(self.member).get('/api/visits/', {
            'status': 'all', 'from': (today - datetime.timedelta(days=1)).isoformat(),
            'to': (today + datetime.timedelta(days=30)).isoformat()})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([row['id'] for row in response.data['results']], [str(done.pk), str(planned.pk)])
        self.assertNotIn(str(later.pk), [row['id'] for row in response.data['results']])
        self.assertEqual(self._as(self.member).get('/api/visits/', {'from': 'soon'}).status_code, 400)
