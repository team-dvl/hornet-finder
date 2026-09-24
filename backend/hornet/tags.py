"""
Signed QR tags.

A tag value is `base64url(KIDX || RNDX || MAC)` without padding, where

* `KIDX` is one byte: the index of the HMAC key that signed the tag, so keys
  can be rotated (up to 256 of them);
* `RNDX` is 16 random bytes;
* `MAC` is `HMAC-SHA256(key[KIDX], SITEID || KIDX || RNDX)` truncated to
  16 bytes.

33 bytes encode to exactly 44 base64url characters. The configuration comes
from the settings `TAG_HMAC_KEYS` (`index:key,...`, keys in base64url, at least
32 bytes each), `TAG_HMAC_ACTIVE_INDEX` (the key new tags are signed with) and
`TAG_SITE_ID` (a stable site identifier, so tags of one site are worthless on
another). Removing a key from the configuration invalidates every tag it
signed at once.
"""

import base64
import binascii
import functools
import hashlib
import hmac
import io
import re
import secrets
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import segno
from django.conf import settings

RANDOM_BYTES = 16
MAC_BYTES = 16
RAW_BYTES = 1 + RANDOM_BYTES + MAC_BYTES
VALUE_LENGTH = 44
MIN_KEY_BYTES = 32
VALUE_PATTERN = re.compile(r'^[A-Za-z0-9_-]{44}$')


class TagConfigurationError(Exception):
    """Raised when the tag keys or the site identifier are missing or invalid."""


@dataclass(frozen=True)
class TagConfig:
    keys: dict
    active_index: int
    site_id: bytes


def _b64decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + '=' * (-len(text) % 4))


def parse_keys(spec: str) -> dict:
    """Parse `index:key,index:key` into `{index: key_bytes}`."""
    keys = {}
    for item in filter(None, (part.strip() for part in (spec or '').split(','))):
        index_text, sep, key_text = item.partition(':')
        if not sep:
            raise TagConfigurationError(f"TAG_HMAC_KEYS entry without an index: '{index_text[:4]}…'")
        try:
            index = int(index_text)
        except ValueError:
            raise TagConfigurationError(f"TAG_HMAC_KEYS index is not a number: '{index_text}'")
        if not 0 <= index <= 255:
            raise TagConfigurationError(f"TAG_HMAC_KEYS index out of range 0..255: {index}")
        if index in keys:
            raise TagConfigurationError(f"TAG_HMAC_KEYS index used twice: {index}")
        try:
            key = _b64decode(key_text.strip())
        except (binascii.Error, ValueError):
            raise TagConfigurationError(f"TAG_HMAC_KEYS key {index} is not valid base64url")
        if len(key) < MIN_KEY_BYTES:
            raise TagConfigurationError(
                f"TAG_HMAC_KEYS key {index} is too short ({len(key)} bytes, {MIN_KEY_BYTES} required)"
            )
        keys[index] = key
    return keys


def get_config() -> TagConfig:
    """
    Tag configuration read from the settings.

    Parsed on each call (a handful of keys at most), so tests can override
    the settings freely.
    """
    keys = parse_keys(getattr(settings, 'TAG_HMAC_KEYS', ''))
    if not keys:
        raise TagConfigurationError("TAG_HMAC_KEYS is not set. Please configure it in your .env file.")
    site_id = getattr(settings, 'TAG_SITE_ID', '')
    if not site_id:
        raise TagConfigurationError("TAG_SITE_ID is not set. Please configure it in your .env file.")
    active_text = str(getattr(settings, 'TAG_HMAC_ACTIVE_INDEX', '')).strip()
    try:
        active_index = int(active_text)
    except ValueError:
        raise TagConfigurationError("TAG_HMAC_ACTIVE_INDEX is not set or not a number.")
    if active_index not in keys:
        raise TagConfigurationError(f"TAG_HMAC_ACTIVE_INDEX {active_index} has no key in TAG_HMAC_KEYS.")
    return TagConfig(keys=keys, active_index=active_index, site_id=site_id.encode())


def _mac(key: bytes, site_id: bytes, key_index: int, random_part: bytes) -> bytes:
    message = site_id + bytes([key_index]) + random_part
    return hmac.new(key, message, hashlib.sha256).digest()[:MAC_BYTES]


def generate_tag_value(config: Optional[TagConfig] = None) -> str:
    """A new tag value signed with the active key."""
    config = config or get_config()
    index = config.active_index
    random_part = secrets.token_bytes(RANDOM_BYTES)
    raw = bytes([index]) + random_part + _mac(config.keys[index], config.site_id, index, random_part)
    return base64.urlsafe_b64encode(raw).decode().rstrip('=')


@dataclass(frozen=True)
class Verification:
    valid: bool
    key_index: Optional[int] = None
    reason: str = ''


