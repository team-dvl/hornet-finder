"""
Image processing for the user-uploaded photos (traps, apiaries, nests, profile photos).

Photos come from phones and weigh several MB; the frontend already resizes
them, this module is the server-side counterpart: it validates the upload,
normalises the orientation and stores a JPEG plus a thumbnail.
"""

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework.exceptions import ValidationError as DRFValidationError

MAX_SIDE = 1600
THUMBNAIL_SIDE = 320
AVATAR_SIDE = 256
JPEG_QUALITY = 85


def validate_image_upload(uploaded) -> None:
    """Reject files that are too large or are not decodable images."""
    max_size = getattr(settings, 'MAX_UPLOAD_SIZE', 10 * 1024 * 1024)
    if uploaded.size > max_size:
        raise ValidationError(
            f"Image too large: maximum {max_size // (1024 * 1024)} MB."
        )
    try:
        # verify() consumes the file object, so it is only used as a check
        Image.open(uploaded).verify()
    except (UnidentifiedImageError, OSError) as exc:
        raise ValidationError("Unsupported or corrupted image file.") from exc
    finally:
        uploaded.seek(0)


def _to_jpeg(uploaded, max_side: int) -> ContentFile:
    """Return a JPEG copy of the upload, no larger than `max_side` on either side."""
    uploaded.seek(0)
    image = Image.open(uploaded)
    # Phones store the orientation in EXIF rather than rotating the pixels
    image = ImageOps.exif_transpose(image)
    if image.mode not in ('RGB', 'L'):
        image = image.convert('RGB')
    image.thumbnail((max_side, max_side), Image.LANCZOS)

    buffer = ContentFile(b'')
    image.save(buffer, format='JPEG', quality=JPEG_QUALITY, optimize=True)
    uploaded.seek(0)
    return buffer


def processed_image(uploaded) -> tuple[str, ContentFile, ContentFile]:
    """
    Validate an uploaded image and return `(basename, full, thumbnail)`.

    The basename is random: uploads keep no client-provided file name, which
    avoids both collisions and path traversal through the original name.
    """
    validate_image_upload(uploaded)
    basename = uuid.uuid4().hex
    return basename, _to_jpeg(uploaded, MAX_SIDE), _to_jpeg(uploaded, THUMBNAIL_SIDE)


def processed_avatar(uploaded) -> tuple[str, ContentFile]:
    """
    Validate an uploaded profile photo and return `(basename, square JPEG)`.

    The photo is cropped to its centred square and scaled to AVATAR_SIDE, the
    size avatars are displayed at (with room for high-density screens).
    """
    validate_image_upload(uploaded)
    uploaded.seek(0)
    image = ImageOps.exif_transpose(Image.open(uploaded))
    if image.mode not in ('RGB', 'L'):
        image = image.convert('RGB')
    image = ImageOps.fit(image, (AVATAR_SIDE, AVATAR_SIDE), Image.LANCZOS)

    buffer = ContentFile(b'')
    image.save(buffer, format='JPEG', quality=JPEG_QUALITY, optimize=True)
    uploaded.seek(0)
    return uuid.uuid4().hex, buffer


def store_photo(target, file_field, thumb_field, uploaded) -> None:
    """Resize an upload and store it in the given image fields of `target` (not saved)."""
    try:
        basename, full, thumbnail = processed_image(uploaded)
    except ValidationError as exc:
        # A rejected upload is a bad request, not a server error
        raise DRFValidationError({'photo': exc.messages}) from exc
    getattr(target, file_field).save(f"{basename}.jpg", full, save=False)
    getattr(target, thumb_field).save(f"{basename}_thumb.jpg", thumbnail, save=False)


def delete_files(*image_fields) -> None:
    """Remove the files backing image fields, ignoring already-missing ones."""
    for field in image_fields:
        if field:
            field.delete(save=False)
