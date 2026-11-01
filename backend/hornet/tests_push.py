"""Web Push: subscriptions, sending to a group or a member, acknowledgements."""

import datetime
from unittest.mock import MagicMock, patch

from django.test import override_settings
from django.utils import timezone

from audit.models import AuditEvent
from pywebpush import WebPushException

from . import push
from .models import PushDelivery, PushNotification, PushSubscription, User
from .push_views import PushViewSet
from .tests import GroupInvitationTestCase, _ENA, _ENA_ADMIN

KEYS = {'VAPID_PUBLIC_KEY': 'public', 'VAPID_PRIVATE_KEY': 'private', 'PUSH_SYNC': True}
IPHONE = ('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 '
          '(KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1')


def _subscription(user, n=1, device='Android · Chrome'):
    return PushSubscription.objects.create(
        user=User.objects.get_or_create(guid=user.guid)[0], endpoint=f'https://push.example/{user.guid}/{n}',
        p256dh='p', auth='a', device=device)


class DeviceLabelTests(GroupInvitationTestCase):
    def test_labels(self):
        self.assertEqual(push.device_label(IPHONE), 'iOS · Safari')
        self.assertEqual(push.device_label('Mozilla/5.0 (Linux; Android 14) Chrome/124.0 Mobile Safari/537.36'),
                         'Android · Chrome')
        self.assertEqual(push.device_label('Mozilla/5.0 (Windows NT 10.0) Chrome/124.0 Edg/124.0'),
                         'Windows · Edge')
        self.assertEqual(push.device_label(''), 'Appareil')


@override_settings(**KEYS)
class PushTestCase(GroupInvitationTestCase):
    def setUp(self):
        super().setUp()
        self.kc.groups[_ENA_ADMIN] = {'id': 'gid-ena-admin', 'path': _ENA_ADMIN, 'name': 'admin',
                                      'attributes': {}}
        self.kc.groups['/trappers'] = {'id': 'gid-trappers', 'path': '/trappers', 'name': 'trappers',
                                       'attributes': {}}
        self.kc.groups['/trappers/admin'] = {'id': 'gid-trappers-admin', 'path': '/trappers/admin',
                                             'name': 'admin', 'attributes': {}}
        self.bee = self._user(['beekeeper'], [_ENA])
        self.kc.members['gid-ena'] = [{'id': self.member.guid}, {'id': self.bee.guid}]
        self.kc.members['gid-ena-admin'] = [{'id': self.aga.guid}]
        self.kc.members['gid-trappers'] = [{'id': self.member.guid}, {'id': self.invitee.guid}]
        self.kc.members['gid-trappers-admin'] = [{'id': self.trappers_admin.guid}]
        self.webpush = patch('hornet.push.webpush', return_value=MagicMock(status_code=201))
        self.sent = self.webpush.start()
        self.addCleanup(self.webpush.stop)

    def _post(self, action, user, data=None, **kwargs):
        return self._call(PushViewSet, 'post', f'/api/push/{action}/', {'post': action}, user, data, **kwargs)

    def _send(self, user, **data):
        data.setdefault('group_path', _ENA)
        data.setdefault('title', 'Réunion')
        data.setdefault('body', 'Ce soir à 20 h.')
        with self.captureOnCommitCallbacks(execute=True):
            return self._post('send', user, data)


