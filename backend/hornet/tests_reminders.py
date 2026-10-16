"""Trap reminders: what is due, when it goes out, how often, and to whom."""

import json
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import force_authenticate

from . import notification_kinds as kinds
from . import reminders
from .models import PushNotification, PushSubscription, Trap, TrapEvent, TrapReminder, TrapType, User
from .pending import pending_view
from .push_views import PushViewSet
from .tests import TrapTestCase
from .trap_views import TrapViewSet

KEYS = {'VAPID_PUBLIC_KEY': 'public', 'VAPID_PRIVATE_KEY': 'private', 'PUSH_SYNC': True}


def at(day, hour=9, minute=5):
    """A local date-time in October 2026; the 20th is a Tuesday, the 25th a Sunday."""
    return timezone.make_aware(datetime(2026, 10, day, hour, minute))


@override_settings(**KEYS)
class ReminderTestCase(TrapTestCase):
    def setUp(self):
        super().setUp()
        self.webpush = patch('hornet.push.webpush', return_value=MagicMock(status_code=201))
        self.sent = self.webpush.start()
        self.addCleanup(self.webpush.stop)
        TrapType.objects.filter(pk=self.trap_type.pk).update(reading_interval_days=2)
        self.trap_type.refresh_from_db()
        Trap.objects.filter(pk=self.trap.pk).update(installed_at=at(1).date())
        self.subscribe(self.owner)

    def subscribe(self, user, n=1):
        PushSubscription.objects.create(user=user, endpoint=f'https://push.example/{user.guid}/{n}',
                                        p256dh='p', auth='a', device='Android · Chrome')

    def event(self, kind, when, trap=None):
        TrapEvent.objects.create(trap=trap or self.trap, kind=kind, performed_at=when,
                                 **({'species': self.velutina, 'quantity': 0, 'observed_quantity': 0,
                                     'emptied': True} if kind == TrapEvent.KIND_CATCH else {}))

    def run_at(self, when):
        return reminders.run(now=when)

    def titles(self):
        return list(PushNotification.objects.order_by('created_at').values_list('title', flat=True))


class WhenTests(ReminderTestCase):
    def test_nine_on_weekdays_ten_on_sundays_never_late_in_the_evening(self):
        self.assertIn('skipped', self.run_at(at(20, 8, 59)))
        self.assertIn('skipped', self.run_at(at(25, 9, 30)))   # Sunday: 10 h
        self.assertIn('skipped', self.run_at(at(20, 20, 0)))
        self.assertNotIn('skipped', self.run_at(at(25, 10, 5)))

    def test_once_a_day_however_many_passes(self):
        self.event(TrapEvent.KIND_CATCH, at(18, 18))
        self.assertEqual(self.run_at(at(20))['notifications'], 1)
        self.assertEqual(self.run_at(at(20, 9, 15))['notifications'], 0)
        self.assertEqual(self.run_at(at(20, 15))['notifications'], 0)
        self.assertEqual(self.sent.call_count, 1)


