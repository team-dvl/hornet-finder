"""API of the hives and of their types. Access rules: `permissions.py`."""

import datetime
import uuid

from django.db import transaction
from django.db.models import Count, Prefetch, ProtectedError, Q
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from audit import recorder as audit
from hornet.apiary_permissions import READ as APIARY_READ, has_apiary_permission
from hornet.group_views import _Roster, _full_name
from hornet.invitation_views import _keycloak, _sort_key
from hornet.models import Apiary, ApiaryGroupPermission, User
from hornet.trap_permissions import is_beekeeper_group, local_user
from hornet.trap_views import ReferentialViewSet, _group_choices, _group_for_path
from hornet_finder_api import utils as keycloak
from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication

from . import permissions as perms
from .models import Hive, HiveCustody, HivePlacement, HiveType
from .serializers import HiveSerializer, HiveTypeSerializer


class HiveTypeViewSet(ReferentialViewSet):
    """Hive types: read by everyone signed in, written by platform admins."""

    serializer_class = HiveTypeSerializer
    queryset = HiveType.objects.all()

    def get_queryset(self):
        return HiveType.objects.annotate(hive_count=Count('hives'))

    def _attach_photo(self, instance):
        # No illustration for a hive type (yet)
        return

    @extend_schema(responses={204: OpenApiResponse(description='Deleted'),
                              409: OpenApiResponse(description='Hive type still in use')})
    def destroy(self, request, *args, **kwargs):
        hive_type = self.get_object()
        pk = hive_type.pk
        try:
            with transaction.atomic():
                hive_type.delete()
                self._record_deletion(request, hive_type, pk)
        except ProtectedError:
            count = Hive.objects.filter(hive_type=hive_type).count()
            return Response(
                {'error': f"This hive type is used by {count} hive(s) and cannot be deleted.",
                 'hive_count': count},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


def _day(value, field='on') -> datetime.date:
    """A day sent by the client (`YYYY-MM-DD`), today when absent, never in the future."""
    today = timezone.localdate()
    if value in (None, ''):
        return today
    try:
        day = datetime.date.fromisoformat(str(value))
    except ValueError:
        raise ValidationError({field: "Expected a date, YYYY-MM-DD."})
    if day > today:
        raise ValidationError({field: "This date is in the future."})
    return day


def _apiary_label(apiary) -> str:
    return audit.label_of(apiary) or f"#{apiary.pk}"


def _not_before(day, current, field='on'):
    """A change of place or keeper cannot predate the one it ends."""
    if current is not None and day < current.started_on:
        raise ValidationError({field: f"Not before {current.started_on.isoformat()}, the start of "
                                      "the current period."})


def _place(hive, apiary, day):
    """Close the current stay of the hive and, with an apiary, open the next one."""
    current = hive.placements.filter(ended_on__isnull=True).first()
    _not_before(day, current)
    if current is not None:
        current.ended_on = day
        current.save(update_fields=['ended_on'])
    if apiary is not None:
        HivePlacement.objects.create(hive=hive, apiary=apiary, apiary_label=_apiary_label(apiary),
                                     started_on=day)


def _entrust(hive, keeper, day):
    """Close the current custody of the hive and open the next one."""
    current = hive.custodies.filter(ended_on__isnull=True).first()
    _not_before(day, current)
    if current is not None:
        current.ended_on = day
        current.save(update_fields=['ended_on'])
    if keeper is not None:
        HiveCustody.objects.create(hive=hive, keeper=keeper, started_on=day)


def _hive_refs(hive) -> list:
    refs = []
    if hive.apiary_id:
        refs.append(audit.ref('apiary', hive.apiary_id))
    if hive.owner_group_id:
        refs.append(audit.ref('group', hive.owner_group.path))
    return refs


_DAY_PARAM = {'type': 'string', 'format': 'date',
              'description': 'The day it happened (default: today)'}


class HiveViewSet(viewsets.ModelViewSet):
    """
    Hives of the beekeepers. A hive in service stands in an apiary; stored or
    retired, it stands nowhere. Every move and every change of keeper is kept
    as a dated period (`placements`, `custodies` in the detail).
    """

    serializer_class = HiveSerializer
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        return [HasAnyRole(['beekeeper', 'admin'])]

    def get_queryset(self):
        return Hive.objects.select_related(
            'hive_type', 'apiary', 'owner_group', 'owner_user', 'keeper',
        ).prefetch_related(
            Prefetch('apiary__apiarygrouppermission_set',
                     queryset=ApiaryGroupPermission.objects.select_related('group')),
        )

    def get_object(self):
        try:
            pk = uuid.UUID(str(self.kwargs['pk']))
        except ValueError:
            raise NotFound()
        hive = self.get_queryset().filter(pk=pk).first()
        # 404 rather than 403: the existence of a hive is private
        if hive is None or not perms.can_read_hive(self.request, hive):
            raise NotFound()
        return hive

    def _fresh(self, hive, status_code=status.HTTP_200_OK):
        hive = self.get_queryset().get(pk=hive.pk)
        context = {**self.get_serializer_context(), 'with_history': True}
        return Response(HiveSerializer(hive, context=context).data, status=status_code)

    # -- reading -------------------------------------------------------------

    @extend_schema(parameters=[
        OpenApiParameter(name='apiary', type=OpenApiTypes.INT, location=OpenApiParameter.QUERY,
                         required=False, description='Only the hives standing in this apiary'),
        OpenApiParameter(name='status', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY,
                         required=False,
                         description="'active', 'stored', 'retired', or 'all' (default: not retired)"),
        OpenApiParameter(name='q', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY,
                         required=False, description='Name or number'),
    ])
    def list(self, request, *args, **kwargs):
        """The hives the requester may see, by name."""
        params = request.query_params
        queryset = self.get_queryset().filter(perms.readable_hives_q(request))
        if params.get('apiary'):
            try:
                apiary = Apiary.objects.get(pk=int(params['apiary']))
            except (ValueError, Apiary.DoesNotExist):
                raise NotFound()
            if not has_apiary_permission(request, apiary, APIARY_READ):
                raise NotFound()
            # Whoever sees the apiary sees what stands in it
            queryset = self.get_queryset().filter(apiary=apiary)
        hive_status = params.get('status', '')
        if hive_status in (Hive.STATUS_ACTIVE, Hive.STATUS_STORED, Hive.STATUS_RETIRED):
            queryset = queryset.filter(status=hive_status)
        elif hive_status == '':
            queryset = queryset.exclude(status=Hive.STATUS_RETIRED)
        elif hive_status != 'all':
            raise ValidationError({'status': "Expected 'active', 'stored', 'retired' or 'all'."})
        search = params.get('q', '').strip()
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(number__iexact=search.lstrip('#')))
        serializer = self.get_serializer(queryset, many=True, context={
            **self.get_serializer_context(), 'user_summaries': {},
        })
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        return self._fresh(self.get_object())

    # -- writing -------------------------------------------------------------

    @extend_schema(
        request={'application/json': {'type': 'object', 'properties': {
            'id': {'type': 'string', 'format': 'uuid'},
            'hive_type': {'type': 'integer'}, 'name': {'type': 'string'},
            'number': {'type': 'string'}, 'commissioned_on': {'type': 'string', 'format': 'date'},
            'comments': {'type': 'string'},
            'apiary': {'type': 'integer', 'description': 'Where it stands; none: stored'},
            'placed_on': _DAY_PARAM,
            'owner_group': {'type': 'string', 'description': 'Owning association; none: the requester'},
        }, 'required': ['hive_type', 'name']}},
        responses={201: HiveSerializer, 200: HiveSerializer},
    )
    def create(self, request, *args, **kwargs):
        """
        A new hive, kept by the requester and owned by them or by one of their
        associations. Sent again with the same `id`, it is not created twice.
        """
        client_id = request.data.get('id')
        if client_id:
            existing = Hive.objects.filter(pk=client_id).first() if self._is_uuid(client_id) else None
            if existing is not None:
                if not perms.can_read_hive(request, existing):
                    raise ValidationError({'id': "This identifier is already used."})
                return self._fresh(existing)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        apiary = self._target_apiary(request.data.get('apiary'))
        day = _day(request.data.get('placed_on'), 'placed_on')
        owner_group = self._owner_group(request.data.get('owner_group'))
        user = local_user(request)
        with transaction.atomic():
            hive = serializer.save(
                apiary=apiary,
                status=Hive.STATUS_ACTIVE if apiary else Hive.STATUS_STORED,
                owner_group=owner_group, owner_user=None if owner_group else user,
                keeper=user, created_by=user,
            )
            if apiary is not None:
                _place(hive, apiary, day)
            if user is not None:
                _entrust(hive, user, day)
            audit.record(request, 'hive.created', hive, changes=audit.snapshot(hive),
                         refs=_hive_refs(hive))
        return self._fresh(hive, status.HTTP_201_CREATED)

    @staticmethod
    def _is_uuid(value) -> bool:
        try:
            uuid.UUID(str(value))
        except ValueError:
            return False
        return True

    def _target_apiary(self, apiary_id):
        if apiary_id in (None, ''):
            return None
        try:
            apiary = Apiary.objects.prefetch_related(
                Prefetch('apiarygrouppermission_set',
                         queryset=ApiaryGroupPermission.objects.select_related('group')),
            ).get(pk=int(apiary_id))
        except (TypeError, ValueError, Apiary.DoesNotExist):
            raise ValidationError({'apiary': "Unknown apiary."})
        if not perms.can_place_in(self.request, apiary):
            raise PermissionDenied("You cannot place a hive in this apiary.")
        return apiary

    def _owner_group(self, path):
        if not path:
            return None
        allowed = perms.owner_group_choices(self.request)
        if not is_beekeeper_group(path) or (allowed is not None and path not in allowed):
            raise PermissionDenied(f"A hive cannot belong to {path} for you.")
        return _group_for_path(path)

    def perform_update(self, serializer):
        if not perms.can_tend_hive(self.request, serializer.instance):
            raise PermissionDenied("You cannot edit this hive.")
        with audit.track(self.request, 'hive.updated', serializer.instance) as tracked:
            tracked.refs = _hive_refs(serializer.instance)
            serializer.save()

    def update(self, request, *args, **kwargs):
        super().update(request, *args, **kwargs)
        return self._fresh(self.get_object())

    def destroy(self, request, *args, **kwargs):
        hive = self.get_object()
        if not perms.can_manage_hive(request, hive):
            raise PermissionDenied("You cannot delete this hive.")
        with transaction.atomic():
            changes = audit.snapshot(hive)
            refs = _hive_refs(hive)
            label = audit.label_of(hive)
            pk = hive.pk
            hive.delete()
            audit.record(request, 'hive.deleted', ('hive', pk), changes=changes, label=label,
                         refs=refs)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # -- place and status ----------------------------------------------------

    def _relocate(self, request, hive, apiary, new_status, code):
        """Move the hive to `apiary` (None: nowhere) with `new_status`, as one audited change."""
        day = _day(request.data.get('on'))
        previous = hive.apiary_id
        with audit.track(request, code, hive, fields=['apiary', 'status']) as tracked:
            _place(hive, apiary, day)
            hive.apiary = apiary
            hive.status = new_status
            hive.save(update_fields=['apiary', 'status', 'updated_at'])
            tracked.extra = {'on': day.isoformat()}
            tracked.refs = [audit.ref('apiary', previous)] if previous else []
            if hive.owner_group_id:
                tracked.refs.append(audit.ref('group', hive.owner_group.path))
        return self._fresh(hive)

    @extend_schema(
        request={'application/json': {'type': 'object', 'properties': {
            'apiary': {'type': 'integer'}, 'on': _DAY_PARAM}, 'required': ['apiary']}},
        responses={200: HiveSerializer},
    )
    @action(detail=True, methods=['post'])
    def move(self, request, pk=None):
        """Put the hive in an apiary: moved from another one, or back in service."""
        hive = self.get_object()
        if not perms.can_tend_hive(request, hive):
            raise PermissionDenied("You cannot move this hive.")
        apiary = self._target_apiary(request.data.get('apiary'))
        if apiary is None:
            raise ValidationError({'apiary': "This field is required."})
        if apiary.pk == hive.apiary_id:
            raise ValidationError({'apiary': "The hive already stands in this apiary."})
        return self._relocate(request, hive, apiary, Hive.STATUS_ACTIVE, 'hive.moved')

    @extend_schema(request={'application/json': {'type': 'object', 'properties': {'on': _DAY_PARAM}}},
                   responses={200: HiveSerializer})
    @action(detail=True, methods=['post'])
    def store(self, request, pk=None):
        """Take the hive out of its apiary and store it, empty or waiting for a colony."""
        hive = self.get_object()
        if not perms.can_tend_hive(request, hive):
            raise PermissionDenied("You cannot store this hive.")
        if hive.status == Hive.STATUS_STORED:
            raise ValidationError({'status': "The hive is already stored."})
        return self._relocate(request, hive, None, Hive.STATUS_STORED, 'hive.stored')

    @extend_schema(request={'application/json': {'type': 'object', 'properties': {'on': _DAY_PARAM}}},
                   responses={200: HiveSerializer})
    @action(detail=True, methods=['post'])
    def retire(self, request, pk=None):
        """Take the hive out of use for good; its history stays."""
        hive = self.get_object()
        if not perms.can_manage_hive(request, hive):
            raise PermissionDenied("You cannot retire this hive.")
        if hive.status == Hive.STATUS_RETIRED:
            raise ValidationError({'status': "The hive is already retired."})
        return self._relocate(request, hive, None, Hive.STATUS_RETIRED, 'hive.retired')

    # -- keeper --------------------------------------------------------------

    @extend_schema(
        parameters=[OpenApiParameter(name='group_path', type=OpenApiTypes.STR,
                                     location=OpenApiParameter.QUERY, required=False,
                                     description='GET: the association whose members are listed')],
        request={'application/json': {'type': 'object', 'properties': {
            'keeper_guid': {'type': 'string'}, 'group_path': {'type': 'string'}, 'on': _DAY_PARAM,
        }, 'required': ['keeper_guid']}},
        responses={200: HiveSerializer},
    )
    @action(detail=True, methods=['get', 'put'])
    def keeper(self, request, pk=None):
        """
        Entrust the hive to a beekeeper: the requester, or a member of the
        owning association (of one of the requester's for a hive owned by a
        person). GET: the associations and, with `?group_path=`, their members
        (names only, never an email). PUT: `keeper_guid`, the `group_path` the
        person was picked from, `on`.
        """
        hive = self.get_object()
        if not perms.can_manage_hive(request, hive):
            raise PermissionDenied("You cannot entrust this hive to someone else.")
        allowed = perms.keeper_groups(request, hive)

        if request.method == 'GET':
            data = {'groups': _group_choices(allowed),
                    'keeper_guid': str(hive.keeper_id) if hive.keeper_id else None}
            group_path = request.query_params.get('group_path', '').strip()
            if group_path:
                roster = self._roster(group_path, allowed)
                data['members'] = sorted(
                    ({'guid': guid, 'name': _full_name(user)} for guid, user in roster.users.items()),
                    key=lambda m: _sort_key(m['name'] or '~'),
                )
            return Response(data)

        keeper_guid = str(request.data.get('keeper_guid') or '')
        if not self._is_uuid(keeper_guid):
            raise ValidationError({'keeper_guid': "Expected the identifier of a person."})
        keeper_guid = str(uuid.UUID(keeper_guid))
        group_path = request.data.get('group_path')
        if keeper_guid == str(getattr(request.user, 'guid', '')) and not group_path:
            keeper = local_user(request)
        else:
            roster = self._roster(group_path, allowed)
            if keeper_guid not in roster:
                raise ValidationError({'keeper_guid': "This person is not a member of the association."})
            keeper, _ = User.objects.get_or_create(guid=keeper_guid)
        if keeper is None or keeper.pk == hive.keeper_id:
            raise ValidationError({'keeper_guid': "The hive is already entrusted to this person."})

        day = _day(request.data.get('on'))
        previous = hive.keeper_id
        with audit.track(request, 'hive.keeper_changed', hive, fields=['keeper']) as tracked:
            _entrust(hive, keeper, day)
            hive.keeper = keeper
            hive.save(update_fields=['keeper', 'updated_at'])
            tracked.extra = {'on': day.isoformat()}
            tracked.refs = [audit.ref('user', guid) for guid in (previous, keeper.pk) if guid]
            if group_path:
                tracked.refs.append(audit.ref('group', group_path))
        return self._fresh(hive)

    @staticmethod
    def _roster(group_path, allowed):
        if not group_path:
            raise ValidationError({'group_path': "This field is required."})
        if not is_beekeeper_group(group_path) or (allowed is not None and group_path not in allowed):
            raise PermissionDenied(f"You cannot entrust this hive to a member of {group_path}.")
        group = _keycloak(keycloak.get_group_by_path, group_path)
        if group is None:
            raise ValidationError({'group_path': "Unknown group."})
        return _Roster(group_path, group)