class SubscriptionTests(PushTestCase):
    def _subscribe(self, user, endpoint='https://push.example/abc'):
        request = self.factory.post('/api/push/subscriptions/', {
            'endpoint': endpoint, 'keys': {'p256dh': 'k', 'auth': 'a'}, 'installed': True},
            format='json', HTTP_USER_AGENT=IPHONE)
        from rest_framework.test import force_authenticate
        force_authenticate(request, user=user)
        return PushViewSet.as_view({'post': 'subscribe'})(request)

    def test_subscribing_records_the_device_and_is_idempotent(self):
        self.assertEqual(self._subscribe(self.member).status_code, 201)
        self.assertEqual(self._subscribe(self.member).status_code, 200)
        [sub] = PushSubscription.objects.all()
        self.assertEqual((sub.device, sub.installed, str(sub.user_id)), ('iOS · Safari', True, self.member.guid))

    def test_a_browser_changing_hands_goes_to_the_new_user(self):
        self._subscribe(self.member)
        self._subscribe(self.bee)
        self.assertEqual(str(PushSubscription.objects.get().user_id), self.bee.guid)

    def test_incomplete_or_insecure_subscriptions_are_refused(self):
        request = self.factory.post('/api/push/subscriptions/', {'endpoint': 'http://x'}, format='json')
        from rest_framework.test import force_authenticate
        force_authenticate(request, user=self.member)
        self.assertEqual(PushViewSet.as_view({'post': 'subscribe'})(request).status_code, 400)
        self.assertEqual(self._subscribe(self.member, endpoint='http://insecure').status_code, 400)

    @override_settings(VAPID_PUBLIC_KEY='', VAPID_PRIVATE_KEY='')
    def test_without_keys_the_feature_is_off(self):
        self.assertEqual(self._subscribe(self.member).status_code, 503)
        request = self.factory.get('/api/push/config/')
        from rest_framework.test import force_authenticate
        force_authenticate(request, user=self.member)
        response = PushViewSet.as_view({'get': 'config'})(request)
        self.assertEqual(response.data, {'enabled': False, 'public_key': None, 'paused_kinds': []})

    def test_unsubscribing_only_removes_ones_own_device(self):
        mine, theirs = _subscription(self.member), _subscription(self.bee)
        from rest_framework.test import force_authenticate
        for sub, expected in ((theirs, 2), (mine, 1)):
            request = self.factory.delete('/api/push/subscriptions/', {'endpoint': sub.endpoint}, format='json')
            request.GET = request.GET.copy()
            request.GET['endpoint'] = sub.endpoint
            force_authenticate(request, user=self.member)
            self.assertEqual(PushViewSet.as_view({'delete': 'unsubscribe'})(request).status_code, 204)
            self.assertEqual(PushSubscription.objects.count(), expected)


class SendTests(PushTestCase):
    def test_a_group_admin_notifies_the_members_of_the_group_but_not_themselves(self):
        _subscription(self.member), _subscription(self.member, 2, 'iOS · Safari')
        _subscription(self.aga)  # the sender's own device is not addressed
        response = self._send(self.aga)
        self.assertEqual(response.status_code, 202)
        # member + bee (+ aga, who is listed in the admin subgroup, excluded)
        self.assertEqual((response.data['recipients'], response.data['reached'], response.data['devices']), (2, 1, 2))
        self.assertEqual(self.sent.call_count, 2)
        self.assertEqual(set(PushDelivery.objects.values_list('status', flat=True)), {201})

    def test_the_payload_carries_the_delivery_id_to_acknowledge(self):
        _subscription(self.member)
        self._send(self.aga)
        payload = __import__('json').loads(self.sent.call_args.kwargs['data'])
        delivery = PushDelivery.objects.get()
        self.assertEqual(payload, {'id': str(delivery.id), 'title': 'Réunion', 'body': 'Ce soir à 20 h.', 'url': '/',
                                   'tag': str(delivery.notification_id)})
        self.assertEqual(self.sent.call_args.kwargs['vapid_claims'], {'sub': 'mailto:contact@velutina.ovh'})

    def test_a_single_member(self):
        _subscription(self.member), _subscription(self.bee)
        response = self._send(self.aga, guid=self.member.guid)
        self.assertEqual((response.data['recipients'], response.data['devices']), (1, 1))
        self.assertEqual(str(PushNotification.objects.get().recipient), self.member.guid)

    def test_someone_outside_the_group_is_not_found(self):
        self.assertEqual(self._send(self.aga, guid=self.invitee.guid).status_code, 404)

    def test_a_group_admin_cannot_write_to_another_group(self):
        self.assertEqual(self._send(self.aga, group_path='/beekeepers/vsab').status_code, 403)
        self.assertEqual(self._send(self.aga, group_path='/trappers').status_code, 403)

    def test_an_ordinary_member_cannot_send(self):
        self.assertEqual(self._send(self.member).status_code, 403)

    def test_the_trappers_coordinator_reaches_the_trappers(self):
        _subscription(self.invitee)
        response = self._send(self.trappers_admin, group_path='/trappers')
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data['reached'], 1)

    def test_a_platform_admin_reaches_anyone_through_trappers(self):
        _subscription(self.invitee)
        response = self._send(self.admin, group_path='/trappers', guid=self.invitee.guid)
        self.assertEqual((response.status_code, response.data['devices']), (202, 1))

    def test_people_without_device_are_counted_not_failed(self):
        response = self._send(self.aga)
        self.assertEqual((response.status_code, response.data['recipients'], response.data['reached']), (202, 2, 0))
        self.sent.assert_not_called()

    def test_empty_group_has_no_recipient(self):
        self.kc.members['gid-ena'] = []
        response = self._send(self.aga)
        self.assertEqual((response.status_code, response.data['code']), (409, 'no_recipient'))

    def test_text_is_required_and_bounded(self):
        for field, value in (('title', ''), ('title', 'x' * 61), ('body', ''), ('body', 'x' * 201)):
            self.assertEqual(self._send(self.aga, **{field: value}).status_code, 400, (field, len(value)))

    def test_senders_are_limited_per_hour(self):
        for _ in range(PushNotification.HOURLY_LIMIT):
            self.assertEqual(self._send(self.aga).status_code, 202)
        response = self._send(self.aga)
        self.assertEqual((response.status_code, response.data['code']), (429, 'rate_limited'))
        self.assertEqual(self._send(self.admin, group_path=_ENA).status_code, 202)  # per sender

    @override_settings(VAPID_PUBLIC_KEY='', VAPID_PRIVATE_KEY='')
    def test_off_without_keys(self):
        self.assertEqual(self._send(self.aga).status_code, 503)

    def test_the_audit_trail_keeps_the_title_but_not_the_text(self):
        _subscription(self.member)
        self._send(self.aga)
        [event] = AuditEvent.objects.filter(action='notification.sent')
        self.assertEqual(event.changes, {'title': 'Réunion', 'kind': 'group_message', 'recipients': 2,
                                         'muted': 0, 'devices': 1})
        self.assertEqual((event.target_type, event.target_id), ('group', _ENA))


