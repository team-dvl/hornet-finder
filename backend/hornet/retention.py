"""
Retention of the observations: an archived hornet sighting or nest is kept
`OBSERVATIONS_RETENTION_DAYS` (5 years) from the day it was reported, then
deleted for good. Only archived ones go: archiving is the administrators'
decision that a season is closed, and nothing still open is ever deleted here.
A nest takes its journal and its photos (files included) with it.
"""

import datetime
import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .images import delete_files
from .models import Hornet, Nest, NestPhoto

logger = logging.getLogger(__name__)


def purge_archived(now=None, dry_run=False) -> dict:
    """Delete the archived hornets and nests past the retention. Idempotent; returns the counts."""
    now = now or timezone.now()
    cutoff = now - datetime.timedelta(days=settings.OBSERVATIONS_RETENTION_DAYS)
    hornets = Hornet.objects.filter(archived=True, created_at__lt=cutoff)
    nests = Nest.objects.filter(archived=True, created_at__lt=cutoff)
    result = {'hornets': hornets.count(), 'nests': nests.count()}
    if dry_run or not (result['hornets'] or result['nests']):
        return result
    photos = list(NestPhoto.objects.filter(nest__in=nests))
    with transaction.atomic():
        hornets.delete()
        nests.delete()
    for photo in photos:
        delete_files(photo.image, photo.thumbnail)
    logger.info("Observations retention: %s", result)
    return result
