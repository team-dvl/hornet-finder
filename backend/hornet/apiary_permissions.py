"""
Access rules of the apiaries.

An apiary is never public: it is seen by its owner, by platform admins and by
the members of the groups it is shared with (`ApiaryGroupPermission`). Group
membership follows the same prefix rule as the traps (see
`trap_permissions.py`): a member of `/beekeepers/ena/admin` is a member of
`/beekeepers/ena` too.
"""

from django.db.models import Q

from .models import ApiaryGroupPermission
from .trap_permissions import (
    ADMIN_SEGMENT, is_member_of, is_platform_admin, membership_paths, owner_group_paths,
)

READ, UPDATE, DELETE = 'read', 'update', 'delete'
_FLAG = {READ: 'can_read', UPDATE: 'can_update', DELETE: 'can_delete'}


def _authenticated(request):
    user = getattr(request, 'user', None)
    return user if user is not None and getattr(user, 'is_authenticated', False) else None


def is_apiary_owner(user, apiary) -> bool:
    guid = getattr(user, 'guid', None)
    return bool(apiary.owner_id and guid and str(apiary.owner_id) == str(guid))


def candidate_group_paths(paths) -> set:
    """Every group a holder of `paths` belongs to: the paths and their ancestors."""
    candidates = set()
    for path in paths:
        segments = path.strip('/').split('/')
        for depth in range(1, len(segments) + 1):
            candidates.add('/' + '/'.join(segments[:depth]))
    return candidates


def has_apiary_permission(request, apiary, perm: str) -> bool:
    """`perm` is READ, UPDATE or DELETE."""
    user = _authenticated(request)
    if user is None:
        return False
    if is_platform_admin(user) or is_apiary_owner(user, apiary):
        return True
    paths = membership_paths(request)
    # Iterated in Python so the grants prefetched by the viewset are reused
    return any(
        getattr(grant, _FLAG[perm]) and is_member_of(paths, grant.group.path)
        for grant in apiary.apiarygrouppermission_set.all()
    )


def readable_apiaries_q(request) -> Q:
    """Filter of the apiaries the requester may see (admins: everything)."""
    user = _authenticated(request)
    if user is None:
        return Q(pk__in=[])
    if is_platform_admin(user):
        return Q()
    shared = ApiaryGroupPermission.objects.filter(
        can_read=True, group__path__in=candidate_group_paths(membership_paths(request)),
    ).values('apiary_id')
    return Q(owner__guid=getattr(user, 'guid', None)) | Q(pk__in=shared)


def can_share_apiary(request, apiary) -> bool:
    """Choosing which groups see an apiary: its owner or a platform admin."""
    user = _authenticated(request)
    return bool(user and (is_platform_admin(user) or is_apiary_owner(user, apiary)))


def association_path(path: str):
    """
    The association a group path stands for, or None.

    `/beekeepers/ena/admin` stands for `/beekeepers/ena`; a top-level group
    such as `/beekeepers` gathers every user of a role and is not an
    association one shares an apiary with.
    """
    segments = path.strip('/').split('/')
    if ADMIN_SEGMENT in segments[1:]:
        segments = segments[:segments.index(ADMIN_SEGMENT, 1)]
    return '/' + '/'.join(segments) if len(segments) >= 2 else None


def allowed_share_groups(request, apiary):
    """
    Group paths the requester may share this apiary with: the owner's
    associations. `None` means any group (platform admin).
    """
    user = _authenticated(request)
    if user is None or not can_share_apiary(request, apiary):
        return set()
    if is_platform_admin(user):
        return None
    return {p for p in map(association_path, owner_group_paths(apiary.owner)) if p}
