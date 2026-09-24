"""API of the signed QR tags: generation, resolution and association."""

import logging

from django.db import IntegrityError, transaction
from django.db.models import Exists, OuterRef, Q
from django.http import HttpResponse
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from hornet_finder_api.authentication import HasAnyRole

from . import trap_permissions as perms
from .models import Tag, Trap
from .serializers import TrapSerializer, user_summary
from .tag_pdf import render_sheet
from .tags import (
    TagConfigurationError, generate_tag_value, get_config, key_usage, qr_svg_data_uri,
    short_code, tag_url, verify_tag_value,
)

logger = logging.getLogger(__name__)

MAX_BATCH = 48
MAX_LISTED = 200
MAX_CANDIDATES = 50


def _client_ip(request) -> str:
    # nginx overwrites X-Real-IP, so a client cannot forge it
    return request.META.get('HTTP_X_REAL_IP') or request.META.get('REMOTE_ADDR') or '?'


def _log_rejection(request, value, reason, key_index=None):
    """Security trace of a refused scan: who, from where, which tag."""
    logger.warning(
        "Tag rejected (%s): value=%s key_index=%s user=%s ip=%s",
        reason, str(value)[:12], key_index,
        getattr(request.user, 'guid', None), _client_ip(request),
    )


def _error(code, message, http_status, **extra):
    return Response({'code': code, 'error': message, **extra}, status=http_status)


def _tag_payload(tag) -> dict:
    url = tag_url(tag.value)
    return {
        'value': tag.value,
        'short': tag.short,
        'url': url,
        'qr_svg': qr_svg_data_uri(url),
        'generated_at': tag.generated_at.isoformat() if tag.generated_at else None,
    }


