"""
Access rules of the nests module.

* Every role reports a nest. Nest hunters, beekeepers and admins see every
  nest; the others see the destroyed ones and those they reported.
* The content of a nest (fields, photos) is managed by the coordinators: the
  platform admins and the administrators of the nest hunters (members of
  `/hunters/admin`, the same `<group>/admin` convention as in
  `trap_permissions.py`). They alone record a verification (from the
  photos, a call with the reporter or on the spot).
* A destruction is recorded by a coordinator, or declared by whoever reported
  the nest: they are usually the first to know.
* A destroyed, rejected or abandoned nest stays so: only a platform admin
  turns it back into a reported one. Deleting and archiving remain admin tasks.
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


def can_see_contact(request, nest) -> bool:
    """The reporter's phone number and the private comment: coordinators, and the reporter."""
    return is_nest_manager(request) or is_reporter(request, nest)


def can_reactivate_nest(request) -> bool:
    """Turning a destroyed, rejected or abandoned nest back into a reported one: platform admins only."""
    user = _authenticated(request)
    return bool(user) and is_platform_admin(user)


def can_visit_nest(request, nest) -> bool:
    """Recording a verification (active, empty, another species, not found): coordinators, on a nest not destroyed."""
    return nest.status != nest.STATUS_DESTROYED and is_nest_manager(request)


def can_record_destruction(request, nest) -> bool:
    """Coordinators, and the reporter of the nest; once only."""
    if nest.status == nest.STATUS_DESTROYED:
        return False
    return is_nest_manager(request) or is_reporter(request, nest)


def can_delete_event(request, event) -> bool:
    """
    Removing an entry of the journal: coordinators, and the author of a
    destruction they declared. The report stays: it is the nest itself.
    """
    if event.kind == event.KIND_REPORT:
        return False
    if is_nest_manager(request):
        return True
    user = _authenticated(request)
    guid = getattr(user, 'guid', None) if user else None
    return (event.kind == event.KIND_DESTRUCTION and bool(guid)
            and str(event.performed_by_id) == str(guid))


def can_delete_nest(request) -> bool:
    user = _authenticated(request)
    return bool(user) and is_platform_admin(user)


def can_see_nearby_apiaries(request) -> bool:
    """AFSCA numbers of the apiaries near a nest: apiaries are private, managers only."""
    return is_nest_manager(request)
