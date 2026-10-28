"""
Dashboard of the platform admins: the state of the notifications and of the
scheduler, and the switches that hold back kinds of notifications for everyone
(`PlatformSettings.paused_kinds`). The senders honour them (`push.paused_kinds`).
Reserved to platform admins.
"""

import statistics
from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotAuthenticated, ValidationError
from rest_framework.response import Response

from audit import recorder as audit
from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication
from hornet_finder_api.roles import ADMIN

from . import notification_kinds as kinds
from . import push
from . import trap_permissions as perms
from .models import NestEvent, PlatformSettings, PushDelivery, PushNotification, PushSubscription, User
from .nest_alerts import EXPIRY

# The scheduler passes every 10 minutes: three missed passes mean it is down
SCHEDULER_STALE = timedelta(minutes=30)
WINDOWS = {'day': timedelta(hours=24), 'week': timedelta(days=7)}


def _notifications(row: PlatformSettings) -> dict:
    return {
        'configured': push.enabled(),
        'kinds': [{'id': kind, 'label': label, 'paused': kind in row.paused_kinds}
                  for kind, label in kinds.KINDS.items()],
        'updated_at': row.updated_at,
        'updated_by': row.updated_by,
    }


def _deliveries(since) -> dict:
    """What happened to the messages created since `since`, device by device."""
    rows = PushDelivery.objects.filter(notification__created_at__gte=since)
    known = [201, *push.GONE, push.STATUS_PAUSED]
    result = rows.aggregate(
        deliveries=Count('id'),
        accepted=Count('id', filter=Q(status=201)),
        gone=Count('id', filter=Q(status__in=push.GONE)),
        paused=Count('id', filter=Q(status=push.STATUS_PAUSED)),
        failed=Count('id', filter=Q(status__isnull=False) & ~Q(status__in=known)),
        waiting=Count('id', filter=Q(status__isnull=True)),
        shown=Count('id', filter=Q(received_at__isnull=False)),
    )
    delays = sorted((received - sent).total_seconds() for sent, received in rows.filter(
        sent_at__isnull=False, received_at__isnull=False).values_list('sent_at', 'received_at'))
    result['notifications'] = PushNotification.objects.filter(created_at__gte=since).count()
    result['median_seconds'] = round(statistics.median(delays), 1) if delays else None
    return result


class PlatformViewSet(viewsets.GenericViewSet):

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        return [HasAnyRole([ADMIN])]

    @extend_schema(responses={200: None})
    def list(self, request):
        """The dashboard: notification switches, devices, deliveries, scheduler, what waits."""
        now = timezone.now()
        row = PlatformSettings.load()
        seen = row.scheduler_seen_at
        by_device = (PushSubscription.objects.values('device').annotate(count=Count('id')).order_by('-count', 'device'))
        return Response({
            'notifications': _notifications(row),
            'devices': {
                'total': PushSubscription.objects.count(),
                'people': PushSubscription.objects.values('user').distinct().count(),
                'users': User.objects.count(),
                'by_device': list(by_device),
            },
            'deliveries': {name: _deliveries(now - span) for name, span in WINDOWS.items()},
            'scheduler': {
                'last_pass_at': seen,
                'ok': bool(seen and now - seen <= SCHEDULER_STALE),
                'stale_after_minutes': int(SCHEDULER_STALE.total_seconds() // 60),
            },
            'waiting': {
                # Nest events not told yet and not expired: a pause or the next sending hours
                'nest_events': NestEvent.objects.filter(alerted_at__isnull=True, created_at__gte=now - EXPIRY).count(),
            },
        })

    @extend_schema(request=None, responses={200: None})
    @action(detail=False, methods=['put'])
    def notifications(self, request):
        """
        Set the kinds of notifications held back for everyone: `{"paused": ["trap_reading", ...]}`,
        the complete list (empty: nothing is held back). Answers the `notifications` block of the dashboard.
        """
        user = perms.local_user(request)
        if user is None:
            raise NotAuthenticated()
        paused = request.data.get('paused') if isinstance(request.data, dict) else None
        if not isinstance(paused, list) or any(kind not in kinds.KINDS for kind in paused):
            raise ValidationError({'paused': "Liste de sortes de notification attendue."})
        after = [kind for kind in kinds.KINDS if kind in paused]  # canonical order, no duplicate
        with transaction.atomic():
            row = PlatformSettings.objects.select_for_update().get_or_create(pk=1)[0]
            before = list(row.paused_kinds)
            if before != after:
                row.paused_kinds = after
                row.updated_at = timezone.now()
                row.updated_by = user.guid
                row.save(update_fields=['paused_kinds', 'updated_at', 'updated_by'])
                audit.record(request, 'platform.notifications_changed', ('platform', 'notifications'),
                             label='Notifications',
                             changes={'paused': [kind for kind in after if kind not in before],
                                      'resumed': [kind for kind in before if kind not in after]})
        return Response(_notifications(row))