class TagViewSet(viewsets.ViewSet):
    """
    Signed QR tags.

    A scanned value is checked twice: its HMAC signature, then its presence in
    the database. Every refusal is logged on the `hornet.tag_views` logger.
    """

    lookup_field = 'value'
    # Let malformed values reach `retrieve`, so they are logged as such
    lookup_value_regex = '[^/]+'

    def get_permissions(self):
        return [HasAnyRole(['volunteer', 'beekeeper', 'admin'])]

    def handle_exception(self, exc):
        if isinstance(exc, TagConfigurationError):
            logger.error("Tag configuration error: %s", exc)
            return _error('configuration', "Tags are not configured on this server.",
                          status.HTTP_503_SERVICE_UNAVAILABLE)
        return super().handle_exception(exc)

    # -- helpers -------------------------------------------------------------

    def _checked_tag(self, request, value):
        """
        The `Tag` behind a scanned value, or an error `Response`.

        Returns `(tag, None)` or `(None, response)`.
        """
        verification = verify_tag_value(value, get_config())
        if not verification.valid:
            _log_rejection(request, value, f"invalid {verification.reason}", verification.key_index)
            return None, _error('invalid', "This tag is not valid.", status.HTTP_400_BAD_REQUEST)
        tag = Tag.objects.select_related('trap').filter(value=value).first()
        if tag is None:
            # A correct signature on an unknown tag means the key has leaked
            _log_rejection(request, value, "unknown to the database", verification.key_index)
            return None, _error('unknown', "This tag is unknown.", status.HTTP_404_NOT_FOUND)
        if tag.is_revoked:
            logger.info("Revoked tag %s scanned by %s", tag.short, getattr(request.user, 'guid', None))
            return None, _error('revoked', "This tag has been revoked and is no longer valid.",
                                status.HTTP_410_GONE)
        return tag, None

    # -- endpoints -----------------------------------------------------------

    def list(self, request):
        """Free tags: the requester's own ones, or every one for an admin."""
        tags = Tag.objects.filter(revoked_at__isnull=True)
        if request.query_params.get('unassociated') in ('1', 'true'):
            tags = tags.filter(trap__isnull=True)
        if not perms.is_platform_admin(request.user):
            tags = tags.filter(generated_by__guid=getattr(request.user, 'guid', None))
        return Response([_tag_payload(tag) for tag in tags[:MAX_LISTED]])

    @action(detail=False, methods=['post'])
    def batch(self, request):
        """Generate a sheet of free tags, signed with the active key."""
        try:
            count = int(request.data.get('count', 0))
        except (TypeError, ValueError):
            count = 0
        if not 1 <= count <= MAX_BATCH:
            raise DRFValidationError({'count': f"Between 1 and {MAX_BATCH}."})
        config = get_config()
        owner = perms.local_user(request)
        tags = Tag.objects.bulk_create([
            Tag(value=generate_tag_value(config), key_index=config.active_index, generated_by=owner)
            for _ in range(count)
        ])
        logger.info("%s tag(s) generated with key %s by %s",
                    count, config.active_index, getattr(request.user, 'guid', None))
        return Response([_tag_payload(tag) for tag in tags], status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def sheet(self, request):
        """
        PDF sheet of the given tags, to print. Only non-revoked tags are
        printed, and a non-admin only gets their own free ones (as in `list`).
        """
        values = request.data.get('values')
        if not isinstance(values, list) or not 1 <= len(values) <= MAX_LISTED:
            raise DRFValidationError({'values': f"Between 1 and {MAX_LISTED} tag values."})
        tags = Tag.objects.filter(value__in=[str(v) for v in values], revoked_at__isnull=True)
        if not perms.is_platform_admin(request.user):
            tags = tags.filter(trap__isnull=True, generated_by__guid=getattr(request.user, 'guid', None))
        # Keep the order of the request, i.e. the order shown on screen
        by_value = {tag.value: tag for tag in tags}
        printable = [by_value[v] for v in dict.fromkeys(map(str, values)) if v in by_value]
        if not printable:
            return _error('not_found', "None of these tags can be printed.", status.HTTP_400_BAD_REQUEST)
        logger.info("PDF sheet of %s tag(s) printed by %s",
                    len(printable), getattr(request.user, 'guid', None))
        response = HttpResponse(render_sheet(printable), content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="qr-codes.pdf"'
        return response

    def retrieve(self, request, value=None):
        """Resolve a scanned tag: free, or the object it is attached to."""
        tag, error = self._checked_tag(request, value)
        if error:
            return error
        if tag.trap is None:
            return Response({'status': 'unassociated', 'short': tag.short})
        if not perms.can_read_trap(request, tag.trap):
            _log_rejection(request, value, "trap not readable")
            return _error('forbidden', "You cannot see the trap of this tag.",
                          status.HTTP_403_FORBIDDEN)
        return Response({'status': 'associated', 'short': tag.short,
                         'trap': TrapSerializer(tag.trap).data})

    @action(detail=True, methods=['get'])
    def candidates(self, request, value=None):
        """Traps the requester may attach this tag to."""
        tag, error = self._checked_tag(request, value)
        if error:
            return error
        traps = Trap.objects.select_related('trap_type').annotate(
            has_tag=Exists(Tag.objects.filter(trap=OuterRef('pk'), revoked_at__isnull=True)),
        )
        if not perms.is_platform_admin(request.user):
            traps = traps.filter(owner__guid=getattr(request.user, 'guid', None))
        query = request.query_params.get('q', '').strip()
        if query:
            match = Q(address__icontains=query)
            if query.isdigit():
                match |= Q(id=int(query))
            traps = traps.filter(match)
        return Response([
            {
                'id': trap.id,
                'address': trap.address,
                'trap_type': trap.trap_type.name if trap.trap_type_id else None,
                'active': trap.active,
                'has_tag': trap.has_tag,
            }
            for trap in traps.order_by('has_tag', '-created_at')[:MAX_CANDIDATES]
        ])

    @action(detail=True, methods=['post'])
    def associate(self, request, value=None):
        """
        Attach a free tag to a trap.

        When the trap already has a tag, `replace: true` is required: the old
        tag is then revoked in the same transaction.
        """
        tag, error = self._checked_tag(request, value)
        if error:
            return error
        try:
            trap_id = int(request.data.get('trap_id'))
        except (TypeError, ValueError):
            raise DRFValidationError({'trap_id': "A trap id is required."})
        replace = request.data.get('replace') in (True, 'true', '1', 1)

        with transaction.atomic():
            tag = Tag.objects.select_for_update().get(pk=tag.pk)
            if tag.is_revoked or tag.trap_id is not None:
                return _error('already_associated', "This tag is already associated.",
                              status.HTTP_409_CONFLICT)
            trap = Trap.objects.select_for_update().filter(pk=trap_id).first()
            if trap is None:
                return _error('not_found', "Trap not found.", status.HTTP_404_NOT_FOUND)
            if not perms.can_edit_trap(request, trap):
                _log_rejection(request, value, f"association to trap {trap.id} not allowed")
                return _error('forbidden', "You cannot associate a tag with this trap.",
                              status.HTTP_403_FORBIDDEN)

            user = perms.local_user(request)
            now = timezone.now()
            current = Tag.objects.select_for_update().filter(
                trap=trap, revoked_at__isnull=True).first()
            if current is not None:
                if not replace:
                    return _error('trap_has_tag', "This trap already has a tag.",
                                  status.HTTP_409_CONFLICT, existing_short=current.short)
                current.revoked_at, current.revoked_by = now, user
                current.save(update_fields=['revoked_at', 'revoked_by'])
                logger.info("Tag %s of trap %s revoked by %s",
                            current.short, trap.id, getattr(request.user, 'guid', None))

            tag.trap, tag.associated_by, tag.associated_at = trap, user, now
            try:
                # Savepoint: keeps the outer transaction usable if the
                # one-tag-per-trap constraint fires on a concurrent write
                with transaction.atomic():
                    tag.save(update_fields=['trap', 'associated_by', 'associated_at'])
            except IntegrityError:
                return _error('trap_has_tag', "This trap already has a tag.",
                              status.HTTP_409_CONFLICT)
        logger.info("Tag %s associated with trap %s by %s",
                    tag.short, trap.id, getattr(request.user, 'guid', None))
        return Response({'status': 'associated', 'short': short_code(tag.value),
                         'trap': TrapSerializer(trap).data})


class TagAdminViewSet(viewsets.ViewSet):
    """
    Administration of the QR tags: every tag with its state, the usage of each
    signing key, and revocation. Rows are addressed by id, not by value, so a
    tag signed with a retired key can still be inspected and revoked.
    """

    MAX_PAGE = 100

    def get_permissions(self):
        return [HasAnyRole(['admin'])]

    @staticmethod
    def _user(user, names):
        if user is None:
            return None
        guid = str(user.guid)
        if guid not in names:
            # One Keycloak lookup per user and per request, not per row
            names[guid] = user_summary(user)
        return names[guid]

    def _row(self, tag, names) -> dict:
        if tag.revoked_at:
            state = 'revoked'
        elif tag.trap_id:
            state = 'associated'
        else:
            state = 'free'
        return {
            'id': tag.id,
            'short': tag.short,
            'key_index': tag.key_index,
            'status': state,
            'trap': ({'id': tag.trap.id, 'address': tag.trap.address, 'active': tag.trap.active}
                     if tag.trap_id else None),
            'generated_by': self._user(tag.generated_by, names),
            'generated_at': tag.generated_at.isoformat() if tag.generated_at else None,
            'associated_by': self._user(tag.associated_by, names),
            'associated_at': tag.associated_at.isoformat() if tag.associated_at else None,
            'revoked_by': self._user(tag.revoked_by, names),
            'revoked_at': tag.revoked_at.isoformat() if tag.revoked_at else None,
        }

    def list(self, request):
        """Filters: `status` (free, associated, revoked), `key_index`, `q` (code or trap)."""
        tags = Tag.objects.select_related('trap', 'generated_by', 'associated_by', 'revoked_by')
        state = request.query_params.get('status')
        if state == 'free':
            tags = tags.filter(revoked_at__isnull=True, trap__isnull=True)
        elif state == 'associated':
            tags = tags.filter(revoked_at__isnull=True, trap__isnull=False)
        elif state == 'revoked':
            tags = tags.filter(revoked_at__isnull=False)
        key_index = request.query_params.get('key_index', '')
        if key_index.isdigit():
            tags = tags.filter(key_index=int(key_index))
        query = request.query_params.get('q', '').strip()
        if query:
            match = Q(value__contains=query) | Q(trap__address__icontains=query)
            if query.isdigit():
                match |= Q(trap_id=int(query))
            tags = tags.filter(match)

        try:
            offset = max(0, int(request.query_params.get('offset', 0)))
        except ValueError:
            offset = 0
        names = {}
        page = tags[offset:offset + self.MAX_PAGE]
        return Response({
            'count': tags.count(),
            'results': [self._row(tag, names) for tag in page],
        })

    @action(detail=False, methods=['get'])
    def keys(self, request):
        return Response(key_usage())

    @action(detail=True, methods=['get'])
    def qr(self, request, pk=None):
        """The QR code of a tag, to reprint it."""
        tag = Tag.objects.filter(pk=pk).first()
        if tag is None:
            return _error('not_found', "Tag not found.", status.HTTP_404_NOT_FOUND)
        return Response(_tag_payload(tag))

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Revoke a tag, free or associated: it will no longer open anything."""
        with transaction.atomic():
            tag = Tag.objects.select_for_update().filter(pk=pk).first()
            if tag is None:
                return _error('not_found', "Tag not found.", status.HTTP_404_NOT_FOUND)
            if tag.is_revoked:
                return _error('already_revoked', "This tag is already revoked.",
                              status.HTTP_409_CONFLICT)
            tag.revoked_at, tag.revoked_by = timezone.now(), perms.local_user(request)
            tag.save(update_fields=['revoked_at', 'revoked_by'])
        logger.info("Tag %s (trap %s) revoked by admin %s",
                    tag.short, tag.trap_id, getattr(request.user, 'guid', None))
        return Response(self._row(tag, {}))
