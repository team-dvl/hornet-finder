"""Platform dashboard: the kinds of notifications held back for everyone, and the senders that honour it."""

import datetime

from django.test import override_settings
from django.utils import timezone

from audit.models import AuditEvent

from . import nest_alerts, push, reminders
from . import notification_kinds as kinds
from .models import (
    NestEvent, PlatformSettings, PushDelivery, PushNotification, PushSubscription, Trap, TrapEvent, TrapReminder,
)
from .platform_views import PlatformViewSet
from .push_views import PushViewSet
from .tests_nest_alerts import KEYS, NestAlertTestCase, at
from .tests_push import PushTestCase, _subscription
from .tests_reminders import ReminderTestCase
from .tests_reminders import at as reminder_at


class DashboardTests(PushTestCase):
    def _get(self, user):
        return self._call(PlatformViewSet, 'get', '/api/platform/', {'get': 'list'}, user)

    def _put(self, user, paused):
        return self._call(PlatformViewSet, 'put', '/api/platform/notifications/', {'put': 'notifications'}, user,
                          {'paused': paused})

    def test_only_platform_admins_reach_it(self):
        for user in (self.aga, self.member, self.trappers_admin):
            self.assertEqual(self._get(user).status_code, 403)
            self.assertEqual(self._put(user, ['trap_reading']).status_code, 403)
        self.assertEqual(self._get(self.admin).status_code, 200)

    def test_the_dashboard_counts_devices_and_deliveries(self):
        _subscription(self.member), _subscription(self.bee, device='iOS · Safari')
        self._send(self.aga)
        data = self._get(self.admin).data
        self.assertEqual((data['devices']['total'], data['devices']['people']), (2, 2))
        self.assertEqual({row['device'] for row in data['devices']['by_device']}, {'Android · Chrome', 'iOS · Safari'})
        day = data['deliveries']['day']
        self.assertEqual((day['notifications'], day['deliveries'], day['accepted'], day['failed']), (1, 2, 2, 0))
        self.assertTrue(data['notifications']['configured'])
        self.assertEqual(len(data['notifications']['kinds']), len(kinds.KINDS))

    def test_the_scheduler_is_alive_only_when_it_passed_recently(self):
        self.assertFalse(self._get(self.admin).data['scheduler']['ok'])
        row = PlatformSettings.load()
        row.scheduler_seen_at = timezone.now() - datetime.timedelta(minutes=5)
        row.save()
        self.assertTrue(self._get(self.admin).data['scheduler']['ok'])
        row.scheduler_seen_at = timezone.now() - datetime.timedelta(minutes=31)
        row.save()
        self.assertFalse(self._get(self.admin).data['scheduler']['ok'])

    def test_pausing_is_recorded_once_and_visible_to_everyone(self):
        response = self._put(self.admin, ['trap_reading', 'nest_new', 'trap_reading'])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(sorted(push.paused_kinds()), ['nest_new', 'trap_reading'])
        [event] = AuditEvent.objects.filter(action='platform.notifications_changed')
        self.assertEqual(event.changes, {'paused': ['trap_reading', 'nest_new'], 'resumed': []})
        self.assertEqual(str(event.actor), self.admin.guid)
        # Same state again: nothing to record
        self._put(self.admin, ['nest_new', 'trap_reading'])
        self.assertEqual(AuditEvent.objects.filter(action='platform.notifications_changed').count(), 1)
        # Resume one
        self._put(self.admin, ['nest_new'])
        last = AuditEvent.objects.filter(action='platform.notifications_changed').order_by('-id').first()
        self.assertEqual(last.changes, {'paused': [], 'resumed': ['trap_reading']})
        config = self._call(PushViewSet, 'get', '/api/push/config/', {'get': 'config'}, self.member)
        self.assertEqual(config.data['paused_kinds'], ['nest_new'])

    def test_unknown_kinds_are_refused(self):
        self.assertEqual(self._put(self.admin, ['spam']).status_code, 400)
        self.assertEqual(self._call(PlatformViewSet, 'put', '/api/platform/notifications/', {'put': 'notifications'},
                                    self.admin, {'paused': 'all'}).status_code, 400)
        self.assertEqual(push.paused_kinds(), set())


