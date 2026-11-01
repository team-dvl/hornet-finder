"""
What waits for the requester, module by module: the count behind the red
badge on a module's tile (landing page) and menu entry. One function per
module, by the same rule as the module's own first tab, so the badge and the
tab always agree:

* `traps`: the reminders due today on the requester's own traps ("À relever",
  see hornet/reminders.py);
* `nests`: the nests of the season to verify or to destroy (coordinators) and
  the active ones near the requester's apiaries ("À traiter").

A module with nothing that can wait for anyone has no entry. A new module
whose users may have something to do adds its function to `COUNTERS`, and
the frontend shows it (`utils/pending.ts`).
"""

from django.contrib.gis.measure import D
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response

from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication
from hornet_finder_api.roles import APP_ROLES

from . import nest_permissions as nest_perms
from . import reminders
from .models import Apiary, Nest, Trap

# Sections of "À traiter" that call for an action (the requester's own reports only wait)
NEST_WAITING = ('to_verify', 'confirmed', 'near_apiaries')


def season_nests(queryset=None):
    """The nests of the season under way: the current year, not archived."""
    queryset = Nest.objects.all() if queryset is None else queryset
    return queryset.filter(created_at__year=timezone.localdate().year, archived=False)


def nest_todo(request, season) -> dict:
    """The sections of "À traiter" (querysets), only those that concern the requester."""
    guid = getattr(request.user, 'guid', None)
    sections = {}
    if nest_perms.is_nest_manager(request):
        sections['to_verify'] = season.filter(status=Nest.STATUS_REPORTED).order_by('created_at', 'id')
        sections['confirmed'] = season.filter(status=Nest.STATUS_CONFIRMED).order_by('last_event_at', 'id')
    apiaries = Apiary.objects.filter(owner__guid=guid, point__isnull=False)
    if nest_perms.sees_all_nests(request) and apiaries.exists():
        near = Q()
        for apiary in apiaries:
            near |= Q(point__distance_lte=(apiary.point, D(m=nest_perms.NEARBY_APIARY_RADIUS_M)))
        sections['near_apiaries'] = (season.filter(status__in=Nest.OPEN_STATUSES).filter(near)
                                     .order_by('-created_at', '-id'))
    sections['mine'] = season.filter(owner__guid=guid).order_by('-created_at', '-id')
    return sections


def nests(request) -> int:
    sections = nest_todo(request, season_nests())
    # A nest can sit in several sections (reported AND near an apiary): it counts once
    waiting = set()
    for name in NEST_WAITING:
        if name in sections:
            waiting.update(sections[name].values_list('pk', flat=True))
    return len(waiting)


def traps(request) -> int:
    guid = getattr(request.user, 'guid', None)
    return len(reminders.due_for(Trap.objects.filter(owner__guid=guid), timezone.localdate()))


COUNTERS = {'traps': traps, 'nests': nests}


class _AnyAppRole(HasAnyRole):
    """`permission_classes` takes classes: `HasAnyRole` bound to every role of the app."""

    def __init__(self):
        super().__init__(list(APP_ROLES))


@extend_schema(responses={200: OpenApiResponse(
    description="Number of things waiting for the requester, by module: `{\"traps\": 2, \"nests\": 3}`")})
@api_view(['GET'])
@authentication_classes([JWTBearerAuthentication])
@permission_classes([_AnyAppRole])
def pending_view(request):
    """What waits for the requester in each module: the badges of the landing tiles and of the menu."""
    return Response({name: counter(request) for name, counter in COUNTERS.items()})
