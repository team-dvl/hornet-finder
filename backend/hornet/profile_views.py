"""
Profile photo of the signed-in user.

The photo is stored like the other uploads (hornet.images, MEDIA_ROOT) under
the public `avatars/` prefix. Its absolute URL is then written to the Keycloak
`picture` attribute, which feeds the standard `picture` claim: the account
console shows it, and the app reads it from the token at the next sign-in.

Without an uploaded photo, the photo of the linked Google/Facebook account is
used instead. The identity provider mappers keep it up to date in the separate
`social_picture` attribute (sync mode Force), exposed as a claim of the access
token: overwriting `picture` directly would erase the uploaded photo at every
social sign-in. The effective photo is copied to `picture` when it differs.
"""

import logging

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import serializers, status
from rest_framework.decorators import (
    api_view, authentication_classes, parser_classes, permission_classes,
)
from rest_framework.exceptions import NotAuthenticated, ValidationError as DRFValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer

from hornet_finder_api.authentication import JWTBearerAuthentication
from hornet_finder_api.utils import set_user_picture

from . import trap_permissions as perms
from .images import processed_avatar

logger = logging.getLogger(__name__)

AvatarSerializer = inline_serializer('Avatar', {'url': serializers.CharField(allow_null=True)})


def public_avatar_url(user) -> str | None:
    """Absolute URL of the user's photo, as handed to Keycloak and to the app."""
    if not user.avatar:
        return None
    return f"https://{settings.PUBLIC_HOST}{settings.MEDIA_URL}{user.avatar.name}"


def _claims(request) -> dict:
    return getattr(request.user, 'token_info', None) or {}


def effective_avatar_url(request, user) -> str | None:
    """The uploaded photo, else the photo of the linked social account."""
    return public_avatar_url(user) or _claims(request).get('social_picture') or None


def _sync_keycloak(user, url) -> None:
    """Mirror the photo URL into Keycloak; a failure there never loses the upload."""
    try:
        set_user_picture(str(user.guid), url)
    except Exception as exc:  # pragma: no cover - network/Keycloak failure
        logger.warning("Could not update the Keycloak picture of %s: %s", user.guid, exc)


@extend_schema(
    methods=['GET', 'DELETE'], request=None, responses={200: AvatarSerializer},
)
@extend_schema(
    methods=['POST'],
    request={'multipart/form-data': {'type': 'object',
                                     'properties': {'photo': {'type': 'string',
                                                              'format': 'binary'}}}},
    responses={200: AvatarSerializer, 400: OpenApiResponse(description='Invalid image')},
)
@api_view(['GET', 'POST', 'DELETE'])
@authentication_classes([JWTBearerAuthentication])
@permission_classes([])
@parser_classes([MultiPartParser])
def my_avatar(request):
    """Read, replace or remove the profile photo of the signed-in user (see the module docstring)."""
    user = perms.local_user(request)
    if user is None:
        raise NotAuthenticated()

    if request.method == 'GET':
        url = effective_avatar_url(request, user)
        # Called by the app at sign-in: brings Keycloak up to date when the
        # social photo appeared or changed since the token's `picture` was set
        if url != (_claims(request).get('picture') or None):
            _sync_keycloak(user, url)
        return Response({'url': url})

    if request.method == 'POST':
        uploaded = request.FILES.get('photo')
        if not uploaded:
            raise DRFValidationError({'photo': "No file received."})
        try:
            basename, image = processed_avatar(uploaded)
        except DjangoValidationError as exc:
            raise DRFValidationError({'photo': exc.messages}) from exc
        previous = user.avatar.name if user.avatar else None
        user.avatar.save(f"{basename}.jpg", image, save=True)
        if previous:
            user.avatar.storage.delete(previous)
    else:
        if user.avatar:
            user.avatar.delete(save=False)
        user.avatar = None
        user.save(update_fields=['avatar'])

    url = effective_avatar_url(request, user)
    _sync_keycloak(user, url)
    return Response({'url': url}, status=status.HTTP_200_OK)