class WhatIsDueTests(ReminderTestCase):
    def test_a_reading_is_due_its_delay_after_the_last_one(self):
        self.event(TrapEvent.KIND_CATCH, at(19, 18))
        self.assertEqual(self.run_at(at(20))['notifications'], 0)
        self.assertEqual(self.run_at(at(21))['notifications'], 1)
        notification = PushNotification.objects.get()
        self.assertEqual((notification.kind, notification.sender, notification.trap_id),
                         (kinds.TRAP_READING, None, self.trap.pk))
        self.assertEqual(notification.title, "Relevé à faire")
        self.assertIn(f"Piège #{self.trap.pk}", notification.body)
        self.assertIn("dernier relevé il y a 2 jours", notification.body)

    def test_without_any_reading_the_installation_counts(self):
        self.run_at(at(3))
        self.assertIn("installé il y a 2 jours", PushNotification.objects.get().body)

    def test_an_inspection_counts_for_nothing(self):
        self.event(TrapEvent.KIND_CATCH, at(17, 18))
        self.event(TrapEvent.KIND_INSPECTION, at(19, 18))
        self.assertEqual(self.run_at(at(20))['notifications'], 1)

    def test_a_reading_before_a_reinstallation_belongs_to_the_previous_season(self):
        self.event(TrapEvent.KIND_CATCH, at(2, 18))
        self.event(TrapEvent.KIND_INSTALLATION, at(19, 10))
        Trap.objects.filter(pk=self.trap.pk).update(installed_at=at(19).date())
        self.assertEqual(self.run_at(at(20))['notifications'], 0)
        self.run_at(at(21))
        self.assertIn("installé il y a 2 jours", PushNotification.objects.get().body)

    def test_the_attractant_has_its_own_delay(self):
        TrapType.objects.filter(pk=self.trap_type.pk).update(reading_interval_days=None, refill_interval_days=14)
        self.event(TrapEvent.KIND_REFILL, at(6, 10))
        self.event(TrapEvent.KIND_CATCH, at(19, 10))    # a reading does not renew the attractant
        self.run_at(at(20))
        notification = PushNotification.objects.get()
        self.assertEqual((notification.kind, notification.title), (kinds.TRAP_REFILL, "Attractif à renouveler"))
        self.assertIn("dernière recharge il y a 14 jours", notification.body)

    def test_a_type_without_delay_has_no_reminder(self):
        TrapType.objects.filter(pk=self.trap_type.pk).update(reading_interval_days=None)
        self.assertEqual(self.run_at(at(20))['notifications'], 0)

    def test_a_trap_out_of_service_has_no_reminder(self):
        Trap.objects.filter(pk=self.trap.pk).update(active=False)
        self.assertEqual(self.run_at(at(20))['notifications'], 0)


class HowOftenTests(ReminderTestCase):
    def test_then_every_two_days_three_times_at_most(self):
        self.event(TrapEvent.KIND_CATCH, at(10, 18))
        # 10:05: past the sending hour every day, Sundays (the 18th) included
        sent = {day: self.run_at(at(day, 10))['notifications'] for day in range(12, 24)}
        self.assertEqual([day for day, count in sent.items() if count], [12, 14, 16, 18])
        state = TrapReminder.objects.get()
        self.assertEqual((state.sent_count, state.last_sent_on), (4, at(18).date()))

    def test_a_new_reading_starts_a_new_cycle(self):
        self.event(TrapEvent.KIND_CATCH, at(10, 18))
        for day in (12, 14, 16, 18):
            self.run_at(at(day, 10))
        self.event(TrapEvent.KIND_CATCH, at(19, 18))
        self.assertEqual(self.run_at(at(21))['notifications'], 1)
        self.assertEqual(TrapReminder.objects.get().sent_count, 1)


class ToWhomTests(ReminderTestCase):
    def test_only_owners_with_a_device_and_kept_for_later(self):
        PushSubscription.objects.all().delete()
        self.assertEqual(self.run_at(at(20))['notifications'], 0)
        self.assertFalse(TrapReminder.objects.exists())
        self.subscribe(self.owner)
        self.assertEqual(self.run_at(at(20, 11))['notifications'], 1)

    def test_a_kind_turned_off_is_not_sent(self):
        User.objects.filter(pk=self.owner.pk).update(notification_prefs={kinds.TRAP_READING: False})
        self.assertEqual(self.run_at(at(20))['notifications'], 0)

    def test_from_three_reminders_a_single_summary(self):
        others = [Trap.objects.create(latitude=50.5, longitude=4.5, owner=self.owner, trap_type=self.trap_type,
                                      installed_at=at(1).date()) for _ in range(2)]
        self.run_at(at(20))
        notification = PushNotification.objects.get()
        self.assertEqual(notification.title, "3 rappels pour vos pièges")
        ids = ', '.join(f"#{pk}" for pk in sorted([self.trap.pk] + [t.pk for t in others]))
        self.assertEqual(notification.body, f"À relever : {ids}.")
        self.assertEqual(notification.url, '/traps/due')
        self.assertEqual(TrapReminder.objects.filter(sent_count=1).count(), 3)

    def test_two_reminders_go_one_by_one(self):
        TrapType.objects.filter(pk=self.trap_type.pk).update(refill_interval_days=2)
        self.run_at(at(20))
        self.assertEqual(sorted(self.titles()), ["Attractif à renouveler", "Relevé à faire"])

    def test_the_payload_leads_to_the_trap_and_replaces_the_previous_reminder(self):
        self.run_at(at(20))
        payload = json.loads(self.sent.call_args.kwargs['data'])
        self.assertEqual(payload['url'], f'/traps/due?trap={self.trap.pk}')
        self.assertEqual(payload['tag'], f'{kinds.TRAP_READING}:{self.trap.pk}')

    def test_dry_run_sends_and_records_nothing(self):
        result = reminders.run(now=at(20), dry_run=True)
        self.assertEqual(result['notifications'], 1)
        self.assertFalse(PushNotification.objects.exists())
        self.assertFalse(TrapReminder.objects.exists())


