"""
Access rules of the nests module.

* Every role reports a nest. Nest hunters, beekeepers and admins see every
  nest; the others see the destroyed ones and those they reported.
* The content of a nest (fields, photos) is managed by the platform admins and
  by the administrators of the nest hunters (members of `/hunters/admin`, the
  same `<group>/admin` convention as in `trap_permissions.py`).
* A destroyed (neutralised) nest stays destroyed: only a platform admin turns
  it back into an active one. Deleting and archiving remain admin tasks.
"""

from hornet_finder_api.roles import ADMIN, BEEKEEPER, HUNTER

from .trap_permissions import is_group_admin_of, is_platform_admin, membership_paths

HUNTERS_ROOT = '/hunters'

# Roles that see every nest, with its author and its photos
ALL_NESTS_ROLES = (HUNTER, BEEKEEPER, ADMIN)

# Apiaries whose AFSCA number is listed on a nest: those within this distance
NEARBY_APIARY_RADIUS_M = 1000


def _authenticated(request):
    user = getattr(request, 'user', None)
    if user is None or not getattr(user, 'is_authenticated', False):
        return None
    return user


def sees_all_nests(request) -> bool:
    user = _authenticated(request)
    return bool(user) and any(role in getattr(user, 'roles', []) for role in ALL_NESTS_ROLES)


def is_reporter(request, nest) -> bool:
    user = _authenticated(request)
    guid = getattr(user, 'guid', None) if user else None
    return bool(nest.created_by_id and guid and str(nest.created_by_id) == str(guid))


def can_read_nest(request, nest) -> bool:
    """Who sees the full nest (author, photos): every-nest roles and its reporter."""
    return sees_all_nests(request) or is_reporter(request, nest)


def is_nest_manager(request) -> bool:
    """Platform admins and administrators of the nest hunters (`/hunters/admin`)."""
    user = _authenticated(request)
    if user is None:
        return False
    return is_platform_admin(user) or is_group_admin_of(membership_paths(request), HUNTERS_ROOT)


def can_edit_nest(request, nest) -> bool:
    """Changing the fields of a nest, its photos included."""
    return is_nest_manager(request)


def can_reactivate_nest(request) -> bool:
    """Turning a destroyed nest back into an active one: platform admins only."""
    user = _authenticated(request)
    return bool(user) and is_platform_admin(user)


def can_delete_nest(request) -> bool:
    user = _authenticated(request)
    return bool(user) and is_platform_admin(user)


def can_see_nearby_apiaries(request) -> bool:
    """AFSCA numbers of the apiaries near a nest: apiaries are private, managers only."""
    return is_nest_manager(request)
