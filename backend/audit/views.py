"""
Reading the audit trail: platform admins only, read-only.

Names of the actors are resolved from Keycloak when the trail is read (and
cached a few minutes), never stored with the events.
"""

import csv
import datetime
import json
import uuid

from django.conf import settings
from django.core.cache import cache
from django.db.models import TextField
from django.db.models.functions import Cast
from django.http import StreamingHttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import CursorPagination
from rest_framework.response import Response

from hornet_finder_api import utils as keycloak
from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication
from hornet_finder_api.roles import ADMIN

from . import recorder
from .actions import ACTIONS, DOMAINS, domain_of
from .models import AuditEvent

NAME_CACHE_SECONDS = 600
MAX_EXPORT_ROWS = 50_000


def actor_names(guids) -> dict:
    """`{guid: {'name', 'deleted'}}`, from the cache or Keycloak."""
    keys = {str(guid) for guid in guids if guid}
    cached = cache.get_many([f"audit:actor:{key}" for key in keys])
    result = {key.rsplit(':', 1)[1]: value for key, value in cached.items()}
    missing = [key for key in keys if key not in result]
    if missing:
        found = keycloak.describe_users(missing)
        cache.set_many({f"audit:actor:{key}": value for key, value in found.items()
                        if value['name'] or value['deleted']}, NAME_CACHE_SECONDS)
        result.update(found)
    return result


class AuditEventSerializer(serializers.ModelSerializer):
    domain = serializers.SerializerMethodField()
    actor_name = serializers.SerializerMethodField()
    actor_deleted = serializers.SerializerMethodField()

    class Meta:
        model = AuditEvent
        fields = ['id', 'occurred_at', 'action', 'domain', 'actor', 'actor_name', 'actor_deleted',
                  'actor_roles', 'source', 'target_type', 'target_id', 'target_label', 'refs', 'changes',
                  'request_id']

    def get_domain(self, event):
        return domain_of(event.action)

    def _actor(self, event):
        return self.context.get('names', {}).get(str(event.actor), {}) if event.actor else {}

    def get_actor_name(self, event):
        return self._actor(event).get('name')

    def get_actor_deleted(self, event):
        return bool(self._actor(event).get('deleted'))


class AuditPagination(CursorPagination):
    ordering = ('-occurred_at', '-id')
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


def _split(value):
    return [item.strip() for item in (value or '').split(',') if item.strip()]


def _moment(value, name, end_of_day=False):
    """A date (whole day, Brussels time) or an ISO date-time."""
    try:
        day = parse_date(value)
        moment = None if day else parse_datetime(value)
    except ValueError:
        day = moment = None
    if day is not None:
        if end_of_day:
            day += datetime.timedelta(days=1)
        moment = datetime.datetime.combine(day, datetime.time.min)
    if moment is None:
        raise ValidationError({name: "Expected YYYY-MM-DD or an ISO 8601 date-time."})
    if timezone.is_naive(moment):
        moment = timezone.make_aware(moment)
    return moment


