"""
Permission-checked delivery of the uploaded media.

Nothing under MEDIA_ROOT is exposed by nginx directly: the files of a trap
restricted to a group must stay invisible to everyone else, and a URL is not a
secret. Every file therefore goes through this view, which resolves the trap
from the path, applies the same rules as the API, and then hands the transfer
back to nginx through X-Accel-Redirect (the `/_media/` location is `internal`).
"""

import posixpath
import re

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from drf_spectacular.utils import OpenApiResponse, extend_schema

from hornet_finder_api.authentication import JWTBearerAuthentication

from . import trap_permissions as perms
from .models import Trap

# Files of a trap live under `traps/<trap id>/`, which is what makes the
# permission check possible from the path alone.
TRAP_FILE_RE = re.compile(r'^traps/(?P<trap_id>\d+)/[^/]+$')
# Profile photos are public too: the Keycloak account console loads them
# without any token, and their file names are random.
PUBLIC_PREFIXES = ('trap-types/', 'species/', 'avatars/')


def _is_safe(path: str) -> bool:
    """Reject anything that could escape MEDIA_ROOT."""
    normalised = posixpath.normpath(path)
    return not (path.startswith('/') or normalised.startswith('..') or normalised != path)


@extend_schema(
    responses={200: OpenApiResponse(description='The media file'),
               403: OpenApiResponse(description='Not allowed to see this file'),
               404: OpenApiResponse(description='Unknown file')},
)
@api_view(['GET'])
@authentication_classes([JWTBearerAuthentication])
@permission_classes([])
def media_view(request, path):
    """Serve an uploaded file if the requester is allowed to see it."""
    if not _is_safe(path):
        raise Http404

    if not path.startswith(PUBLIC_PREFIXES):
        match = TRAP_FILE_RE.match(path)
        if not match:
            raise Http404
        trap = Trap.objects.select_related('group', 'owner').filter(
            pk=match.group('trap_id')
        ).first()
        if trap is None:
            raise Http404
        if not perms.can_read_trap(request, trap):
            # 404 rather than 403: the existence of the file is itself private
            raise Http404

    full_path = settings.MEDIA_ROOT / path
    if not full_path.is_file():
        raise Http404

    if not getattr(settings, 'MEDIA_USE_X_ACCEL', True):
        # Only for a bare `manage.py runserver`, with no nginx in front. Both
        # the dev and the prod stacks go through nginx, so they take the same
        # path and the accel handover is exercised in dev too.
        return FileResponse(open(full_path, 'rb'))

    response = HttpResponse(status=200)
    response['X-Accel-Redirect'] = settings.MEDIA_ACCEL_PREFIX + path
    # Let nginx set the type and length of the file it serves
    del response['Content-Type']
    return response
