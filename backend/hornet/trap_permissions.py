"""
Access rules of the traps module.

Two ideas drive this module:

* Keycloak's `membership` claim only lists the groups a user belongs to
  *directly*: someone in `/beekeepers/ena/admin` does not necessarily have
  `/beekeepers/ena` in their token. Every comparison is therefore made on the
  path prefix, never on string equality alone.
* A group administrator's rights depend on the *owner's* groups, which the
  requester's own token cannot tell us. They are read from `User.group_paths`,
  refreshed at every authenticated request.
"""

import logging

from .models import User

logger = logging.getLogger(__name__)

ADMIN_SEGMENT = 'admin'


def membership_paths(request) -> list:
    """Group paths carried by the requester's token (claim `membership`)."""
    token_info = getattr(getattr(request, 'user', None), 'token_info', None)
    if not token_info:
        return []
    return token_info.get('membership', []) or []


def is_platform_admin(user) -> bool:
    return 'admin' in getattr(user, 'roles', [])


def is_member_of(paths, group_path: str) -> bool:
    """True when one of `paths` is `group_path` or one of its subgroups."""
    if not group_path:
        return False
    return any(p == group_path or p.startswith(group_path + '/') for p in paths)


def is_group_admin_of(paths, group_path: str) -> bool:
    """True when one of `paths` is the `admin` subgroup of `group_path`."""
    if not group_path:
        return False
    admin_path = f"{group_path}/{ADMIN_SEGMENT}"
    return any(p == admin_path or p.startswith(admin_path + '/') for p in paths)


def administered_groups(paths) -> set:
    """The groups the holder of `paths` administers, derived from `<group>/admin`."""
    groups = set()
    for path in paths:
        segments = path.split('/')
        if ADMIN_SEGMENT in segments[1:]:
            index = segments.index(ADMIN_SEGMENT, 1)
            group = '/'.join(segments[:index])
            if group:
                groups.add(group)
    return groups


def owner_group_paths(owner) -> list:
    """Group paths of a trap owner, from the local mirror of the Keycloak groups."""
    if owner is None:
        return []
    if owner.group_paths:
        return owner.group_paths
    # The owner has not authenticated since the mirror was introduced: ask Keycloak.
    try:
        from hornet_finder_api.utils import get_user_group_paths
        return get_user_group_paths(str(owner.guid))
    except Exception as exc:  # pragma: no cover - network/Keycloak failure
        logger.warning("Could not read Keycloak groups of %s: %s", owner.guid, exc)
        return []


def is_owner(user, trap) -> bool:
    guid = getattr(user, 'guid', None)
    return bool(trap.owner_id and guid and str(trap.owner_id) == str(guid))


def can_read_trap(request, trap) -> bool:
    """Public traps are readable by anyone, including anonymous visitors."""
    if trap.visibility == trap.VISIBILITY_PUBLIC:
        return True
    user = getattr(request, 'user', None)
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    if is_platform_admin(user) or is_owner(user, trap):
        return True
    return trap.group_id is not None and is_member_of(membership_paths(request), trap.group.path)


def can_act_on_trap(request, trap) -> bool:
    """Recording an event is field work: the owner and the delegated group, not admins."""
    user = getattr(request, 'user', None)
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    if is_owner(user, trap):
        return True
    return trap.group_id is not None and is_member_of(membership_paths(request), trap.group.path)


def can_edit_trap(request, trap) -> bool:
    """Editing, moving, deleting the trap or its photo: owner or platform admin."""
    user = getattr(request, 'user', None)
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    return is_owner(user, trap) or is_platform_admin(user)


def can_change_owner(request) -> bool:
    """Reassigning a bequeathed trap is an administration task."""
    user = getattr(request, 'user', None)
    return bool(user and getattr(user, 'is_authenticated', False) and is_platform_admin(user))


def allowed_delegation_groups(request, trap):
    """
    Group paths the requester may delegate this trap to.

    Returns `None` when any group is allowed (platform admin), which the caller
    turns into "no restriction".
    """
    user = getattr(request, 'user', None)
    if user is None or not getattr(user, 'is_authenticated', False):
        return set()
    if is_platform_admin(user):
        return None
    owner_groups = set(owner_group_paths(trap.owner))
    if is_owner(user, trap):
        return owner_groups
    # A group administrator may only delegate to a group they administer and
    # the owner belongs to.
    return administered_groups(membership_paths(request)) & owner_groups


def can_set_delegation(request, trap) -> bool:
    allowed = allowed_delegation_groups(request, trap)
    return allowed is None or bool(allowed)


def can_edit_event(request, event) -> bool:
    """Changing the content of an event: its author, or the owner of the trap."""
    user = getattr(request, 'user', None)
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    guid = getattr(user, 'guid', None)
    if event.performed_by_id and guid and str(event.performed_by_id) == str(guid):
        return True
    return is_owner(user, event.trap)


def can_delete_event(request, event) -> bool:
    """Deletion additionally allows platform admins, for moderation."""
    user = getattr(request, 'user', None)
    if user is not None and getattr(user, 'is_authenticated', False) and is_platform_admin(user):
        return True
    return can_edit_event(request, event)


def local_user(request):
    """The local `User` row matching the authenticated requester."""
    guid = getattr(getattr(request, 'user', None), 'guid', None)
    if not guid:
        return None
    return User.objects.filter(guid=guid).first()