FILTER_PARAMETERS = [
    OpenApiParameter('since', OpenApiTypes.STR, description="From this date (YYYY-MM-DD) or date-time"),
    OpenApiParameter('until', OpenApiTypes.STR, description="Up to this date included, or date-time excluded"),
    OpenApiParameter('actor', OpenApiTypes.STR, description="Actor GUIDs, comma-separated"),
    OpenApiParameter('action', OpenApiTypes.STR, description="Action codes, comma-separated"),
    OpenApiParameter('domain', OpenApiTypes.STR, description="Domains (nest, trap, …), comma-separated"),
    OpenApiParameter('ref', OpenApiTypes.STR,
                     description="Objects concerned, e.g. `trap:42` (comma-separated: all of them)"),
    OpenApiParameter('source', OpenApiTypes.STR, enum=[c[0] for c in AuditEvent.SOURCE_CHOICES]),
    OpenApiParameter('q', OpenApiTypes.STR, description="Text searched in the details of the events"),
]


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    """The audit trail, newest first. Platform admins only."""

    queryset = AuditEvent.objects.all()
    serializer_class = AuditEventSerializer
    pagination_class = AuditPagination

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        return [HasAnyRole([ADMIN])]

    def filter_queryset(self, queryset):
        params = self.request.query_params
        if params.get('since'):
            queryset = queryset.filter(occurred_at__gte=_moment(params['since'], 'since'))
        if params.get('until'):
            queryset = queryset.filter(occurred_at__lt=_moment(params['until'], 'until', end_of_day=True))
        actors = _split(params.get('actor'))
        if actors:
            try:
                actors = [uuid.UUID(actor) for actor in actors]
            except ValueError:
                raise ValidationError({'actor': "Expected GUIDs."})
            queryset = queryset.filter(actor__in=actors)
        actions = _split(params.get('action'))
        if actions:
            queryset = queryset.filter(action__in=actions)
        domains = _split(params.get('domain'))
        if domains:
            codes = [code for code in ACTIONS if domain_of(code) in domains]
            queryset = queryset.filter(action__in=codes)
        refs = _split(params.get('ref'))
        if refs:
            queryset = queryset.filter(refs__contains=refs)
        if params.get('source'):
            queryset = queryset.filter(source=params['source'])
        text = params.get('q', '').strip()
        if text:
            queryset = queryset.annotate(changes_text=Cast('changes', TextField())).filter(
                changes_text__icontains=text)
        return queryset

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'names': getattr(self, '_names', {})}

    def _with_names(self, events):
        self._names = actor_names({event.actor for event in events})
        return events

    @extend_schema(parameters=FILTER_PARAMETERS + [
        OpenApiParameter('cursor', OpenApiTypes.STR), OpenApiParameter('page_size', OpenApiTypes.INT)])
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self._with_names(self.paginate_queryset(queryset))
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        event = self.get_object()
        self._with_names([event])
        return Response(self.get_serializer(event).data)

    @extend_schema(responses={200: OpenApiResponse(
        description="Action codes with their domain, domains, sources and retention")})
    @action(detail=False, methods=['get'])
    def catalogue(self, request):
        return Response({
            'actions': [{'code': code, 'domain': domain_of(code), 'description': text}
                        for code, text in ACTIONS.items()],
            'domains': DOMAINS,
            'sources': [code for code, _ in AuditEvent.SOURCE_CHOICES],
            'retention_days': settings.AUDIT_RETENTION_DAYS,
        })

    @extend_schema(parameters=[OpenApiParameter('q', OpenApiTypes.STR, required=True)],
                   responses={200: OpenApiResponse(description="`[{guid, name}]`, at most 10")})
    @action(detail=False, methods=['get'])
    def actors(self, request):
        """Accounts matching `q` (name or email), to filter on an actor."""
        query = request.query_params.get('q', '').strip()
        if len(query) < 2:
            return Response([])
        try:
            return Response(keycloak.search_users(query))
        except Exception:
            return Response({'detail': "Keycloak is unavailable."}, status=503)

    @extend_schema(parameters=FILTER_PARAMETERS,
                   responses={200: OpenApiResponse(description="CSV file of the filtered events")})
    @action(detail=False, methods=['get'])
    def export(self, request):
        """The filtered events as CSV (UTF-8 with BOM, `;`), at most 50 000 rows. Recorded itself."""
        queryset = self.filter_queryset(self.get_queryset())[:MAX_EXPORT_ROWS]
        events = list(queryset)
        names = actor_names({event.actor for event in events})
        recorder.record(request, 'audit.exported', ('audit', None), changes={
            'filters': {key: value for key, value in request.query_params.items()}, 'rows': len(events),
        })

        def rows():
            yield '﻿'
            buffer = _Line()
            writer = csv.writer(buffer, delimiter=';')
            writer.writerow(['occurred_at', 'action', 'actor', 'actor_name', 'actor_roles', 'source',
                             'target_type', 'target_id', 'target_label', 'refs', 'changes'])
            yield buffer.pop()
            for event in events:
                actor = names.get(str(event.actor), {}) if event.actor else {}
                writer.writerow([
                    timezone.localtime(event.occurred_at).isoformat(), event.action,
                    event.actor or '', actor.get('name') or '', ' '.join(event.actor_roles),
                    event.source, event.target_type, event.target_id, event.target_label,
                    ' '.join(event.refs),
                    json.dumps(event.changes, ensure_ascii=False),
                ])
                yield buffer.pop()

        stamp = timezone.localtime().strftime('%Y%m%d-%H%M')
        response = StreamingHttpResponse(rows(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="audit-{stamp}.csv"'
        response['Cache-Control'] = 'private, no-store'
        return response


class _Line:
    """A file-like sink for `csv.writer`, emptied after each row."""

    def __init__(self):
        self.parts = []

    def write(self, text):
        self.parts.append(text)

    def pop(self):
        text, self.parts = ''.join(self.parts), []
        return text
