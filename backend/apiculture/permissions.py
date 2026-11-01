"""
Access rules of the hives.

* Managers: a platform admin, the owner (a person), or an administrator of the
  owning association. They hand the hive over to a keeper, retire it, delete it.
* The keeper, to whom the hive is entrusted, does what is done on the spot:
  edit it, move it to another apiary, store it.
* Readers: the managers and the keeper, the members of the owning association,
  and those who see the apiary where the hive stands (`apiary_permissions`).

Placing a hive in an apiary also needs the right to update that apiary.
Group membership follows the prefix rule of `trap_permissions`.
"""

from django.db.models import Q

from hornet import apiary_permissions as apiary_perms
from hornet.apiary_permissions import candidate_group_paths
from hornet.models import Apiary
from hornet.trap_permissions import (
    is_beekeeper_group, is_group_admin_of, is_member_of, is_platform_admin, member_group_paths,
    membership_paths,
)


def _user(request):
    user = getattr(request, 'user', None)
    return user if user is not None and getattr(user, 'is_authenticated', False) else None


def _is(guid, user_id) -> bool:
    return bool(guid and user_id and str(user_id) == str(guid))


def can_manage_hive(request, hive) -> bool:
    user = _user(request)
    if user is None:
        return False
    if is_platform_admin(user) or _is(getattr(user, 'guid', None), hive.owner_user_id):
        return True
    return bool(hive.owner_group_id
                and is_group_admin_of(membership_paths(request), hive.owner_group.path))


def is_keeper(request, hive) -> bool:
    user = _user(request)
    return user is not None and _is(getattr(user, 'guid', None), hive.keeper_id)


def can_tend_hive(request, hive) -> bool:
    """Edit, move or store the hive: its managers and its keeper."""
    return can_manage_hive(request, hive) or is_keeper(request, hive)


def can_read_hive(request, hive) -> bool:
    if can_tend_hive(request, hive):
        return True
    if hive.owner_group_id and is_member_of(membership_paths(request), hive.owner_group.path):
        return True
    return bool(hive.apiary_id and apiary_perms.has_apiary_permission(
        request, hive.apiary, apiary_perms.READ))


def readable_hives_q(request) -> Q:
    """Filter of the hives the requester may see (platform admins: every hive)."""
    user = _user(request)
    if user is None:
        return Q(pk__in=[])
    if is_platform_admin(user):
        return Q()
    guid = getattr(user, 'guid', None)
    paths = candidate_group_paths(membership_paths(request))
    return (Q(owner_user_id=guid) | Q(keeper_id=guid) | Q(owner_group__path__in=paths)
            | Q(apiary__in=Apiary.objects.filter(apiary_perms.readable_apiaries_q(request)).values('pk')))


def can_place_in(request, apiary) -> bool:
    """Hives go into an apiary its owner, a platform admin or an updating group maintains."""
    return apiary_perms.has_apiary_permission(request, apiary, apiary_perms.UPDATE)


def owner_group_choices(request):
    """
    Associations a new hive may belong to: those the requester is a member of,
    or `None` (any) for a platform admin.
    """
    user = _user(request)
    if user is not None and is_platform_admin(user):
        return None
    return sorted(path for path in member_group_paths(request) if is_beekeeper_group(path))


def keeper_groups(request, hive):
    """
    Associations whose members the hive may be entrusted to: the owning one, or
    for a hive owned by a person, those of the requester (`None`: any, for a
    platform admin).
    """
    if hive.owner_group_id:
        return [hive.owner_group.path]
    return owner_group_choices(request)
