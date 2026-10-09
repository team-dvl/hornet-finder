"""API of the apiaries: CRUD, photo, sharing with groups and owner change."""

import logging
import re
import uuid

from django.db.models import F, Prefetch, Q, Value
from django.db.models.functions import Replace

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from hornet_finder_api import utils as keycloak
from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication

from . import apiary_permissions as perms
from .afsca import afsca_digits
from .models import Apiary, ApiaryGroupPermission, User
from .serializers import ApiarySerializer
from .group_views import _Roster, _full_name
from .invitation_views import _keycloak, _sort_key, is_beekeeper_group
from .trap_permissions import local_user
from .trap_views import _delete_files, _group_choices, _group_for_path, _store_photo
from .views import GeographicFilterMixin, geographic_list_schema

logger = logging.getLogger(__name__)

# Sort keys of the apiary manager, mapped to the queryset field they order by
MANAGED_ORDERINGS = {
    'infestation_level': 'infestation_level',
    'created_at': 'created_at',
    'address': 'address',
    'id': 'id',
}


class ManagedApiaryPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class ApiaryViewSet(GeographicFilterMixin, viewsets.ModelViewSet):
    """
    Apiaries, reserved to beekeepers and admins. The rules live in
    `apiary_permissions.py`.
    """

    queryset = Apiary.objects.select_related('owner', 'created_by').prefetch_related(
        Prefetch('apiarygrouppermission_set',
                 queryset=ApiaryGroupPermission.objects.select_related('group')),
    )
    serializer_class = ApiarySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        return [HasAnyRole(['beekeeper', 'admin'])]

    def _require(self, apiary, perm, message):
        if not perms.has_apiary_permission(self.request, apiary, perm):
            raise PermissionDenied(message)

    def _fresh(self, apiary):
        """Serialise the apiary again, its prefetched group grants having changed."""
        return Response(self.get_serializer(self.get_queryset().get(pk=apiary.pk)).data)

    # -- reading -------------------------------------------------------------

    @geographic_list_schema()
    @extend_schema(parameters=[
        OpenApiParameter(name='mine', type=OpenApiTypes.BOOL, location=OpenApiParameter.QUERY,
                         required=False, description='Only the apiaries the requester owns'),
    ])
    def list(self, request, *args, **kwargs):
        queryset, error_response = self.get_geographic_queryset(request)
        if error_response:
            return error_response
        queryset = queryset.filter(perms.readable_apiaries_q(request))
        if request.query_params.get('mine') in ('true', '1'):
            queryset = queryset.filter(owner__guid=getattr(request.user, 'guid', None))
        return Response(self.get_serializer(queryset, many=True).data)

    @extend_schema(
        parameters=[
            OpenApiParameter(name='scope', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY,
                             required=False,
                             description="'mine' (default), 'shared' or 'all' (platform admins)"),
            OpenApiParameter(name='group', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY,
                             required=False, description='Path of a group the apiary is shared with'),
            OpenApiParameter(name='infestation_level', type=OpenApiTypes.STR,
                             location=OpenApiParameter.QUERY, required=False,
                             description="1, 2, 3, or 'none' for apiaries not assessed"),
            OpenApiParameter(name='q', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY,
                             required=False,
                             description='Number, address, AFSCA number or comments'),
            OpenApiParameter(name='ordering', type=OpenApiTypes.STR,
                             location=OpenApiParameter.QUERY, required=False,
                             description=("One of " + ', '.join(sorted(MANAGED_ORDERINGS))
                                          + ", prefixed with '-' for descending order "
                                          "(default '-infestation_level'). "
                                          "No ordering by distance: it would locate the apiaries")),
            OpenApiParameter(name='page', type=OpenApiTypes.INT, location=OpenApiParameter.QUERY,
                             required=False),
            OpenApiParameter(name='page_size', type=OpenApiTypes.INT,
                             location=OpenApiParameter.QUERY, required=False),
        ],
        responses={200: ApiarySerializer(many=True)},
    )
    @action(detail=False, methods=['get'])
    def managed(self, request):
        """
        The apiary manager: apiaries the caller owns (`mine`), apiaries shared
        with one of their groups (`shared`), or every apiary (`all`, platform
        admins). No radius, unlike the map listing; filtered, sorted and
        paginated here.
        """
        params = request.query_params
        guid = getattr(request.user, 'guid', None)
        scope = params.get('scope', 'mine')
        queryset = self.get_queryset()
        if scope == 'mine':
            queryset = queryset.filter(owner__guid=guid)
        elif scope == 'shared':
            queryset = queryset.filter(perms.shared_with_requester_q(request)).exclude(owner__guid=guid)
        elif scope == 'all':
            if not perms.is_platform_admin(request.user):
                raise PermissionDenied("Only a platform administrator can list every apiary.")
        else:
            raise DRFValidationError({'scope': "Expected 'mine', 'shared' or 'all'."})

        if params.get('group'):
            queryset = queryset.filter(apiarygrouppermission__group__path=params['group'])
        level = params.get('infestation_level')
        if level == 'none':
            queryset = queryset.filter(infestation_level__isnull=True)
        elif level:
            try:
                queryset = queryset.filter(infestation_level=int(level))
            except ValueError:
                raise DRFValidationError({'infestation_level': "Expected 1, 2, 3 or 'none'."})
        search = params.get('q', '').strip().lstrip('#')
        if search:
            match = (Q(address__icontains=search) | Q(afsca_number__icontains=search)
                     | Q(comments__icontains=search))
            # An AFSCA number is found by its digits too, typed without the dots
            digits = afsca_digits(search)
            if len(digits) >= 3 and digits == re.sub(r'[\s./-]', '', search):
                queryset = queryset.alias(
                    afsca_plain=Replace('afsca_number', Value('.'), Value(''))
                )
                match |= Q(afsca_plain__icontains=digits)
            if search.isdigit():
                match |= Q(pk=int(search))
            queryset = queryset.filter(match)

        ordering = params.get('ordering', '-infestation_level')
        field = ordering.lstrip('-')
        if field not in MANAGED_ORDERINGS:
            raise DRFValidationError({'ordering': f"Unknown ordering '{ordering}'."})
        expression = F(MANAGED_ORDERINGS[field])
        # Apiaries without an infestation level come last, whatever the direction
        expression = (expression.desc(nulls_last=True) if ordering.startswith('-')
                      else expression.asc(nulls_last=True))
        queryset = queryset.order_by(expression, '-id')

        paginator = ManagedApiaryPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        # Owners repeat across a page: resolve each display name once
        serializer = self.get_serializer(page, many=True, context={
            **self.get_serializer_context(), 'user_summaries': {},
        })
        return paginator.get_paginated_response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        self._require(self.get_object(), perms.READ, "You do not have permission to view this apiary.")
        return super().retrieve(request, *args, **kwargs)

    # -- writing -------------------------------------------------------------

    def perform_create(self, serializer):
        user = local_user(self.request)
        apiary = serializer.save(created_by=user, owner=user)
        self._attach_photo(apiary)

    def perform_update(self, serializer):
        self._attach_photo(serializer.save())

    def _attach_photo(self, apiary):
        uploaded = self.request.FILES.get('photo')
        if not uploaded:
            return
        _delete_files(apiary.photo, apiary.photo_thumbnail)
        _store_photo(apiary, 'photo', 'photo_thumbnail', uploaded)
        apiary.save(update_fields=['photo', 'photo_thumbnail'])

    def update(self, request, *args, **kwargs):
        self._require(self.get_object(), perms.UPDATE, "You do not have permission to update this apiary.")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._require(self.get_object(), perms.UPDATE, "You do not have permission to update this apiary.")
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        apiary = self.get_object()
        self._require(apiary, perms.DELETE, "You do not have permission to delete this apiary.")
        _delete_files(apiary.photo, apiary.photo_thumbnail)
        return super().destroy(request, *args, **kwargs)

    @extend_schema(
        request={'multipart/form-data': {'type': 'object',
                                         'properties': {'photo': {'type': 'string',
                                                                  'format': 'binary'}}}},
        responses={200: ApiarySerializer},
    )
    @action(detail=True, methods=['post', 'delete'], url_path='photo')
    def photo(self, request, pk=None):
        apiary = self.get_object()
        self._require(apiary, perms.UPDATE, "You do not have permission to update this apiary.")
        if request.method == 'DELETE':
            _delete_files(apiary.photo, apiary.photo_thumbnail)
            apiary.photo = None
            apiary.photo_thumbnail = None
            apiary.save(update_fields=['photo', 'photo_thumbnail'])
        else:
            if not request.FILES.get('photo'):
                raise DRFValidationError({'photo': "No file received."})
            self._attach_photo(apiary)
        return Response(self.get_serializer(apiary).data)

    # -- sharing -------------------------------------------------------------

    @extend_schema(
        parameters=[OpenApiParameter(name='group_path', type=OpenApiTypes.STR,
                                     location=OpenApiParameter.QUERY, required=False,
                                     description='DELETE: the group to stop sharing with')],
        request={'application/json': {'type': 'object',
                                      'properties': {'group_path': {'type': 'string'},
                                                     'can_update': {'type': 'boolean'}}}},
        responses={200: ApiarySerializer},
    )
    @action(detail=True, methods=['get', 'put', 'delete'], url_path='sharing')
    def sharing(self, request, pk=None):
        """
        GET: the groups the requester may share with, named as in Keycloak.
        PUT: share with a group, or change what it may do.
        DELETE: stop sharing with a group.
        """
        apiary = self.get_object()
        self._require(apiary, perms.READ, "You do not have permission to view this apiary.")
        allowed = perms.allowed_share_groups(request, apiary)

        if request.method == 'GET':
            return Response({
                'can_share': perms.can_share_apiary(request, apiary),
                # Always a list: a platform admin picks among every association
                'allowed_groups': _group_choices(allowed),
            })

        if not perms.can_share_apiary(request, apiary):
            raise PermissionDenied("Only the owner or a platform administrator can share this apiary.")

        if request.method == 'DELETE':
            group_path = request.query_params.get('group_path')
            if not group_path:
                raise DRFValidationError({'group_path': "This field is required."})
            ApiaryGroupPermission.objects.filter(apiary=apiary, group__path=group_path).delete()
            return self._fresh(apiary)

        group_path = request.data.get('group_path')
        if not group_path:
            raise DRFValidationError({'group_path': "This field is required."})
        if allowed is not None and group_path not in allowed:
            raise PermissionDenied(f"You cannot share this apiary with {group_path}.")
        can_update = str(request.data.get('can_update', False)).lower() in ('true', '1')
        ApiaryGroupPermission.objects.update_or_create(
            apiary=apiary, group=_group_for_path(group_path),
            # Sharing is about seeing and possibly maintaining; deleting stays with the owner
            defaults={'can_read': True, 'can_update': can_update, 'can_delete': False},
        )
        return self._fresh(apiary)

    @extend_schema(
        parameters=[OpenApiParameter(name='group_path', type=OpenApiTypes.STR,
                                     location=OpenApiParameter.QUERY, required=False,
                                     description='GET: the group whose members are listed')],
        request={'application/json': {'type': 'object',
                                      'properties': {'owner_guid': {'type': 'string'},
                                                     'group_path': {'type': 'string'}}}},
        responses={200: ApiarySerializer},
    )
    @action(detail=True, methods=['get', 'put'], url_path='owner')
    def owner(self, request, pk=None):
        """
        Hand an apiary over to another beekeeper: a platform admin, or the
        administrator of a group the owner belongs to, to a member of that group.

        GET: the groups to choose from and, with `?group_path=`, their members
        (first and last name, never an email). PUT: `owner_guid`, and the
        `group_path` the person was picked from (optional for a platform admin).
        """
        apiary = self.get_object()
        allowed = perms.owner_transfer_groups(request, apiary)
        if allowed is not None and not allowed:
            raise PermissionDenied("You cannot change the owner of this apiary.")

        if request.method == 'GET':
            return Response(self._transfer_choices(request, apiary, allowed))

        owner_guid = request.data.get('owner_guid')
        if not owner_guid:
            raise DRFValidationError({'owner_guid': "This field is required."})
        group_path = request.data.get('group_path')
        if group_path or allowed is not None:
            new_owner = self._member_user(group_path, owner_guid, allowed)
        else:
            new_owner = User.objects.filter(guid=owner_guid).first()
            if new_owner is None:
                raise DRFValidationError({'owner_guid': "Unknown user."})
        previous = apiary.owner_id
        apiary.owner = new_owner
        apiary.save(update_fields=['owner'])
        logger.info("Apiary %s reassigned from %s to %s by %s", apiary.id, previous,
                    new_owner.guid, getattr(request.user, 'guid', None))
        return self._fresh(apiary)

    def _transfer_choices(self, request, apiary, allowed):
        groups = _group_choices(allowed)
        group_path = request.query_params.get('group_path', '').strip()
        data = {'groups': groups, 'owner_guid': str(apiary.owner_id) if apiary.owner_id else None}
        if group_path:
            self._check_transfer_group(group_path, allowed)
            roster = _Roster(group_path, self._keycloak_group(group_path))
            data['members'] = sorted(
                ({'guid': guid, 'name': _full_name(user)} for guid, user in roster.users.items()),
                key=lambda m: _sort_key(m['name'] or '~'),
            )
        return data

    @staticmethod
    def _check_transfer_group(group_path, allowed):
        if not is_beekeeper_group(group_path) or (allowed is not None and group_path not in allowed):
            raise PermissionDenied(f"You cannot hand this apiary over within {group_path}.")

    @staticmethod
    def _keycloak_group(group_path):
        group = _keycloak(keycloak.get_group_by_path, group_path)
        if group is None:
            raise DRFValidationError({'group_path': "Unknown group."})
        return group

    def _member_user(self, group_path, owner_guid, allowed):
        """The local user of a member of `group_path`, created if they never signed in."""
        if not group_path:
            raise DRFValidationError({'group_path': "This field is required."})
        self._check_transfer_group(group_path, allowed)
        try:
            guid = str(uuid.UUID(str(owner_guid)))
        except ValueError:
            raise DRFValidationError({'owner_guid': "Invalid identifier."})
        roster = _Roster(group_path, self._keycloak_group(group_path))
        if guid not in roster:
            raise DRFValidationError({'owner_guid': "This person is not a member of the group."})
        user, _ = User.objects.get_or_create(guid=guid)
        return user
