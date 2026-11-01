"""
API of the colonies. A colony has the rights of the hive it lives in (or
lived in last): see `permissions.py`. What a hive holds: `colony_rules.py`.
"""

import uuid

from django.db import transaction
from django.db.models import Prefetch
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from audit import recorder as audit
from hornet.models import ApiaryGroupPermission
from hornet.trap_permissions import local_user
from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication

from . import colony_rules as rules
from . import permissions as perms
from .models import Colony, ColonyOccupancy, Hive
from .serializers import ColonySerializer
from .views import _DAY_PARAM, _day

QUEEN_SIDES = ('parent', 'daughter', 'unknown')


def _uuid(value, field):
    if value in (None, ''):
        return None
    try:
        return uuid.UUID(str(value))
    except ValueError:
        raise ValidationError({field: "Expected an identifier."})


def _count(value, field='bars'):
    """A number of bars (or boxes) sent by the client; None when not counted."""
    if value in (None, ''):
        return None
    try:
        count = int(value)
    except (TypeError, ValueError):
        raise ValidationError({field: "Expected a number."})
    if count < 0:
        raise ValidationError({field: "Expected a positive number."})
    return count


def _compartment(value):
    try:
        return int(value or 1)
    except (TypeError, ValueError):
        raise ValidationError({'compartment': "A compartment is 1 or 2."})


def _colony_refs(colony) -> list:
    refs = [audit.ref('hive', colony.hive_id)]
    if colony.hive.apiary_id:
        refs.append(audit.ref('apiary', colony.hive.apiary_id))
    return refs


_COLONY_ACTION = {'type': 'object'}


class ColonyViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin,
                    mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """
    Colonies of the hives. Born from a division, from what stays after a
    swarm, a caught swarm or a bought package, they move between hives and end;
    each stay in a hive compartment is kept as a dated period (`occupancies`).
    """

    serializer_class = ColonySerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        return [HasAnyRole(['beekeeper', 'admin'])]

    def get_queryset(self):
        return Colony.objects.select_related(
            'hive', 'hive__hive_type', 'hive__apiary', 'hive__owner_group', 'parent', 'merged_into',
        ).prefetch_related(
            Prefetch('hive__apiary__apiarygrouppermission_set',
                     queryset=ApiaryGroupPermission.objects.select_related('group')),
            Prefetch('occupancies', queryset=ColonyOccupancy.objects.filter(ended_on__isnull=True),
                     to_attr='open_stays'),
        )

    def get_object(self):
        pk = _uuid(self.kwargs['pk'], 'id')
        colony = self.get_queryset().filter(pk=pk).first()
        if colony is None or not perms.can_read_hive(self.request, colony.hive):
            raise NotFound()
        return colony

    def _fresh(self, colony, status_code=status.HTTP_200_OK):
        colony = self.get_queryset().get(pk=colony.pk)
        context = {**self.get_serializer_context(), 'with_history': True}
        return Response(ColonySerializer(colony, context=context).data, status=status_code)

    def _hive(self, hive_id, field='hive'):
        """A hive the requester tends, to put a colony in."""
        pk = _uuid(hive_id, field)
        if pk is None:
            raise ValidationError({field: "This field is required."})
        hive = Hive.objects.select_related('hive_type', 'owner_group', 'apiary').filter(pk=pk).first()
        if hive is None or not perms.can_read_hive(self.request, hive):
            raise ValidationError({field: "Unknown hive."})
        if not perms.can_tend_hive(self.request, hive):
            raise PermissionDenied("You cannot put a colony in this hive.")
        if hive.status != Hive.STATUS_ACTIVE:
            # A colony lives in an apiary: a stored hive is put in one first
            raise ValidationError({field: "This hive is not in service."})
        return hive

    def _tend(self, colony):
        if not perms.can_tend_hive(self.request, colony.hive):
            raise PermissionDenied("You cannot act on this colony.")
        if not colony.active:
            raise ValidationError({'ended_on': "This colony has ended."})

    @staticmethod
    def _exists(pk):
        return pk is not None and Colony.objects.filter(pk=pk).exists()

    # -- reading -------------------------------------------------------------

    @extend_schema(parameters=[
        OpenApiParameter(name='hive', type=OpenApiTypes.UUID, location=OpenApiParameter.QUERY,
                         required=False, description='Only the colonies of this hive (living there, or last)'),
        OpenApiParameter(name='status', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY,
                         required=False, description="'active' (default), 'ended' or 'all'"),
    ])
    def list(self, request, *args, **kwargs):
        """The colonies the requester may see, newest first."""
        readable = Hive.objects.filter(perms.readable_hives_q(request)).values('pk')
        queryset = self.get_queryset().filter(hive__in=readable)
        hive = _uuid(request.query_params.get('hive'), 'hive')
        if hive is not None:
            queryset = queryset.filter(hive_id=hive)
        state = request.query_params.get('status', 'active')
        if state == 'active':
            queryset = queryset.filter(ended_on__isnull=True)
        elif state == 'ended':
            queryset = queryset.filter(ended_on__isnull=False)
        elif state != 'all':
            raise ValidationError({'status': "Expected 'active', 'ended' or 'all'."})
        return Response(self.get_serializer(queryset, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return self._fresh(self.get_object())

    # -- writing -------------------------------------------------------------

    @extend_schema(
        request={'application/json': {'type': 'object', 'properties': {
            'id': {'type': 'string', 'format': 'uuid'}, 'hive': {'type': 'string', 'format': 'uuid'},
            'compartment': {'type': 'integer'}, 'name': {'type': 'string'},
            'origin': {'type': 'string', 'enum': ['swarm_caught', 'package', 'unknown']},
            'bars': {'type': 'integer'}, 'started_on': _DAY_PARAM, 'comments': {'type': 'string'},
        }, 'required': ['hive']}},
        responses={201: ColonySerializer, 200: ColonySerializer},
    )
    def create(self, request, *args, **kwargs):
        """
        A colony put in a hive: a caught swarm, a bought package, or one whose
        origin is not known. Divisions and swarms come from their own actions.
        Sent again with the same `id`, it is not created twice.
        """
        client_id = _uuid(request.data.get('id'), 'id')
        if client_id is not None:
            existing = self.get_queryset().filter(pk=client_id).first()
            if existing is not None:
                if not perms.can_read_hive(request, existing.hive):
                    raise ValidationError({'id': "This identifier is already used."})
                return self._fresh(existing)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        origin = serializer.validated_data.get('origin', Colony.ORIGIN_UNKNOWN)
        if origin in (Colony.ORIGIN_DIVISION, Colony.ORIGIN_SWARM_PARENT):
            raise ValidationError({'origin': "A division or a swarm is recorded from its parent colony."})
        hive = self._hive(request.data.get('hive'))
        compartment = _compartment(request.data.get('compartment'))
        bars = serializer.validated_data.get('bars')
        day = _day(request.data.get('started_on'), 'started_on')
        with transaction.atomic():
            rules.check_place(hive, compartment, bars)
            colony = Colony(**{**serializer.validated_data, 'started_on': day, 'requeening_since': None},
                            created_by=local_user(request))
            rules.install(colony, hive, compartment, day)
            audit.record(request, 'colony.created', colony, changes=audit.snapshot(colony))
        return self._fresh(colony, status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        colony = self.get_object()
        if not perms.can_tend_hive(request, colony.hive):
            raise PermissionDenied("You cannot edit this colony.")
        serializer = self.get_serializer(colony, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if 'origin' in serializer.validated_data and serializer.validated_data['origin'] != colony.origin:
            # Its lineage would no longer say how it was born
            raise ValidationError({'origin': "The origin of a colony does not change."})
        with audit.track(request, 'colony.updated', colony) as tracked:
            if 'bars' in serializer.validated_data and colony.active:
                rules.check_place(colony.hive, colony.compartment, serializer.validated_data['bars'],
                                  exclude=[colony])
            serializer.save()
            tracked.refs = _colony_refs(colony)
        return self._fresh(colony)

    def destroy(self, request, *args, **kwargs):
        colony = self.get_object()
        if not perms.can_manage_hive(request, colony.hive):
            raise PermissionDenied("You cannot delete this colony.")
        with transaction.atomic():
            changes, refs, label, pk = audit.snapshot(colony), _colony_refs(colony), audit.label_of(colony), colony.pk
            colony.delete()
            audit.record(request, 'colony.deleted', ('colony', pk), changes=changes, label=label, refs=refs)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # -- life of a colony ----------------------------------------------------

    @extend_schema(
        request={'application/json': {'type': 'object', 'properties': {
            'on': _DAY_PARAM, 'daughter_id': {'type': 'string', 'format': 'uuid'},
            'hive': {'type': 'string', 'format': 'uuid', 'description': 'Default: the same hive'},
            'compartment': {'type': 'integer'}, 'name': {'type': 'string'},
            'bars': {'type': 'integer', 'description': 'Bars taken from the parent'},
            'divider_bar': {'type': 'integer', 'description': 'Divider put for the occasion'},
            'queen': {'type': 'string', 'enum': ['parent', 'daughter', 'unknown'],
                      'description': 'The part that keeps the queen; the other raises a new one'},
        }}},
        responses={200: ColonySerializer},
    )
    @action(detail=True, methods=['post'])
    def split(self, request, pk=None):
        """
        Divide the colony: a daughter colony goes to the other compartment of
        the hive (putting the divider if needed) or to another hive, with the
        bars taken from the parent. The part without the queen raises a new one.
        """
        parent = self.get_object()
        daughter_id = _uuid(request.data.get('daughter_id'), 'daughter_id')
        if self._exists(daughter_id):
            return self._fresh(parent)
        self._tend(parent)
        day = _day(request.data.get('on'))
        target = self._hive(request.data['hive']) if request.data.get('hive') else parent.hive
        same_hive = target.pk == parent.hive_id
        compartment = _compartment(request.data.get('compartment') or (3 - parent.compartment if same_hive else 1))
        bars = _count(request.data.get('bars'))
        queen = request.data.get('queen') or 'unknown'
        if queen not in QUEEN_SIDES:
            raise ValidationError({'queen': f"Expected one of {', '.join(QUEEN_SIDES)}."})
        divider = _count(request.data.get('divider_bar'), 'divider_bar')
        if day < parent.started_on:
            raise ValidationError({'on': "Before the colony started."})

        with transaction.atomic():
            moved = bars if (bars is not None and parent.bars is not None
                             and rules.bars_after_transfer(parent.hive, target, bars) is not None) else None
            if moved is not None:
                if moved > parent.bars:
                    raise ValidationError({'bars': f"The colony has {parent.bars} bars."})
                parent.bars -= moved
                parent.save(update_fields=['bars', 'updated_at'])
            if same_hive and divider is not None and divider != target.divider_bar:
                with audit.track(request, 'hive.divider_changed', target, fields=['divider_bar']):
                    rules.check_divider(target, divider)
                    target.divider_bar = divider
                    target.save(update_fields=['divider_bar', 'updated_at'])
            rules.check_place(target, compartment, bars)
            daughter = Colony(
                **({'pk': daughter_id} if daughter_id else {}),
                name=(request.data.get('name') or '').strip(), origin=Colony.ORIGIN_DIVISION, parent=parent,
                bars=bars, started_on=day, created_by=local_user(request),
                requeening_since=day if queen == 'parent' else None,
            )
            rules.install(daughter, target, compartment, day)
            if queen == 'daughter':
                parent.requeening_since = day
                parent.laying_since = None
                parent.save(update_fields=['requeening_since', 'laying_since', 'updated_at'])
            audit.record(request, 'colony.split', parent, changes={
                'on': day.isoformat(), 'daughter': str(daughter.pk), 'hive': str(target.pk),
                'compartment': compartment, 'bars': bars, 'queen': queen,
            }, refs=_colony_refs(parent) + [audit.ref('colony', daughter.pk), audit.ref('hive', target.pk)])
        return self._fresh(parent)

    @extend_schema(
        request={'application/json': {'type': 'object', 'properties': {
            'on': _DAY_PARAM, 'stayed_id': {'type': 'string', 'format': 'uuid'},
            'caught': {'type': 'object', 'description': 'The swarm, when it was caught: '
                       '{id, hive, compartment, name, bars}'},
        }}},
        responses={200: ColonySerializer},
    )
    @action(detail=True, methods=['post'])
    def swarm(self, request, pk=None):
        """
        The colony swarmed: it leaves with its queen. What stays is a new
        colony in its place, raising a new queen; the swarm, when caught, is a
        new colony too. Both descend from the one that swarmed. Answers with
        the colony that stayed.
        """
        swarmed = self.get_object()
        stayed_id = _uuid(request.data.get('stayed_id'), 'stayed_id')
        if self._exists(stayed_id):
            return self._fresh(Colony.objects.get(pk=stayed_id))
        self._tend(swarmed)
        day = _day(request.data.get('on'))
        caught = request.data.get('caught') or None
        if caught is not None and not isinstance(caught, dict):
            raise ValidationError({'caught': "Expected the hive the swarm was put in."})
        hive, compartment, bars = swarmed.hive, swarmed.compartment, swarmed.bars

        with transaction.atomic():
            rules.end(swarmed, day, Colony.END_SWARMED)
            stayed = Colony(**({'pk': stayed_id} if stayed_id else {}),
                            name=swarmed.name, origin=Colony.ORIGIN_SWARM_PARENT, parent=swarmed, bars=bars,
                            started_on=day, requeening_since=day, created_by=local_user(request))
            rules.install(stayed, hive, compartment, day)
            refs = _colony_refs(swarmed) + [audit.ref('colony', stayed.pk)]
            changes = {'on': day.isoformat(), 'stayed': str(stayed.pk), 'caught': None}
            if caught is not None:
                target = self._hive(caught.get('hive'), 'caught')
                caught_bars = _count(caught.get('bars'))
                caught_compartment = _compartment(caught.get('compartment'))
                rules.check_place(target, caught_compartment, caught_bars, field='caught')
                swarm = Colony(**({'pk': _uuid(caught.get('id'), 'caught')} if caught.get('id') else {}),
                               name=(caught.get('name') or '').strip(), origin=Colony.ORIGIN_SWARM_CAUGHT,
                               parent=swarmed, bars=caught_bars, started_on=day,
                               created_by=local_user(request))
                rules.install(swarm, target, caught_compartment, day)
                changes['caught'] = str(swarm.pk)
                refs += [audit.ref('colony', swarm.pk), audit.ref('hive', target.pk)]
            audit.record(request, 'colony.swarmed', swarmed, changes=changes, refs=refs)
        return self._fresh(stayed)

    @extend_schema(
        request={'application/json': {'type': 'object', 'properties': {
            'on': _DAY_PARAM, 'hive': {'type': 'string', 'format': 'uuid'},
            'compartment': {'type': 'integer'}, 'bars': {'type': 'integer'},
        }, 'required': ['hive']}},
        responses={200: ColonySerializer},
    )
    @action(detail=True, methods=['post'])
    def transfer(self, request, pk=None):
        """
        Move the colony to another hive or compartment: from a nucleus to a
        TBH, out of a log hive... Its bars follow it within the same family of
        bars; otherwise they are counted again (`bars`).
        """
        colony = self.get_object()
        self._tend(colony)
        day = _day(request.data.get('on'))
        target = self._hive(request.data.get('hive'))
        compartment = _compartment(request.data.get('compartment'))
        if target.pk == colony.hive_id and compartment == colony.compartment:
            raise ValidationError({'hive': "The colony already lives there."})
        sent = request.data.get('bars')
        bars = _count(sent) if sent not in (None, '') else rules.bars_after_transfer(colony.hive, target, colony.bars)
        previous = colony.hive
        with audit.track(request, 'colony.transferred', colony, fields=['hive', 'compartment', 'bars']) as tracked:
            rules.check_place(target, compartment, bars, exclude=[colony])
            colony.bars = bars
            rules.relocate(colony, target, compartment, day)
            tracked.extra = {'on': day.isoformat()}
            tracked.refs = [audit.ref('hive', previous.pk), audit.ref('hive', target.pk)]
            if target.apiary_id:
                tracked.refs.append(audit.ref('apiary', target.apiary_id))
        return self._fresh(colony)

    @extend_schema(
        request={'application/json': {'type': 'object', 'properties': {
            'on': _DAY_PARAM,
            'cause': {'type': 'string', 'enum': ['died', 'merged', 'absconded', 'unknown']},
            'merged_into': {'type': 'string', 'format': 'uuid'},
        }, 'required': ['cause']}},
        responses={200: ColonySerializer},
    )
    @action(detail=True, methods=['post'])
    def end(self, request, pk=None):
        """The colony died, absconded, or was merged into another one (a swarm is recorded with `swarm`)."""
        colony = self.get_object()
        self._tend(colony)
        cause = request.data.get('cause')
        if cause not in (Colony.END_DIED, Colony.END_MERGED, Colony.END_ABSCONDED, Colony.END_UNKNOWN):
            raise ValidationError({'cause': "Expected died, merged, absconded or unknown."})
        merged_into = None
        if cause == Colony.END_MERGED:
            target_id = _uuid(request.data.get('merged_into'), 'merged_into')
            merged_into = self.get_queryset().filter(pk=target_id, ended_on__isnull=True).first() if target_id else None
            if merged_into is None or merged_into.pk == colony.pk or not perms.can_tend_hive(request, merged_into.hive):
                raise ValidationError({'merged_into': "Expected a living colony you tend."})
        day = _day(request.data.get('on'))
        with audit.track(request, 'colony.ended', colony,
                         fields=['ended_on', 'end_cause', 'merged_into']) as tracked:
            rules.end(colony, day, cause, merged_into)
            tracked.refs = _colony_refs(colony) + ([audit.ref('colony', merged_into.pk)] if merged_into else [])
        return self._fresh(colony)

    @extend_schema(request={'application/json': {'type': 'object', 'properties': {'on': _DAY_PARAM}}},
                   responses={200: ColonySerializer})
    @action(detail=True, methods=['post'])
    def laying(self, request, pk=None):
        """The new queen was seen laying (eggs): the end of the brood break."""
        colony = self.get_object()
        self._tend(colony)
        if colony.requeening_since is None:
            raise ValidationError({'laying_since': "This colony is not raising a queen."})
        day = _day(request.data.get('on'))
        if day < colony.requeening_since:
            raise ValidationError({'on': "Before the colony started raising a queen."})
        with audit.track(request, 'colony.laying', colony, fields=['laying_since']) as tracked:
            colony.laying_since = day
            colony.save(update_fields=['laying_since', 'updated_at'])
            tracked.refs = _colony_refs(colony)
        return self._fresh(colony)
