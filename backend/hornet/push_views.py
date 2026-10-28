"""
Web Push notifications (see `push.py` for the sending and the VAPID keys).

Everyone signed in may subscribe their devices and send themselves a test. An
administrator writes to a group they administer, or to one of its members,
from the roster of that group (`group_views.py`): group administrators within
the groups they administer, platform admins anywhere (`/trappers` holds every
account). Members are named by their GUID, never by email.

A notification shows on a lock screen: it must not carry anything private.
Messages are limited per sender, and the text and results are kept for the
diagnostics (`deliveries`) and the audit trail.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotAuthenticated, NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from audit import recorder as audit
from hornet_finder_api import utils as keycloak
from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication
from hornet_finder_api.roles import APP_ROLES

from . import notification_kinds as kinds
from . import push
from . import trap_permissions as perms
from .group_views import GUID_PATTERN, _administered, _guid, _Roster
from .models import PushDelivery, PushNotification, PushSubscription, User

logger = logging.getLogger(__name__)

TEST_INTERVAL = timedelta(seconds=30)  # between two self-tests of the same user
DELIVERIES_SHOWN = 100


def _requester(request):
    user = perms.local_user(request)
    if user is None:
        raise NotAuthenticated()
    return user


def _require_enabled():
    if not push.enabled():
        return Response({'code': 'disabled', 'detail': "Les notifications ne sont pas activées sur ce serveur."},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return None


def _text(request, field: str, limit: int) -> str:
    value = request.data.get(field)
    value = value.strip() if isinstance(value, str) else ''
    if not value:
        raise ValidationError({field: "Ce champ est obligatoire."})
    if len(value) > limit:
        raise ValidationError({field: f"{limit} caractères au plus."})
    return value


def _subscription_row(subscription) -> dict:
    return {'id': subscription.id, 'device': subscription.device, 'installed': subscription.installed,
            'created_at': subscription.created_at, 'last_seen_at': subscription.last_seen_at,
            'endpoint': subscription.endpoint}


class PushViewSet(viewsets.GenericViewSet):

    def get_authenticators(self):
        # An acknowledgement carries no token: do not reject it for lacking one
        # (the action is set after the authenticators are built: read it from the method)
        action_name = self.action_map.get(self.request.method.lower())
        return [] if action_name == 'ack' else [JWTBearerAuthentication()]

    def get_permissions(self):
        if self.action == 'ack':
            return [AllowAny()]  # the service worker has no session: the delivery id is the credential
        return [HasAnyRole(APP_ROLES)]

    @extend_schema(responses={200: None})
    @action(detail=False, methods=['get'])
    def config(self, request):
        """Whether Web Push is on, the public VAPID key a browser subscribes with, and the kinds the platform holds back."""
        return Response({'enabled': push.enabled(), 'public_key': settings.VAPID_PUBLIC_KEY or None,
                         'paused_kinds': sorted(push.paused_kinds())})

    @extend_schema(responses={200: None})
    @action(detail=False, methods=['get'])
    def subscriptions(self, request):
        """The caller's own devices."""
        user = _requester(request)
        return Response([_subscription_row(s) for s in user.push_subscriptions.order_by('-created_at')])

    @extend_schema(request=None, responses={201: None})
    @subscriptions.mapping.post
    def subscribe(self, request):
        """
        Register the caller's browser: `endpoint`, `keys.p256dh`, `keys.auth` (the browser's
        `PushSubscription.toJSON()`), and `installed` (running as an installed app). An endpoint
        already known is handed to the caller, as the browser now belongs to them.
        """
        disabled = _require_enabled()
        if disabled:
            return disabled
        user = _requester(request)
        keys = request.data.get('keys') or {}
        endpoint, p256dh, auth = request.data.get('endpoint'), keys.get('p256dh'), keys.get('auth')
        if not all(isinstance(v, str) and v for v in (endpoint, p256dh, auth)):
            raise ValidationError({'detail': "Abonnement incomplet."})
        if not endpoint.startswith('https://') or len(endpoint) > 2000:
            raise ValidationError({'endpoint': "Adresse d'abonnement invalide."})
        device = push.device_label(request.META.get('HTTP_USER_AGENT', ''))
        subscription, created = PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={'user': user, 'p256dh': p256dh[:255], 'auth': auth[:255], 'device': device,
                      'installed': bool(request.data.get('installed')),
                      'last_seen_at': timezone.now()},
        )
        return Response(_subscription_row(subscription),
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @extend_schema(request=None, responses={204: None})
    @subscriptions.mapping.delete
    def unsubscribe(self, request):
        """Forget one of the caller's devices: `?endpoint=` (the browser's), or `?id=`."""
        user = _requester(request)
        found = user.push_subscriptions.all()
        if request.query_params.get('endpoint'):
            found = found.filter(endpoint=request.query_params['endpoint'])
        elif request.query_params.get('id', '').isdigit():
            found = found.filter(pk=request.query_params['id'])
        else:
            raise ValidationError({'detail': "Indiquez l'appareil à retirer."})
        found.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _send(self, notification, guids):
        devices = push.queue(notification, guids)
        transaction.on_commit(lambda: push.dispatch(notification))
        return devices

    @extend_schema(request=None, responses={202: None})
    @action(detail=False, methods=['post'])
    def test(self, request):
        """Send a notification to the caller's own devices, to check that they arrive."""
        disabled = _require_enabled()
        if disabled:
            return disabled
        user = _requester(request)
        now = timezone.now()
        recent = PushNotification.objects.filter(sender=user.guid, recipient=user.guid,
                                                 created_at__gt=now - TEST_INTERVAL).exists()
        if recent:
            return Response({'code': 'too_soon', 'detail': "Un essai vient de partir : patientez quelques secondes."},
                            status=status.HTTP_429_TOO_MANY_REQUESTS)
        with transaction.atomic():
            notification = PushNotification.objects.create(
                sender=user.guid, recipient=user.guid, kind=kinds.TEST, recipients_count=1,
                title='Velutina', body="Essai de notification : tout fonctionne.")
            devices = self._send(notification, [user.guid])
        if devices == 0:
            return Response({'code': 'no_device', 'detail': "Aucun appareil n'est abonné."},
                            status=status.HTTP_409_CONFLICT)
        return Response({'id': notification.id, 'devices': devices}, status=status.HTTP_202_ACCEPTED)

    @extend_schema(request=None, responses={202: None})
    @action(detail=False, methods=['post'])
    def send(self, request):
        """
        Notify the members of `group_path` (`title`, `body`), or only `guid` among them. Answers
        `recipients` (people addressed), `reached` (of those, with a device), `muted` (of those,
        who turned this kind of message off: `platform_message` from a platform admin,
        `group_message` otherwise) and `devices`.
        Errors carry a `code`: `rate_limited` (429), `no_recipient` (409), `disabled` and `paused` (503).
        """
        disabled = _require_enabled()
        if disabled:
            return disabled
        user = _requester(request)
        group_path = (request.data.get('group_path') or '').strip()
        group = _administered(request, group_path)
        # A platform admin writes as the platform, wherever they write
        kind = kinds.PLATFORM_MESSAGE if perms.is_platform_admin(request.user) else kinds.GROUP_MESSAGE
        if kind in push.paused_kinds():
            return Response({'code': 'paused', 'detail': "Les administrateurs de la plateforme ont suspendu ces messages."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        title = _text(request, 'title', PushNotification.TITLE_MAX)
        body = _text(request, 'body', PushNotification.BODY_MAX)

        roster = _Roster(group_path, group)
        guid = request.data.get('guid')
        if guid:
            guid = _guid(str(guid))
            if guid not in roster:
                raise NotFound("Cette personne n'est pas membre de ce groupe.")
            recipients = {guid}
        else:
            recipients = set(roster.users)
        recipients.discard(str(user.guid))  # one does not notify oneself (see `test`)
        if not recipients:
            return Response({'code': 'no_recipient', 'detail': "Personne d'autre à notifier dans ce groupe."},
                            status=status.HTTP_409_CONFLICT)

        now = timezone.now()
        sent = PushNotification.objects.filter(sender=user.guid, created_at__gt=now - timedelta(hours=1)).count()
        if sent >= PushNotification.HOURLY_LIMIT:
            return Response(
                {'code': 'rate_limited',
                 'detail': f"{PushNotification.HOURLY_LIMIT} notifications par heure au plus : réessayez plus tard."},
                status=status.HTTP_429_TOO_MANY_REQUESTS)

        muted = {str(u.guid) for u in User.objects.filter(guid__in=recipients) if not kinds.wants(u, kind)}

        with transaction.atomic():
            notification = PushNotification.objects.create(
                sender=user.guid, kind=kind, group_path=group_path, recipient=guid or None, title=title,
                body=body, recipients_count=len(recipients))
            devices = self._send(notification, recipients - muted)
            reached = PushDelivery.objects.filter(notification=notification).values('user').distinct().count()
            audit.record(request, 'notification.sent', ('group', group_path),
                         label=keycloak.group_display_name(group),
                         changes={'title': title, 'kind': kind, 'recipients': len(recipients),
                                  'muted': len(muted), 'devices': devices},
                         refs=[audit.ref('user', guid)] if guid else [])
        logger.info("Notification %s sent to %s people (%s devices) of %s by %s",
                    notification.id, len(recipients), devices, group_path, user.guid)
        return Response({'id': notification.id, 'recipients': len(recipients), 'reached': reached,
                         'muted': len(muted), 'devices': devices}, status=status.HTTP_202_ACCEPTED)

    def _preferences(self, user) -> Response:
        return Response({'kinds': [{'id': kind, 'label': label, 'enabled': kinds.wants(user, kind)}
                                   for kind, label in kinds.KINDS.items() if kinds.concerns(user, kind)]})

    @extend_schema(responses={200: None})
    @action(detail=False, methods=['get'])
    def preferences(self, request):
        """The kinds of notifications and whether the caller receives each (every device)."""
        return self._preferences(_requester(request))

    @extend_schema(request=None, responses={200: None})
    @preferences.mapping.put
    def set_preferences(self, request):
        """Turn kinds on or off: `{"trap_reading": false, ...}`; kinds left out keep their setting."""
        user = _requester(request)
        if not isinstance(request.data, dict):
            raise ValidationError({'detail': "Objet attendu."})
        for kind, enabled in request.data.items():
            if kind not in kinds.KINDS or not isinstance(enabled, bool):
                raise ValidationError({kind: "Sorte de notification inconnue, ou valeur non booléenne."})
        for kind, enabled in request.data.items():
            kinds.choose(user, kind, enabled)  # only what differs from the default is stored
        user.save(update_fields=['notification_prefs'])
        return self._preferences(user)

    @extend_schema(request=None, responses={204: None})
    @action(detail=False, methods=['post'], url_path=f'ack/(?P<delivery_id>{GUID_PATTERN})')
    def ack(self, request, delivery_id=None):
        """
        The device tells its service worker showed the message (the id is in the payload).
        Only the first acknowledgement counts; an unknown id is ignored.
        """
        PushDelivery.objects.filter(pk=delivery_id, received_at__isnull=True).update(received_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(responses={200: None})
    @action(detail=False, methods=['get'])
    def deliveries(self, request):
        """
        Platform admins: the last deliveries with the push service's answer and the delay until
        the device acknowledged, to compare platforms.
        """
        if not perms.is_platform_admin(request.user):
            raise PermissionDenied("Réservé aux administrateurs de la plateforme.")
        rows = PushDelivery.objects.select_related('notification').order_by('-notification__created_at', 'device')
        result = []
        for delivery in rows[:DELIVERIES_SHOWN]:
            sent_at, received_at = delivery.sent_at, delivery.received_at
            result.append({
                'id': delivery.id,
                'notification': delivery.notification_id,
                'title': delivery.notification.title,
                'kind': delivery.notification.kind,
                'created_at': delivery.notification.created_at,
                'device': delivery.device,
                'installed': delivery.installed,
                'status': delivery.status,
                'error': delivery.error,
                'seconds_to_receive': (round((received_at - sent_at).total_seconds(), 1)
                                       if sent_at and received_at else None),
            })
        return Response(result)
