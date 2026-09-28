"""API of the statistics: the catalogue, one statistic's table, its files."""

import logging

from django.core import signing
from django.http import HttpResponse
from django.urls import reverse
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication

from .base import REGISTRY, ROLES, Scope, StatError, catalogue
from .render import FORMATS, filename, render

logger = logging.getLogger(__name__)

# A file link carries the query and the requester's rights, signed: it opens
# without the JWT, so a phone can hand it to its own viewer or spreadsheet
EXPORT_SALT = 'hornet.stats.export'
EXPORT_LINK_SECONDS = 15 * 60
PARAMETERS = ('period', 'season', 'year', 'from', 'to', 'granularity', 'compare',
              'trap_type', 'group', 'mine', 'lat', 'lon', 'radius', 'bbox', 'reach', 'bandwidth', 'order')


def error_response(exc: StatError) -> Response:
    return Response({'error': str(exc)}, status=exc.status)


class StatsView(APIView):
    """Reserved to signed-in users (any role)."""

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        return [HasAnyRole(list(ROLES))]

    @staticmethod
    def statistic_for(stat_id: str, scope: Scope):
        statistic = REGISTRY.get(stat_id)
        if statistic is None:
            raise StatError("Statistique inconnue.", status=404)
        if not statistic.visible_to(scope):
            raise StatError("Cette statistique ne vous est pas ouverte.", status=403)
        return statistic


class StatsCatalogueView(StatsView):
    @extend_schema(responses={200: OpenApiResponse(description='Statistics the caller may open')})
    def get(self, request):
        return Response(catalogue(Scope.from_request(request)))


class StatDetailView(StatsView):
    @extend_schema(responses={200: OpenApiResponse(description='Table of the statistic'),
                              400: OpenApiResponse(description='Invalid parameter')})
    def get(self, request, stat_id):
        scope = Scope.from_request(request)
        try:
            statistic = self.statistic_for(stat_id, scope)
            return Response(statistic.compute(request.query_params, scope))
        except StatError as exc:
            return error_response(exc)


class StatExportLinkView(StatsView):
    @extend_schema(
        request={'application/json': {'type': 'object', 'properties': {
            'format': {'type': 'string', 'enum': list(FORMATS)},
            'params': {'type': 'object', 'description': 'Same parameters as the table'}}}},
        responses={200: OpenApiResponse(description='Signed link to the file (url, filename, '
                                                    'expires_in)'),
                   400: OpenApiResponse(description='Invalid format or parameter')})
    def post(self, request, stat_id):
        scope = Scope.from_request(request)
        fmt = request.data.get('format')
        raw = request.data.get('params') or {}
        if fmt not in FORMATS:
            return Response({'error': f"Format inconnu : {fmt}."}, status=400)
        if not isinstance(raw, dict):
            return Response({'error': "Paramètres invalides."}, status=400)
        params = {key: str(raw[key]) for key in PARAMETERS if raw.get(key) not in (None, '')}
        try:
            statistic = self.statistic_for(stat_id, scope)
            # Computed once here, so a bad parameter fails now and not in the viewer
            result = statistic.compute(params, scope)
        except StatError as exc:
            return error_response(exc)
        token = signing.dumps({'stat': stat_id, 'format': fmt, 'params': params,
                               'scope': scope.as_dict()}, salt=EXPORT_SALT, compress=True)
        return Response({'url': reverse('stats-export-file', args=[token]),
                         'filename': filename(result, fmt), 'expires_in': EXPORT_LINK_SECONDS})


def _text_response(message: str, status: int) -> HttpResponse:
    return HttpResponse(message, status=status, content_type='text/plain; charset=utf-8')


def stat_export_file(request, token):
    """
    The file behind an export link. No JWT here: the signature stands for the
    rights of the requester when the link was made, which the statistic
    computes with.
    """
    try:
        payload = signing.loads(token, salt=EXPORT_SALT, max_age=EXPORT_LINK_SECONDS)
    except signing.SignatureExpired:
        return _text_response("Ce lien d'export a expiré : relancez l'export depuis Velutina.", 410)
    except signing.BadSignature:
        logger.warning("Forged statistics export link from %s", request.META.get('REMOTE_ADDR'))
        return _text_response("Lien invalide.", 404)
    statistic = REGISTRY.get(payload.get('stat'))
    scope = Scope.from_dict(payload.get('scope', {}))
    fmt = payload.get('format')
    if statistic is None or fmt not in FORMATS or not statistic.visible_to(scope):
        return _text_response("Lien invalide.", 404)
    try:
        result = statistic.compute(payload.get('params', {}), scope)
    except StatError as exc:
        return _text_response(str(exc), exc.status)
    response = HttpResponse(render(result, fmt), content_type=FORMATS[fmt])
    response['Content-Disposition'] = f'attachment; filename="{filename(result, fmt)}"'
    response['Cache-Control'] = 'private, no-store'
    return response
