"""
Illustrate the species referential with the lead image of their Wikipedia article.

Each species with a `wikipedia_url` gets the article's main picture (as chosen
by Wikipedia editors), stored like an uploaded photo, plus its author and
licence: Commons pictures are free to reuse only when credited.
"""

import json
import time
from html import unescape
from urllib.parse import quote, unquote, urlencode, urlparse
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils.html import strip_tags

from hornet.images import MAX_SIDE, processed_image
from hornet.models import Species

TIMEOUT = 30
# Wikimedia asks automated clients to go easy on their servers
PAUSE_SECONDS = 1.0


class NoImage(Exception):
    """The article has no usable lead image."""


def _user_agent() -> str:
    # Wikimedia rejects requests without an identifying User-Agent
    return f"HornetFinder/1.0 (https://{settings.TAG_URL_HOST}; species illustrations)"


def _get(url: str) -> bytes:
    request = Request(url, headers={'User-Agent': _user_agent()})
    with urlopen(request, timeout=TIMEOUT) as response:
        return response.read()


def _get_json(url: str) -> dict:
    return json.loads(_get(url))


def _plain(html: str) -> str:
    """Text of an HTML metadata field, on one line."""
    return ' '.join(unescape(strip_tags(html or '')).split())


def _file_name(upload_url: str) -> str:
    """
    Name of the file behind an upload.wikimedia.org URL.

    Large originals are served as a thumbnail, whose last segment is the
    size-prefixed copy: `.../thumb/a/ab/Name.jpg/3840px-Name.jpg`.
    """
    segments = urlparse(upload_url).path.split('/')
    name = segments[-2] if 'thumb' in segments and len(segments) > 2 else segments[-1]
    return unquote(name)


def lead_image(wikipedia_url: str) -> dict:
    """
    Describe the lead image of a Wikipedia article.

    Returns `{'url', 'credit', 'source_url'}`: a download URL no larger than
    MAX_SIDE, the "author — licence" credit and the file description page.
    """
    parsed = urlparse(wikipedia_url)
    if not parsed.path.startswith('/wiki/'):
        raise NoImage(f"not an article URL: {wikipedia_url}")
    base = f"{parsed.scheme or 'https'}://{parsed.netloc}"
    title = unquote(parsed.path[len('/wiki/'):])

    summary = _get_json(f"{base}/api/rest_v1/page/summary/{quote(title, safe='')}")
    original = (summary.get('originalimage') or {}).get('source')
    if not original:
        raise NoImage("the article has no lead image")
    filename = _file_name(original)

    # The article's own wiki resolves Commons files too, and local ones
    query = urlencode({
        'action': 'query', 'format': 'json', 'formatversion': 2,
        'titles': f'File:{filename}', 'prop': 'imageinfo',
        'iiprop': 'url|extmetadata', 'iiurlwidth': MAX_SIDE,
    })
    pages = _get_json(f"{base}/w/api.php?{query}").get('query', {}).get('pages', [])
    info = next((page['imageinfo'][0] for page in pages if page.get('imageinfo')), None)
    if info is None:
        raise NoImage(f"no file information for {filename}")

    metadata = info.get('extmetadata') or {}
    author = _plain((metadata.get('Artist') or {}).get('value')) or 'Auteur inconnu'
    licence = _plain((metadata.get('LicenseShortName') or {}).get('value'))
    credit = ' — '.join(part for part in (author, licence) if part) + ', Wikimedia Commons'
    return {
        'url': info.get('thumburl') or info['url'],
        'credit': credit[:255],
        'source_url': info.get('descriptionurl', '')[:500],
    }


def store_photo(species: Species, content: bytes, credit: str, source_url: str) -> None:
    """Replace the species photo with `content`, resized like an upload."""
    basename, full, thumbnail = processed_image(
        SimpleUploadedFile('wikipedia.jpg', content, content_type='image/jpeg'),
    )
    for field in (species.photo, species.photo_thumbnail):
        if field:
            field.delete(save=False)
    species.photo.save(f'{basename}.jpg', full, save=False)
    species.photo_thumbnail.save(f'{basename}_thumb.jpg', thumbnail, save=False)
    species.photo_credit = credit
    species.photo_source_url = source_url
    species.save(update_fields=['photo', 'photo_thumbnail', 'photo_credit', 'photo_source_url'])


class Command(BaseCommand):
    help = ("Download the lead image of each species' Wikipedia article, with its "
            "credit. Species that already have a photo are left alone unless --force.")

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                            help="Replace existing photos, including ones uploaded by an admin.")
        parser.add_argument('--slug', action='append', default=[],
                            help="Only this species (repeatable).")

    def handle(self, *args, **options):
        species_list = Species.objects.exclude(wikipedia_url='')
        if options['slug']:
            species_list = species_list.filter(slug__in=options['slug'])
        if not options['force']:
            species_list = species_list.filter(Q(photo='') | Q(photo__isnull=True))

        done, missing, failed = 0, 0, 0
        for index, species in enumerate(species_list):
            if index:
                time.sleep(PAUSE_SECONDS)
            try:
                image = lead_image(species.wikipedia_url)
                store_photo(species, _get(image['url']), image['credit'], image['source_url'])
            except NoImage as exc:
                missing += 1
                self.stdout.write(self.style.WARNING(f"{species.slug}: {exc}"))
            except (OSError, ValueError, KeyError, ValidationError) as exc:
                # OSError covers the network errors (URLError, HTTPError, timeouts)
                failed += 1
                self.stderr.write(self.style.ERROR(f"{species.slug}: {exc}"))
            else:
                done += 1
                self.stdout.write(f"{species.slug}: {image['credit']}")

        self.stdout.write(self.style.SUCCESS(
            f"{done} photo(s) stored, {missing} without image, {failed} error(s)."
        ))