class DueEndpointTests(ReminderTestCase):
    def _due(self, user, query=''):
        request = self.factory.get(f'/api/traps/due/{query}')
        force_authenticate(request, user=user)
        return TrapViewSet.as_view({'get': 'due'})(request)

    def test_the_owner_sees_what_is_due_most_overdue_first(self):
        today = timezone.localdate()
        Trap.objects.filter(pk=self.trap.pk).update(installed_at=today - timedelta(days=5))
        soon = Trap.objects.create(latitude=50.5, longitude=4.5, owner=self.owner, trap_type=self.trap_type,
                                   installed_at=today - timedelta(days=1))
        Trap.objects.create(latitude=50.5, longitude=4.5, owner=self.owner, trap_type=self.trap_type,
                            installed_at=today)     # due in two days: beyond tomorrow
        rows = self._due(self.owner_user).data
        self.assertEqual([(r['trap']['id'], r['kind'], r['days_late']) for r in rows],
                         [(self.trap.pk, kinds.TRAP_READING, 3), (soon.pk, kinds.TRAP_READING, -1)])
        self.assertTrue(rows[0]['from_installation'])
        self.assertEqual(len(self._due(self.owner_user, '?days=0').data), 1)

    def test_only_ones_own_traps(self):
        Trap.objects.filter(pk=self.trap.pk).update(installed_at=timezone.localdate() - timedelta(days=5),
                                                    group=self.group)
        self.assertEqual(self._due(self.member_user).data, [])

    def test_the_traps_badge_counts_what_is_due_today(self):
        today = timezone.localdate()
        Trap.objects.filter(pk=self.trap.pk).update(installed_at=today - timedelta(days=5))
        Trap.objects.create(latitude=50.5, longitude=4.5, owner=self.owner, trap_type=self.trap_type,
                            installed_at=today - timedelta(days=1))  # due tomorrow: not yet
        request = self.factory.get('/api/pending/')
        force_authenticate(request, user=self.owner_user)
        self.assertEqual(pending_view(request).data['traps'], len(self._due(self.owner_user, '?days=0').data))
        self.assertEqual(pending_view(request).data['traps'], 1)


class PreferencesTests(ReminderTestCase):
    def _call_prefs(self, method, user, data=None):
        request = getattr(self.factory, method)('/api/push/preferences/', data, format='json')
        force_authenticate(request, user=user)
        return PushViewSet.as_view({'get': 'preferences', 'put': 'set_preferences'})(request)

    def test_everything_is_on_by_default_and_only_what_is_off_is_stored(self):
        kinds_on = {k['id']: k['enabled'] for k in self._call_prefs('get', self.owner_user).data['kinds']}
        # Only "Tous les nouveaux nids" waits for a beekeeper's explicit choice
        always_on = (kinds.TRAP_READING, kinds.TRAP_REFILL, kinds.GROUP_MESSAGE, kinds.PLATFORM_MESSAGE,
                     kinds.NEST_FOLLOWUP)
        self.assertEqual({k: kinds_on[k] for k in always_on}, {k: True for k in always_on})
        self._call_prefs('put', self.owner_user, {kinds.PLATFORM_MESSAGE: False})
        self._call_prefs('put', self.owner_user, {kinds.TRAP_READING: False})
        self._call_prefs('put', self.owner_user, {kinds.TRAP_READING: True})
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.notification_prefs, {kinds.PLATFORM_MESSAGE: False})

    def test_unknown_kinds_and_values_are_refused(self):
        self.assertEqual(self._call_prefs('put', self.owner_user, {'spam': False}).status_code, 400)
        self.assertEqual(self._call_prefs('put', self.owner_user, {kinds.TRAP_READING: 'no'}).status_code, 400)
