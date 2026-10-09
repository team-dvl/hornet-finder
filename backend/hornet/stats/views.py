"""API of the statistics: the catalogue, one statistic's table, its files
(a signed link for the requester, or a link sent by email)."""

import logging

from django.conf import settings
from django.core import signing
from django.db.models import F
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.urls import reverse
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from audit import recorder as audit
from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication

from . import mailing
from .base import REGISTRY, ROLES, Scope, StatError, catalogue
from .periods import freeze_period
from .render import FORMATS, filename, render

logger = logging.getLogger(__name__)

# A file link carries the query and the requester's rights, signed: it opens
# without the JWT, so a phone can hand it to its own viewer or spreadsheet
EXPORT_SALT = 'hornet.stats.export'
EXPORT_LINK_SECONDS = 15 * 60
PARAMETERS = ('period', 'season', 'year', 'from', 'to', 'granularity', 'compare',
              'trap_type', 'group', 'mine', 'lat', 'lon', 'radius', 'bbox', 'reach', 'bandwidth', 'grid', 'order')


def error_response(exc: StatError) -> Response:
    return Response({'error': str(exc)}, status=exc.status)


def clean_params(raw) -> dict:
    """The parameters of a statistic out of a request body, as strings."""
    if not isinstance(raw, dict):
        raise StatError("Paramètres invalides.")
    return {key: str(raw[key]) for key in PARAMETERS if raw.get(key) not in (None, '')}


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
        try:
            params = clean_params(raw)
            statistic = self.statistic_for(stat_id, scope)
            if fmt not in statistic.exports:
                raise StatError(f"Format non disponible pour cette statistique : {fmt}.")
            # Computed once here, so a bad parameter fails now and not in the viewer
            result = statistic.compute(params, scope)
        except StatError as exc:
            return error_response(exc)
        token = signing.dumps({'stat': stat_id, 'format': fmt, 'params': params,
                               'scope': scope.as_dict()}, salt=EXPORT_SALT, compress=True)
        audit.record(request, 'stats.export_link', ('statistic', stat_id), label=statistic.title,
                     changes={'format': fmt, 'params': params}, refs=[export_ref(token)])
        return Response({'url': reverse('stats-export-file', args=[token]),
                         'filename': filename(result, fmt), 'expires_in': EXPORT_LINK_SECONDS})


def export_ref(token: str) -> str:
    """
    What ties the downloads of an export to its request in the audit trail: a
    digest of the link's token, never the token itself (it opens the file).
    """
    return audit.ref('export', mailing.token_hash(token)[:16])


def _record_download(request, token, statistic, fmt, **details):
    """A file left through a link: no one is signed in, the link stands for the requester."""
    audit.record(request, 'stats.export_downloaded', ('statistic', statistic.id), label=statistic.title,
                 changes={'format': fmt, **details}, refs=[export_ref(token)])


def _text_response(message: str, status: int) -> HttpResponse:
    return HttpResponse(message, status=status, content_type='text/plain; charset=utf-8')


def _file_response(result: dict, fmt: str) -> HttpResponse:
    response = HttpResponse(render(result, fmt), content_type=FORMATS[fmt])
    # A PDF opens in the browser's own viewer (an iOS home-screen app cannot save a download)
    disposition = 'inline' if fmt == 'pdf' else 'attachment'
    response['Content-Disposition'] = f'{disposition}; filename="{filename(result, fmt)}"'
    response['Cache-Control'] = 'private, no-store'
    return response


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
    if statistic is None or fmt not in statistic.exports or not statistic.visible_to(scope):
        return _text_response("Lien invalide.", 404)
    try:
        result = statistic.compute(payload.get('params', {}), scope)
    except StatError as exc:
        return _text_response(str(exc), exc.status)
    _record_download(request, token, statistic, fmt, via='link')
    return _file_response(result, fmt)


