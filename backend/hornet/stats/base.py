"""
Shared pieces of the statistics: who asks (Scope), which traps a statistic
counts, and the registry the API serves.

Two regimes decide which traps are counted, because a trap often stands at an
apiary and apiaries are kept from non-beekeepers:

* a result that locates nothing (totals over the whole territory) counts every
  trap, private ones and apiary-bound types included;
* a result that locates traps, which includes any total restricted to a zone
  (comparing it with and without a small circle would reveal a private trap),
  counts only the traps the requester can already see on the map.

Platform admins see every trap in both.
"""

from dataclasses import dataclass, field
from types import SimpleNamespace

from django.conf import settings
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D

from .. import trap_permissions as perms
from ..models import BeekeeperGroup, Trap, TrapType

ROLES = ('admin', 'volunteer', 'beekeeper')
MAX_RADIUS_KM = 50


class StatError(ValueError):
    """A request the statistics refuse; the message is for the UI."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


@dataclass
class Scope:
    """The requester's rights, as the JWT gave them, so an export link made now
    computes later with exactly the same rights."""
    guid: str
    roles: list = field(default_factory=list)
    membership: list = field(default_factory=list)

    @classmethod
    def from_request(cls, request) -> 'Scope':
        user = request.user
        return cls(str(getattr(user, 'guid', '') or ''), list(getattr(user, 'roles', []) or []),
                   list(perms.membership_paths(request)))

    @classmethod
    def from_dict(cls, data: dict) -> 'Scope':
        return cls(data.get('guid', ''), list(data.get('roles', [])), list(data.get('membership', [])))

    def as_dict(self) -> dict:
        return {'guid': self.guid, 'roles': self.roles, 'membership': self.membership}

    @property
    def is_admin(self) -> bool:
        return 'admin' in self.roles

    def as_request(self):
        """A request-like object for the permission helpers of the traps."""
        user = SimpleNamespace(is_authenticated=True, guid=self.guid, roles=self.roles,
                               token_info={'membership': self.membership})
        return SimpleNamespace(user=user)


def _float(params, name: str, message: str) -> float:
    try:
        return float(params.get(name))
    except (TypeError, ValueError):
        raise StatError(message)


@dataclass
class TrapSelection:
    queryset: object
    localized: bool
    filters: list  # human-readable description of the filters applied

    def scope_dict(self) -> dict:
        return {'kind': 'visible' if self.localized else 'all',
                'label': 'Pièges visibles par vous' if self.localized else 'Tous les pièges',
                'traps': self.queryset.count()}


def select_traps(params, scope: Scope, always_localized: bool = False) -> TrapSelection:
    """The traps a statistic counts, after the filters and the access regime."""
    queryset = Trap.objects.all()
    filters = []

    slug = params.get('trap_type')
    if slug:
        trap_type = TrapType.objects.filter(slug=slug).first()
        if trap_type is None:
            raise StatError(f"Type de piège inconnu : {slug}.")
        queryset = queryset.filter(trap_type=trap_type)
        filters.append(f"Type : {trap_type.name}")

    path = params.get('group')
    if path:
        if not scope.is_admin and path not in perms.member_group_paths(scope.as_request()):
            raise StatError("Ce groupe n'est pas l'un des vôtres.", status=403)
        group = BeekeeperGroup.objects.filter(path=path).first()
        queryset = queryset.filter(group__path=path)
        filters.append(f"Groupe : {group.name if group else path}")

    if params.get('mine') in ('true', '1', True):
        queryset = queryset.filter(owner__guid=scope.guid)
        filters.append("Mes pièges")

    localized = always_localized
    if params.get('lat') or params.get('lon') or params.get('radius'):
        lat = _float(params, 'lat', "Zone : latitude invalide.")
        lon = _float(params, 'lon', "Zone : longitude invalide.")
        radius = _float(params, 'radius', "Zone : rayon invalide.")
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise StatError("Zone : position hors limites.")
        if not 0 < radius <= MAX_RADIUS_KM:
            raise StatError(f"Zone : rayon de {MAX_RADIUS_KM} km au plus.")
        queryset = queryset.filter(point__distance_lte=(Point(lon, lat, srid=4326), D(km=radius)))
        filters.append(f"Zone : {radius:g} km autour de {lat:.4f}, {lon:.4f}")
        localized = True

    if localized:
        queryset = perms.readable_traps(scope.as_request(), queryset)
    return TrapSelection(queryset, localized, filters)


class Statistic:
    """One entry of the catalogue. Subclasses define `compute`."""
    id = ''
    title = ''
    description = ''
    # Parameters the page offers for this statistic
    filters = ('period', 'trap_type', 'group', 'mine', 'zone')
    required_roles = ROLES
    # 'table' (rows over time or by group) or 'map' (cells of a grid)
    kind = 'table'
    # Place in the catalogue
    position = 100
    # Files it can be exported to (a map has no PDF: its cells need the map)
    exports = ('xlsx', 'pdf', 'csv')

    def visible_to(self, scope: Scope) -> bool:
        return any(role in scope.roles for role in self.required_roles)

    def describe(self) -> dict:
        return {'id': self.id, 'title': self.title, 'description': self.description,
                'kind': self.kind, 'filters': list(self.filters), 'exports': list(self.exports),
                # Whether a link to the files can be emailed (an SMTP server is configured)
                'email_link': bool(getattr(settings, 'EMAIL_CONFIGURED', False))}

    def compute(self, params, scope: Scope, today=None) -> dict:  # pragma: no cover
        raise NotImplementedError


REGISTRY: dict = {}


def register(statistic_class):
    statistic = statistic_class()
    REGISTRY[statistic.id] = statistic
    return statistic_class


def catalogue(scope: Scope) -> list:
    statistics = sorted(REGISTRY.values(), key=lambda stat: stat.position)
    return [stat.describe() for stat in statistics if stat.visible_to(scope)]
