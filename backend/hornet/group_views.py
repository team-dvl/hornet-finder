"""
Membership administration of beekeeper groups (`/beekeepers/<id>`), and the
roster of the trappers (`/trappers`).

The administrators of a beekeeper group (members of `<group>/admin`, see
`trap_permissions.py`) and the platform admins list its members and remove
them; inviting is in `invitation_views.py`. The administrators of `/trappers`
(members of `/trappers/admin`) coordinate every trapper: they list them, but
removing a trapper, who then loses the role, is left to platform admins. Naming or dismissing a group
administrator is reserved to platform admins, and a group never loses its last
administrator. Members are shown by first and last name only, never by email.

Changes are made in Keycloak with the backend service account (`manage-users`).
They reach the affected user's token at its next refresh (access tokens last
60 minutes), not instantly.
"""

import logging
import uuid

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from hornet_finder_api import utils as keycloak
from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication
from hornet_finder_api.roles import ADMIN, BEEKEEPER, TRAPPER

from . import trap_permissions as perms
from .invitation_views import _keycloak, _sort_key, beekeeper_groups, can_invite_to, invitable_groups

logger = logging.getLogger(__name__)

GUID_PATTERN = '[0-9a-fA-F-]{36}'


def _conflict(code: str, detail: str) -> Response:
    return Response({'code': code, 'detail': detail}, status=status.HTTP_409_CONFLICT)


def _refused(code: str, detail: str) -> Response:
    return Response({'code': code, 'detail': detail}, status=status.HTTP_403_FORBIDDEN)


def _full_name(user: dict):
    """First and last name, `None` for an account without any: never the email."""
    return ' '.join(p for p in (user.get('firstName'), user.get('lastName')) if p) or None


def viewable_groups(request):
    """
    Groups whose members the caller may list: the beekeeper groups they
    administer, plus `/trappers` for its administrators. `None` means every
    beekeeper group and `/trappers` (platform admin).
    """
    allowed = invitable_groups(request)
    if allowed is None:
        return None
    if perms.is_group_admin_of(perms.membership_paths(request), perms.TRAPPERS_ROOT):
        allowed.add(perms.TRAPPERS_ROOT)
    return allowed


def can_view_group(request, group_path: str) -> bool:
    if not (perms.is_beekeeper_group(group_path) or group_path == perms.TRAPPERS_ROOT):
        return False
    allowed = viewable_groups(request)
    return allowed is None or group_path in allowed


def can_remove_from(request, group_path: str) -> bool:
    """Leaving `/trappers` withdraws the trapper role: platform admins only."""
    if group_path == perms.TRAPPERS_ROOT:
        return perms.is_platform_admin(request.user)
    return can_invite_to(request, group_path)


def _administered(request, group_path: str) -> dict:
    """The Keycloak group at `group_path`, once the caller is known to administer it."""
    if not group_path:
        raise ValidationError({'group_path': "Ce champ est obligatoire."})
    if not can_view_group(request, group_path):
        raise PermissionDenied("Vous n'administrez pas ce groupe.")
    group = _keycloak(keycloak.get_group_by_path, group_path)
    if group is None:
        raise NotFound("Ce groupe n'existe pas.")
    return group


class _Roster:
    """
    Who belongs to a group. Keycloak only lists the direct members of a group,
    and an administrator may sit in `<group>/admin` alone: the roster is the
    union of both, and the members of the `admin` subgroup are the administrators.
    """

    def __init__(self, group_path: str, group: dict):
        self.group = group
        self.admin_group = _keycloak(keycloak.get_group_by_path, f'{group_path}/{perms.ADMIN_SEGMENT}')
        direct = _keycloak(keycloak.get_group_members, group['id'])
        admins = _keycloak(keycloak.get_group_members, self.admin_group['id']) if self.admin_group else []
        self.direct_ids = {m['id'] for m in direct}
        self.admin_ids = {m['id'] for m in admins}
        self.users = {m['id']: m for m in [*direct, *admins]}

    def __contains__(self, guid: str) -> bool:
        return guid in self.users

    def serialize(self, request) -> list:
        me = str(request.user.guid)
        rows = [
            {'guid': guid, 'name': _full_name(user), 'is_admin': guid in self.admin_ids, 'is_self': guid == me}
            for guid, user in self.users.items()
        ]
        rows.sort(key=lambda r: (not r['is_admin'], _sort_key(r['name'] or '~')))
        return rows


def _guid(value: str) -> str:
    try:
        return str(uuid.UUID(value))
    except ValueError:
        raise NotFound()