class StatEmailLinkView(StatsView):
    @extend_schema(
        request={'application/json': {'type': 'object', 'properties': {
            'params': {'type': 'object', 'description': 'Same parameters as the table'}}}},
        responses={200: OpenApiResponse(description='Sent: masked address (sent_to) and expires_at'),
                   400: OpenApiResponse(description='Invalid parameter, or no verified email'),
                   429: OpenApiResponse(description='Too many emails in the last hour'),
                   503: OpenApiResponse(description='No SMTP server configured')})
    def post(self, request, stat_id):
        if not getattr(settings, 'EMAIL_CONFIGURED', False):
            return Response({'error': "L'envoi d'emails n'est pas configuré sur ce serveur."}, status=503)
        scope = Scope.from_request(request)
        claims = getattr(request.user, 'token_info', {}) or {}
        address = claims.get('email')
        if not address or claims.get('email_verified') is False:
            return Response({'error': "Aucune adresse email vérifiée sur votre compte."}, status=400)
        try:
            params = clean_params(request.data.get('params') or {})
            statistic = self.statistic_for(stat_id, scope)
            # "Last 7 days" means the 7 days before the request, even if opened later
            params = freeze_period(params)
            result = statistic.compute(params, scope)
            job, token = mailing.create_job(statistic, params, scope, result, claims)
        except StatError as exc:
            return error_response(exc)
        try:
            mailing.send_link(job, token, statistic.title, address)
        except Exception as exc:
            # The exception text may quote the recipient: only its type is logged
            logger.warning("Could not email statistics export %s: %s", stat_id, type(exc).__name__)
            job.delete()
            return Response({'error': "L'email n'a pas pu être envoyé : réessayez plus tard."}, status=502)
        audit.record(request, 'stats.export_emailed', ('statistic', stat_id), label=statistic.title,
                     changes={'params': params, 'expires_at': job.expires_at.isoformat()},
                     refs=[export_ref(token)])
        return Response({'sent_to': mailing.mask_email(address), 'expires_at': job.expires_at.isoformat()})


def _job_error(error) -> JsonResponse:
    message, status = error
    return JsonResponse({'error': message}, status=status)


def stat_export_job(request, token):
    """What an emailed link gives: the export described, and its files. No JWT."""
    job, error = mailing.find_job(token)
    if error:
        return _job_error(error)
    statistic = REGISTRY.get(job.statistic)
    if statistic is None:
        return _job_error(("Lien invalide.", 404))
    response = JsonResponse({
        'statistic': {'id': statistic.id, 'title': statistic.title},
        'summary': job.summary,
        'requested_by': job.requester_name,
        'requested_at': timezone.localtime(job.created_at).isoformat(),
        'expires_at': timezone.localtime(job.expires_at).isoformat(),
        'downloads_left': mailing.MAX_DOWNLOADS - job.downloads,
        'formats': [{'format': fmt, 'url': reverse('stats-job-file', args=[token, fmt])}
                    for fmt in statistic.exports],
    })
    response['Cache-Control'] = 'private, no-store'
    return response


def stat_export_job_file(request, token, fmt):
    """A file of an emailed export, computed now with the requester's rights."""
    job, error = mailing.find_job(token)
    if error:
        return _text_response(*error)
    statistic = REGISTRY.get(job.statistic)
    scope = Scope.from_dict(job.scope)
    if statistic is None or fmt not in statistic.exports or not statistic.visible_to(scope):
        return _text_response("Lien invalide.", 404)
    # Counted before computing, atomically: two taps at once cannot pass the limit
    if not type(job).objects.filter(pk=job.pk, downloads__lt=mailing.MAX_DOWNLOADS).update(
            downloads=F('downloads') + 1):
        return _text_response(*mailing.find_job(token)[1])
    try:
        result = statistic.compute(job.params, scope)
    except StatError as exc:
        return _text_response(str(exc), exc.status)
    job.refresh_from_db(fields=['downloads'])
    _record_download(request, token, statistic, fmt, via='email', download=job.downloads)
    return _file_response(result, fmt)