class MutedKindsTests(PushTestCase):
    def test_a_member_who_turned_group_messages_off_is_not_sent_them(self):
        _subscription(self.member), _subscription(self.bee)
        User.objects.filter(guid=self.bee.guid).update(notification_prefs={'group_message': False})
        response = self._send(self.aga)
        self.assertEqual((response.data['recipients'], response.data['muted'], response.data['devices']), (2, 1, 1))
        self.assertEqual(PushNotification.objects.get().kind, 'group_message')

    def test_a_platform_admin_writes_as_the_platform(self):
        _subscription(self.member)
        User.objects.filter(guid=self.member.guid).update(notification_prefs={'group_message': False})
        response = self._send(self.admin)
        self.assertEqual((response.data['muted'], response.data['devices']), (0, 1))
        self.assertEqual(PushNotification.objects.get().kind, 'platform_message')


class DeliveryTests(PushTestCase):
    def test_a_gone_subscription_is_purged_and_the_delivery_kept(self):
        _subscription(self.member)
        response = MagicMock(status_code=410)
        self.sent.side_effect = WebPushException('gone', response=response)
        self._send(self.aga)
        self.assertEqual(PushSubscription.objects.count(), 0)
        delivery = PushDelivery.objects.get()
        self.assertEqual((delivery.status, delivery.device, delivery.subscription_id), (410, 'Android · Chrome', None))

    def test_a_transient_failure_keeps_the_subscription(self):
        _subscription(self.member)
        self.sent.side_effect = WebPushException('busy', response=MagicMock(status_code=503))
        self._send(self.aga)
        self.assertEqual(PushSubscription.objects.count(), 1)
        self.assertEqual(PushDelivery.objects.get().status, 503)

    def test_an_unreachable_service_does_not_stop_the_others(self):
        _subscription(self.member), _subscription(self.bee)
        self.sent.side_effect = [ConnectionError('down'), MagicMock(status_code=201)]
        self._send(self.aga)
        self.assertEqual(sorted(PushDelivery.objects.values_list('status', flat=True)), [0, 201])

    def test_the_device_acknowledges_once_without_a_session(self):
        _subscription(self.member)
        self._send(self.aga)
        delivery = PushDelivery.objects.get()
        request = self.factory.post(f'/api/push/ack/{delivery.id}/')
        view = PushViewSet.as_view({'post': 'ack'})
        self.assertEqual(view(request, delivery_id=str(delivery.id)).status_code, 204)
        first = PushDelivery.objects.get().received_at
        self.assertIsNotNone(first)
        view(request, delivery_id=str(delivery.id))
        self.assertEqual(PushDelivery.objects.get().received_at, first)

    def test_an_unknown_acknowledgement_is_ignored(self):
        request = self.factory.post('/api/push/ack/x/')
        response = PushViewSet.as_view({'post': 'ack'})(request, delivery_id='00000000-0000-0000-0000-000000000000')
        self.assertEqual(response.status_code, 204)

    def test_only_platform_admins_read_the_diagnostics(self):
        _subscription(self.member)
        self._send(self.aga)
        from rest_framework.test import force_authenticate
        for user, expected in ((self.aga, 403), (self.admin, 200)):
            request = self.factory.get('/api/push/deliveries/')
            force_authenticate(request, user=user)
            response = PushViewSet.as_view({'get': 'deliveries'})(request)
            self.assertEqual(response.status_code, expected)
        self.assertEqual(response.data[0]['status'], 201)