def verify_tag_value(value: str, config: Optional[TagConfig] = None) -> Verification:
    """Check the format and the signature of a tag value."""
    config = config or get_config()
    if not isinstance(value, str) or not VALUE_PATTERN.match(value):
        return Verification(False, reason='format')
    try:
        raw = _b64decode(value)
    except (binascii.Error, ValueError):
        return Verification(False, reason='format')
    if len(raw) != RAW_BYTES:
        return Verification(False, reason='format')
    index = raw[0]
    key = config.keys.get(index)
    if key is None:
        return Verification(False, key_index=index, reason='unknown key')
    random_part, mac = raw[1:1 + RANDOM_BYTES], raw[1 + RANDOM_BYTES:]
    if not hmac.compare_digest(mac, _mac(key, config.site_id, index, random_part)):
        return Verification(False, key_index=index, reason='signature')
    return Verification(True, key_index=index)


def short_code(value: str) -> str:
    """Human-readable excerpt printed under the QR code (skips the key index)."""
    return value[2:10]


def tag_url(value: str) -> str:
    """The URL encoded in the QR code; opens the app on the tag."""
    return f"https://{settings.TAG_URL_HOST}/tag/{value}"


LOGO_PATH = Path(__file__).resolve().parent / 'assets' / 'tag-logo.png'
# Side of the white plate behind the logo, as a share of the symbol side. With
# error correction Q (25 % of the codewords), a plate of ~7 % of the area
# leaves a wide margin.
LOGO_PLATE_RATIO = 0.25
QR_BORDER = 2


def qr_code(url: str) -> segno.QRCode:
    """
    The QR code of `url`. Level Q (not boosted, so the version stays stable)
    keeps it readable with the logo covering its centre.
    """
    return segno.make(url, error='q', boost_error=False, micro=False)


def logo_plate(qr: segno.QRCode) -> tuple:
    """
    `(offset, size)` in modules, from the symbol's top-left corner (border
    excluded), of the white square that carries the logo. Its size has the
    parity of the symbol side, so it sits exactly on the module grid.
    """
    side = len(qr.matrix)
    size = round(side * LOGO_PLATE_RATIO)
    if size % 2 != side % 2:
        size += 1
    return (side - size) // 2, size


@functools.lru_cache(maxsize=1)
def logo_png() -> tuple:
    """The logo as `(png_bytes, width, height)`."""
    from PIL import Image

    data = LOGO_PATH.read_bytes()
    with Image.open(io.BytesIO(data)) as image:
        return data, image.width, image.height


def logo_box(plate_size: float) -> tuple:
    """`(dx, dy, width, height)` of the logo inside its plate, one module of margin on a 1-module scale."""
    _, width, height = logo_png()
    room = plate_size - 2
    scale = room / max(width, height)
    w, h = width * scale, height * scale
    return (plate_size - w) / 2, (plate_size - h) / 2, w, h


def qr_svg_data_uri(url: str, scale: int = 4) -> str:
    """The QR code of `url`, logo in the middle, as an SVG data URI ready for an <img>."""
    qr = qr_code(url)
    buffer = io.BytesIO()
    qr.save(buffer, kind='svg', scale=scale, border=QR_BORDER, xmldecl=False, nl=False)
    svg = buffer.getvalue().decode()

    offset, size = logo_plate(qr)
    dx, dy, w, h = logo_box(size)
    origin = (QR_BORDER + offset) * scale
    png = base64.b64encode(logo_png()[0]).decode()
    overlay = (
        f'<rect x="{origin}" y="{origin}" width="{size * scale}" height="{size * scale}" fill="#fff"/>'
        f'<image x="{origin + dx * scale:.2f}" y="{origin + dy * scale:.2f}" '
        f'width="{w * scale:.2f}" height="{h * scale:.2f}" '
        f'href="data:image/png;base64,{png}"/>'
    )
    width, height = qr.symbol_size(scale=scale, border=QR_BORDER)
    # A viewBox lets the <img> scale the drawing to the label's width
    svg = svg.replace('<svg ', f'<svg viewBox="0 0 {width} {height}" ', 1)
    svg = svg.replace('</svg>', overlay + '</svg>')
    return 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode()).decode()


def key_usage() -> list:
    """
    Tags per signing key, with the state of each key in the configuration:
    `active`, `configured` or `retired` (its tags no longer verify).
    Keys configured but not used yet are listed too.
    """
    from django.db.models import Count, Q
    from .models import Tag

    try:
        config = get_config()
        configured, active = set(config.keys), config.active_index
    except TagConfigurationError:
        configured, active = set(), None

    def state(index):
        if index == active:
            return 'active'
        return 'configured' if index in configured else 'retired'

    rows = {
        row['key_index']: row
        # order_by(): the model's default ordering would split the GROUP BY
        for row in Tag.objects.order_by().values('key_index').annotate(
            associated=Count('id', filter=Q(trap__isnull=False, revoked_at__isnull=True)),
            free=Count('id', filter=Q(trap__isnull=True, revoked_at__isnull=True)),
            revoked=Count('id', filter=Q(revoked_at__isnull=False)),
        )
    }
    return [
        {
            'index': index,
            'state': state(index),
            'associated': rows.get(index, {}).get('associated', 0),
            'free': rows.get(index, {}).get('free', 0),
            'revoked': rows.get(index, {}).get('revoked', 0),
        }
        for index in sorted(set(rows) | configured)
    ]