class GroupViewSet(viewsets.GenericViewSet):
    """Members of the groups the caller administers."""

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        # Group administrators inherit `beekeeper` or `trapper` from the root of their group
        return [HasAnyRole([BEEKEEPER, TRAPPER, ADMIN])]

    @extend_schema(responses={200: None})
    def list(self, request):
        """The groups the caller administers: `path` and `name` (the Keycloak description, else its name)."""
        allowed = viewable_groups(request)
        if allowed is None:
            trappers = _keycloak(keycloak.get_group_by_path, perms.TRAPPERS_ROOT)
            groups = beekeeper_groups() + ([trappers] if trappers else [])
        else:
            groups = [g for g in (_keycloak(keycloak.get_group_by_path, p) for p in sorted(allowed)) if g]
        return Response(sorted(
            ({'path': g['path'], 'name': keycloak.group_display_name(g)} for g in groups),
            key=lambda g: _sort_key(g['name']),
        ))

    @extend_schema(responses={200: None})
    @action(detail=False, methods=['get'])
    def members(self, request):
        """
        Members of `?group_path=`, administrators first. Each has `guid`, `name`
        (`null` without a name), `is_admin` and `is_self`.
        """
        group_path = request.query_params.get('group_path', '').strip()
        roster = _Roster(group_path, _administered(request, group_path))
        return Response({'members': roster.serialize(request), 'has_admin_group': roster.admin_group is not None})

    @extend_schema(request=None, responses={204: None})
    @action(detail=False, methods=['delete'], url_path=f'members/(?P<guid>{GUID_PATTERN})')
    def member(self, request, guid=None):
        """
        Remove a member of `?group_path=` from the group (and from its `admin`
        subgroup). Errors carry a `code`: `self` (409), `admin_member` (403, only
        a platform admin removes an administrator), `last_admin` (409).
        """
        guid = _guid(guid)
        group_path = request.query_params.get('group_path', '').strip()
        roster = _Roster(group_path, _administered(request, group_path))
        if guid not in roster:
            raise NotFound("Cette personne n'est pas membre de ce groupe.")
        if guid == str(request.user.guid):
            return _conflict('self', "Vous ne pouvez pas vous retirer vous-même du groupe.")
        if not can_remove_from(request, group_path):
            return _refused('platform_only', "Seul un administrateur de la plateforme peut retirer un piégeur.")
        is_admin = guid in roster.admin_ids
        if is_admin and not perms.is_platform_admin(request.user):
            return _refused('admin_member', "Seul un administrateur de la plateforme peut retirer un administrateur du groupe.")
        if is_admin and len(roster.admin_ids) == 1:
            return _conflict('last_admin', "Un groupe garde au moins un administrateur : nommez-en un autre d'abord.")
        if is_admin:
            _keycloak(keycloak.remove_user_from_group, guid, roster.admin_group['id'])
        if guid in roster.direct_ids:
            _keycloak(keycloak.remove_user_from_group, guid, roster.group['id'])
        logger.info("Member %s removed from %s by %s", guid, group_path, request.user.guid)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _platform_only(self, request):
        if not perms.is_platform_admin(request.user):
            raise PermissionDenied("Réservé aux administrateurs de la plateforme.")

    @extend_schema(request=None, responses={200: None})
    @action(detail=False, methods=['put'], url_path=f'members/(?P<guid>{GUID_PATTERN})/admin')
    def member_admin(self, request, guid=None):
        """
        Name a member administrator of `?group_path=` (platform admins only).
        Errors carry a `code`: `already_admin`, `no_admin_group` (409).
        """
        self._platform_only(request)
        guid = _guid(guid)
        group_path = request.query_params.get('group_path', '').strip()
        roster = _Roster(group_path, _administered(request, group_path))
        if guid not in roster:
            raise NotFound("Cette personne n'est pas membre de ce groupe.")
        if guid in roster.admin_ids:
            return _conflict('already_admin', "Cette personne administre déjà ce groupe.")
        if roster.admin_group is None:
            return _conflict('no_admin_group', "Ce groupe n'a pas de sous-groupe « admin » dans Keycloak.")
        _keycloak(keycloak.add_user_to_group, guid, roster.admin_group['id'])
        logger.info("Member %s named administrator of %s by %s", guid, group_path, request.user.guid)
        return Response({'guid': guid, 'is_admin': True})

    @extend_schema(request=None, responses={200: None})
    @member_admin.mapping.delete
    def dismiss_admin(self, request, guid=None):
        """
        Dismiss an administrator of `?group_path=`, who stays a member
        (platform admins only). Error `last_admin` (409): a group keeps one.
        """
        self._platform_only(request)
        guid = _guid(guid)
        group_path = request.query_params.get('group_path', '').strip()
        roster = _Roster(group_path, _administered(request, group_path))
        if guid not in roster:
            raise NotFound("Cette personne n'est pas membre de ce groupe.")
        if guid not in roster.admin_ids:
            return _conflict('not_admin', "Cette personne n'administre pas ce groupe.")
        if len(roster.admin_ids) == 1:
            return _conflict('last_admin', "Un groupe garde au moins un administrateur : nommez-en un autre d'abord.")
        # Someone listed only in `admin` must not lose the membership with the role
        if guid not in roster.direct_ids:
            _keycloak(keycloak.add_user_to_group, guid, roster.group['id'])
        _keycloak(keycloak.remove_user_from_group, guid, roster.admin_group['id'])
        logger.info("Administrator %s of %s dismissed by %s", guid, group_path, request.user.guid)
        return Response({'guid': guid, 'is_admin': False})
