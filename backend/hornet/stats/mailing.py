"""
Statistics exports sent by email: a link to a download page, valid one hour
and ten downloads, which computes the file when it is asked for.

The link carries a random token; the database only keeps its SHA-256, the
parameters (sliding periods frozen to their dates) and the rights of the
requester. The email address comes from the JWT and is not stored.
"""

import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from django.utils.html import format_html, format_html_join
from django.utils.safestring import mark_safe

from ..emails import BrandedEmail
from ..models import StatExportJob
from .base import StatError
from .render import GRANULARITY_LABELS

logger = logging.getLogger(__name__)

JOB_LIFETIME = timedelta(hours=1)
MAX_DOWNLOADS = 10
# Emails a person may ask for in an hour
MAX_JOBS_PER_HOUR = 5


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def mask_email(address: str) -> str:
    """e•••@gmail.com: enough to recognise one's address, not to harvest it."""
    local, _, domain = address.partition('@')
    return f"{local[:1]}•••@{domain}" if domain else '•••'


def requester_name(token_info: dict) -> str:
    name = token_info.get('name') or ' '.join(
        part for part in (token_info.get('given_name'), token_info.get('family_name')) if part)
    return (name or token_info.get('preferred_username') or '')[:150]


def _hour(moment) -> str:
    return timezone.localtime(moment).strftime('%H:%M')


def summary(result: dict) -> list:
    """What the download page and the email say about the export."""
    period = result['period']
    # Free dates are their own label: named once
    dates = period['dates'] if period['label'] == period['dates'] else f"{period['label']} ({period['dates']})"
    lines = [('Période', dates)]
    if result.get('granularity'):
        lines.append(('Granularité', GRANULARITY_LABELS[result['granularity']]))
    lines.append(('Filtres', ', '.join(result['filters']) or 'Aucun'))
    lines.append(('Pièges comptés', f"{result['scope']['label']} : {result['scope']['traps']}"))
    return lines


def purge_expired():
    StatExportJob.objects.filter(expires_at__lt=timezone.now()).delete()


def create_job(statistic, params: dict, scope, result: dict, token_info: dict) -> tuple:
    """Record a job and return it with its token (the only copy of it)."""
    purge_expired()
    # Every job still stored is less than an hour old
    if StatExportJob.objects.filter(requester=scope.guid).count() >= MAX_JOBS_PER_HOUR:
        raise StatError(f"{MAX_JOBS_PER_HOUR} envois par heure au plus : réessayez plus tard.", status=429)
    token = secrets.token_urlsafe(32)
    job = StatExportJob.objects.create(
        token_hash=token_hash(token), statistic=statistic.id, params=params, scope=scope.as_dict(),
        summary=[list(line) for line in summary(result)], requester=scope.guid,
        requester_name=requester_name(token_info), expires_at=timezone.now() + JOB_LIFETIME)
    return job, token


def job_url(token: str) -> str:
    return f"https://{settings.PUBLIC_HOST}/export/{token}"


def send_link(job: StatExportJob, token: str, title: str, address: str):
    url = job_url(token)
    asked, until = _hour(job.created_at), _hour(job.expires_at)
    details = [value for label, value in job.summary if label in ('Période', 'Granularité')]
    details += [f"Filtres : {value}" for label, value in job.summary if label == 'Filtres' and value != 'Aucun']
    subject = f"Votre export « {title} »"
    text = (
        f"Bonjour,\n\n"
        f"Voici le lien vers l'export demandé à {asked} :\n\n"
        f"{title}\n" + '\n'.join(details) + "\n\n"
        f"{url}\n\n"
        f"Le lien est valable jusqu'à {until}. Il donne accès à ces données sans connexion : "
        f"ne transférez pas cet email.\n\n"
        f"Vous n'avez rien demandé ? Ignorez ce message, le lien expirera seul.\n"
    )
    html = format_html(
        '<p>Bonjour,</p>'
        "<p>Voici le lien vers l'export demandé à {} :</p>"
        '<p><strong>{}</strong><br>{}</p>'
        '<p><a href="{}">Ouvrir l\'export</a></p>'
        "<p>Le lien est valable jusqu'à {}. Il donne accès à ces données sans connexion : "
        'ne transférez pas cet email.</p>'
        '<p style="color:#7a8177; font-size:13px;">Vous n\'avez rien demandé ? Ignorez ce message, '
        'le lien expirera seul.</p>',
        asked, title, format_html_join(mark_safe('<br>'), '{}', ((d,) for d in details)), url, until,
    )
    # In the layout of the Keycloak emails, like the group invitations
    BrandedEmail(subject, text, html, [address]).send()
    logger.info("Statistics export %s sent by email for %s", job.statistic, job.requester)


def find_job(token: str):
    """(job, None) for a live job, else (None, (message, status))."""
    job = StatExportJob.objects.filter(token_hash=token_hash(token)).first()
    if job is None:
        return None, ("Lien invalide.", 404)
    if job.expires_at <= timezone.now():
        return None, ("Un lien d'export sert une heure : relancez l'export depuis la statistique.", 410)
    if job.downloads >= MAX_DOWNLOADS:
        return None, (f"Il a déjà servi {MAX_DOWNLOADS} fois : relancez l'export depuis la statistique.", 410)
    return job, None