class MessagesTests(PushTestCase):
    def pause(self, *held):
        PlatformSettings.objects.update_or_create(pk=1, defaults={'paused_kinds': list(held)})

    def test_a_group_administrator_cannot_send_while_group_messages_are_paused(self):
        _subscription(self.member)
        self.pause(kinds.GROUP_MESSAGE)
        response = self._send(self.aga)
        self.assertEqual((response.status_code, response.data['code']), (503, 'paused'))
        self.assertEqual(PushNotification.objects.count(), 0)
        # A platform admin writes as the platform: another kind
        self.assertEqual(self._send(self.admin).status_code, 202)

    def test_the_self_test_is_never_held_back(self):
        _subscription(self.member)
        self.pause(*kinds.KINDS)
        self.assertEqual(self._post('test', self.member).status_code, 202)

    def test_a_message_queued_before_the_pause_is_dropped_and_the_device_kept(self):
        subscription = _subscription(self.member)
        notification = PushNotification.objects.create(sender=None, recipient=self.member.guid, recipients_count=1,
                                                       kind=kinds.PLATFORM_MESSAGE, title='t', body='b')
        push.queue(notification, [self.member.guid])
        self.pause(kinds.PLATFORM_MESSAGE)
        push.deliver_now(notification.id)
        delivery = PushDelivery.objects.get()
        self.assertEqual((delivery.status, delivery.error), (push.STATUS_PAUSED, 'paused by the platform'))
        self.assertTrue(PushSubscription.objects.filter(pk=subscription.pk).exists())
        self.assertEqual(self.sent.call_count, 0)


@override_settings(**KEYS)
class ReminderPauseTests(ReminderTestCase):
    def test_a_paused_reminder_waits_and_goes_out_once_resumed(self):
        self.event(TrapEvent.KIND_CATCH, reminder_at(18, 18))
        PlatformSettings.objects.create(pk=1, paused_kinds=[kinds.TRAP_READING])
        self.assertEqual(self.run_at(reminder_at(20))['notifications'], 0)
        self.assertEqual(TrapReminder.objects.count(), 0)  # nothing counted as sent
        self.assertEqual(self.sent.call_count, 0)

        PlatformSettings.objects.filter(pk=1).update(paused_kinds=[])
        self.assertEqual(self.run_at(reminder_at(20, 10))['notifications'], 1)
        self.assertEqual(PushNotification.objects.get().kind, kinds.TRAP_READING)

    def test_the_other_kind_is_not_affected(self):
        from .models import TrapType
        TrapType.objects.filter(pk=self.trap_type.pk).update(refill_interval_days=2)
        self.event(TrapEvent.KIND_CATCH, reminder_at(18, 18))
        PlatformSettings.objects.create(pk=1, paused_kinds=[kinds.TRAP_READING])
        self.run_at(reminder_at(20))
        self.assertEqual(list(PushNotification.objects.values_list('kind', flat=True)), [kinds.TRAP_REFILL])


class NestAlertPauseTests(NestAlertTestCase):
    def test_a_held_event_stays_pending_and_is_told_once_resumed(self):
        nest = self.report(created=at(20, 8))
        PlatformSettings.objects.create(pk=1, paused_kinds=[kinds.NEST_NEW])
        result = nest_alerts.run(now=at(20))
        # The neighbours (another kind) are told, the coordinators wait
        self.assertEqual(result['notifications'], 2)
        self.assertEqual(result['waiting'], 1)
        self.assertEqual(self.received(self.coordinator), [])
        self.assertIsNone(NestEvent.objects.get(nest=nest).alerted_at)

        PlatformSettings.objects.filter(pk=1).update(paused_kinds=[])
        result = nest_alerts.run(now=at(20, 10))
        self.assertEqual((result['notifications'], result['waiting']), (2, 0))
        self.assertEqual(len(self.received(self.coordinator)), 1)
        self.assertEqual(len(self.received(self.owner)), 1)  # nothing twice
        self.assertIsNotNone(NestEvent.objects.get(nest=nest).alerted_at)

    def test_a_pause_longer_than_the_expiry_drops_the_event(self):
        nest = self.report(created=at(20, 8))
        PlatformSettings.objects.create(pk=1, paused_kinds=list(kinds.KINDS))
        nest_alerts.run(now=at(20))
        self.assertEqual(PushNotification.objects.count(), 0)
        PlatformSettings.objects.filter(pk=1).update(paused_kinds=[])
        self.assertEqual(nest_alerts.run(now=at(23, 10))['notifications'], 0)
        self.assertIsNotNone(NestEvent.objects.get(nest=nest).alerted_at)
        self.assertEqual(PushNotification.objects.count(), 0)