class SelfTestTests(PushTestCase):
    def test_a_user_tests_their_own_devices_with_a_pause_between(self):
        _subscription(self.member)
        with self.captureOnCommitCallbacks(execute=True):
            first = self._post('test', self.member)
        self.assertEqual((first.status_code, first.data['devices']), (202, 1))
        self.assertEqual(self.sent.call_count, 1)
        self.assertEqual(self._post('test', self.member).status_code, 429)

    def test_without_device_there_is_nothing_to_test(self):
        self.assertEqual(self._post('test', self.member).status_code, 409)


class RetentionTests(PushTestCase):
    def _notification(self, days_ago):
        notification = PushNotification.objects.create(sender=None, recipient=self.member.guid, title='t',
                                                        body='b', recipients_count=1)
        PushNotification.objects.filter(pk=notification.pk).update(
            created_at=timezone.now() - datetime.timedelta(days=days_ago))
        return notification

    def _seen(self, n, days_ago):
        sub = _subscription(self.member, n)
        PushSubscription.objects.filter(pk=sub.pk).update(
            last_seen_at=timezone.now() - datetime.timedelta(days=days_ago))
        return sub

    def test_old_history_and_idle_devices_are_purged(self):
        recent_device, idle_device = self._seen(1, 182), self._seen(2, 184)
        old, recent = self._notification(91), self._notification(89)
        for notification in (old, recent):
            PushDelivery.objects.create(notification=notification, subscription=recent_device, user=self.member.guid)
        self.assertEqual(push.purge_expired(dry_run=True), {'notifications': 1, 'deliveries': 1, 'devices': 1})
        self.assertEqual(PushNotification.objects.count(), 2)  # a dry run deletes nothing

        self.assertEqual(push.purge_expired(), {'notifications': 1, 'deliveries': 1, 'devices': 1})
        self.assertEqual(list(PushNotification.objects.values_list('pk', flat=True)), [recent.pk])
        self.assertEqual(PushDelivery.objects.get().notification_id, recent.pk)
        self.assertEqual(list(PushSubscription.objects.values_list('pk', flat=True)), [recent_device.pk])
        self.assertFalse(PushSubscription.objects.filter(pk=idle_device.pk).exists())
        self.assertEqual(push.purge_expired(), {'notifications': 0, 'deliveries': 0, 'devices': 0})

    def test_opening_the_app_keeps_the_device(self):
        sub = self._seen(1, 184)
        request = self.factory.post('/api/push/subscriptions/', {
            'endpoint': sub.endpoint, 'keys': {'p256dh': 'k', 'auth': 'a'}}, format='json')
        from rest_framework.test import force_authenticate
        force_authenticate(request, user=self.member)
        response = PushViewSet.as_view({'post': 'subscribe'})(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn('last_seen_at', response.data)
        self.assertEqual(push.purge_expired()['devices'], 0)
        self.assertTrue(PushSubscription.objects.filter(pk=sub.pk).exists())
