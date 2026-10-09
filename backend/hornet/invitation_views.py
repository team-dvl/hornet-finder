"""
Invitations to join a beekeeper group (`/beekeepers/<id>`).

A platform admin, or an administrator of the group (member of `<group>/admin`,
see `trap_permissions.py`), invites an existing, active user by typing their
full email address. The address is only used to find the Keycloak account and
is never stored nor logged: the invitation keeps the Keycloak ids. Failed
lookups are limited per inviter (`InvitationThrottle`), so the form cannot be
used to probe which addresses have an account.

The invitee is told by email (to the address of their Keycloak account),
sees the invitation in the app and accepts or declines it;
accepting adds them to the Keycloak group with the backend service account
(`manage-users`). The new membership reaches their token at the next refresh.
"""

import logging
import unicodedata

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone
from django.utils.html import format_html

from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import (
    APIException, NotAuthenticated, NotFound, PermissionDenied, ValidationError,
)
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, inline_serializer

from audit import recorder as audit
from hornet_finder_api import utils as keycloak
from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication
from hornet_finder_api.roles import APP_ROLES

from . import trap_permissions as perms
from .emails import BrandedEmail
from .models import GroupInvitation, InvitationThrottle, User

logger = logging.getLogger(__name__)

# Shared with the traps' delegation, which allows the same groups
BEEKEEPERS_ROOT = perms.BEEKEEPERS_ROOT
is_beekeeper_group = perms.is_beekeeper_group


class KeycloakUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Le service d'authentification ne répond pas. Réessayez plus tard."
    default_code = 'keycloak_unavailable'


def _keycloak(call, *args):
    """Run a Keycloak call, turning any failure into a 503."""
    try:
        return call(*args)
    except Exception as exc:
        logger.error("Keycloak call %s failed: %s: %s",
                     getattr(call, '__name__', call), type(exc).__name__, exc)
        raise KeycloakUnavailable() from exc


def beekeeper_groups() -> list:
    """Every beekeeper association in Keycloak, as group representations."""
    return [g for g in _keycloak(keycloak.get_child_groups, BEEKEEPERS_ROOT)
            if is_beekeeper_group(g.get('path'))]


def invitable_groups(request):
    """
    Beekeeper groups the requester may invite to: the ones they administer.
    `None` means every beekeeper group (platform admin).
    """
    if perms.is_platform_admin(request.user):
        return None
    return {g for g in perms.administered_groups(perms.membership_paths(request))
            if is_beekeeper_group(g)}


def can_invite_to(request, group_path: str) -> bool:
    if not is_beekeeper_group(group_path):
        return False
    allowed = invitable_groups(request)
    return allowed is None or group_path in allowed


def _sort_key(name: str) -> str:
    """Alphabetical order ignoring case and accents (« école » before « vsab »)."""
    return unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()


def _requester(request) -> User:
    user = perms.local_user(request)
    if user is None:
        raise NotAuthenticated()
    return user


def _lookup_state(throttle, now) -> dict:
    return {
        'remaining_attempts': throttle.remaining(now) if throttle else InvitationThrottle.MAX_FAILURES,
        'locked_until': throttle.locked_until if throttle and throttle.is_locked(now) else None,
    }


class _Names:
    """
    First and last names of Keycloak users, looked up once per request. Never
    an email address: neither the inviter's to the invitee, nor the invitee's
    to the group's other administrators.
    """

    def __init__(self):
        self._cache = {}

    def __call__(self, user):
        if user is None:
            return None
        key = str(user.guid)
        if key not in self._cache:
            self._cache[key] = keycloak.get_user_display_name(key, allow_email=False)
        return self._cache[key]


def _notify_invitee(invitation, email: str, inviter_name, reminder: bool = False) -> bool:
    """
    Tell the invitee by email, in the layout of the Keycloak emails. A failure
    never loses the invitation, which stays visible in the app; the inviter is
    told so they can warn the person.
    """
    group = invitation.group_name
    if reminder:
        lead = f"Pour rappel, {inviter_name or 'un administrateur'}"
        subject = f"Rappel : invitation à rejoindre {group}"
    else:
        lead = inviter_name or 'Un administrateur'
        subject = f"Invitation à rejoindre {group}"
    expires = timezone.localtime(invitation.expires_at).strftime('%d/%m/%Y')
    # The app signs the visitor in first, then lists their invitations
    url = f"https://{settings.PUBLIC_HOST}/invitations"
    text = (
        "Bonjour,\n\n"
        f"{lead} vous invite à rejoindre « {group} » sur Velutina, "
        "l'application de gestion du frelon asiatique.\n\n"
        f"Pour l'accepter ou la refuser, jusqu'au {expires} : {url}\n"
        "(une connexion vous sera demandée si nécessaire)\n\n"
        "Si vous ne connaissez pas ce groupe, ignorez simplement ce message.\n"
    )
    html = format_html(
        '<p>Bonjour,</p>'
        '<p>{} vous invite à rejoindre <strong>« {} »</strong> sur Velutina, '
        "l'application de gestion du frelon asiatique.</p>"
        '<p><a href="{}">Voir l\'invitation</a></p>'
        "<p>Vous pouvez l'accepter ou la refuser jusqu'au {} ; une connexion vous sera "
        "demandée si nécessaire.</p>"
        '<p style="color:#7a8177; font-size:13px;">Si vous ne connaissez pas ce groupe, '
        'ignorez simplement ce message.</p>',
        lead, group, url, expires,
    )
    try:
        BrandedEmail(subject, text, html, [email]).send()
        return True
    except Exception as exc:
        # The exception text may quote the recipient: only its type is logged
        logger.warning("Could not email group invitation %s: %s", invitation.id, type(exc).__name__)
        return False


def _serialize(invitation, names, with_invitee=False) -> dict:
    data = {
        'id': invitation.id,
        'group_path': invitation.group_path,
        'group_name': invitation.group_name,
        'invited_by_name': names(invitation.invited_by),
        'status': invitation.status,
        'created_at': invitation.created_at,
        'expires_at': invitation.expires_at,
    }
    if with_invitee:
        data['invitee_name'] = names(invitation.invitee)
        data['next_reminder_at'] = invitation.next_reminder_at
        data['reminders_sent'] = invitation.reminders_sent
    return data


class GroupInvitationSchema(serializers.Serializer):
    """Shape of an invitation in the responses (documentation only)."""

    id = serializers.IntegerField()
    group_path = serializers.CharField()
    group_name = serializers.CharField()
    invitee_name = serializers.CharField(allow_null=True, required=False)
    invited_by_name = serializers.CharField(allow_null=True)
    status = serializers.CharField()
    created_at = serializers.DateTimeField()
    expires_at = serializers.DateTimeField()
    # For the group's administrators: when a reminder may be sent (null: now)
    next_reminder_at = serializers.DateTimeField(allow_null=True, required=False)
    reminders_sent = serializers.IntegerField(required=False)
    # Creation only: whether the invitee could be emailed
    notified = serializers.BooleanField(required=False)


LookupSerializer = inline_serializer('InvitationLookup', {
    'remaining_attempts': serializers.IntegerField(),
    'locked_until': serializers.DateTimeField(allow_null=True),
})


class GroupInvitationViewSet(viewsets.GenericViewSet):
    """Invitations sent by group administrators and platform admins."""

    queryset = GroupInvitation.objects.select_related('invitee', 'invited_by')

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        # Administrators of a beekeeper group inherit `beekeeper` from `/beekeepers`
        return [HasAnyRole(['beekeeper', 'admin'])]

    @extend_schema(responses={200: inline_serializer('InvitationOptions', {
        'groups': inline_serializer('InvitableGroup', {
            'path': serializers.CharField(), 'name': serializers.CharField(),
        }, many=True),
        'lookup': LookupSerializer,
    })})
    @action(detail=False, methods=['get'])
    def invitable(self, request):
        """The groups the caller may invite to, and their remaining lookups."""
        allowed = invitable_groups(request)
        if allowed is None:
            groups = beekeeper_groups()
        else:
            groups = [g for g in (_keycloak(keycloak.get_group_by_path, p) for p in sorted(allowed)) if g]
        throttle = InvitationThrottle.objects.filter(user__guid=request.user.guid).first()
        now = timezone.now()
        if throttle:
            throttle.refresh(now)
        return Response({
            'groups': sorted(
                ({'path': g['path'], 'name': keycloak.group_display_name(g)} for g in groups),
                key=lambda g: _sort_key(g['name']),
            ),
            'lookup': _lookup_state(throttle, now),
        })

    @extend_schema(responses={200: GroupInvitationSchema(many=True)})
    def list(self, request):
        """Pending invitations of the groups the caller may invite to."""
        GroupInvitation.expire_stale()
        queryset = self.get_queryset().filter(status=GroupInvitation.STATUS_PENDING)
        allowed = invitable_groups(request)
        if allowed is not None:
            queryset = queryset.filter(group_path__in=allowed)
        names = _Names()
        return Response([_serialize(i, names, with_invitee=True) for i in queryset])

    @extend_schema(
        request=inline_serializer('GroupInvitationCreate', {
            'group_path': serializers.CharField(), 'email': serializers.EmailField(),
        }),
        responses={201: GroupInvitationSchema},
    )
    def create(self, request):
        """
        Invite the active account whose email is exactly the one typed.

        The invitee is emailed once the invitation is stored; `notified` in
        the response says whether that worked. Errors carry a `code`: `no_active_user` (404, counted as a failed
        lookup, with the remaining attempts), `locked` (429), `self`,
        `already_member` or `already_invited` (409).
        """
        group_path = (request.data.get('group_path') or '').strip()
        email = (request.data.get('email') or '').strip()
        if not group_path:
            raise ValidationError({'group_path': "Ce champ est obligatoire."})
        if not can_invite_to(request, group_path):
            raise PermissionDenied("Vous ne pouvez pas inviter dans ce groupe.")
        try:
            validate_email(email)
        except DjangoValidationError:
            # A malformed address reveals nothing: not counted as a failed lookup
            raise ValidationError({'email': "Adresse email invalide."})

        inviter = _requester(request)
        with transaction.atomic():
            # The lock serializes the lookups of one inviter: parallel requests
            # cannot each see the same count and exceed the limit together.
            throttle, _ = InvitationThrottle.objects.select_for_update().get_or_create(user=inviter)
            now = timezone.now()
            throttle.refresh(now)
            if throttle.is_locked(now):
                throttle.save()
                return self._locked(throttle, now)

            group = _keycloak(keycloak.get_group_by_path, group_path)
            if group is None:
                raise ValidationError({'group_path': "Ce groupe n'existe pas."})

            account = _keycloak(keycloak.find_active_user_by_email, email)
            if account is None:
                throttle.record_failure(now)
                throttle.save()
                logger.info("Group invitation: failed lookup by %s (%s left)",
                            inviter.guid, throttle.remaining(now))
                if throttle.is_locked(now):
                    return self._locked(throttle, now)
                return Response({
                    'code': 'no_active_user',
                    'detail': "Aucun compte actif ne correspond à cette adresse.",
                    **_lookup_state(throttle, now),
                }, status=status.HTTP_404_NOT_FOUND)
            throttle.save()

            if account['id'] == str(inviter.guid):
                return self._conflict('self', "Vous ne pouvez pas vous inviter vous-même.")
            account_paths = _keycloak(keycloak.get_user_group_paths, account['id'])
            if perms.is_member_of(account_paths, group_path):
                return self._conflict('already_member', "Cette personne est déjà membre du groupe.")

            invitee, _ = User.objects.get_or_create(guid=account['id'])
            GroupInvitation.expire_stale(group_path=group_path, invitee=invitee)
            if GroupInvitation.objects.filter(group_path=group_path, invitee=invitee,
                                              status=GroupInvitation.STATUS_PENDING).exists():
                return self._conflict('already_invited', "Une invitation est déjà en attente pour cette personne.")

            invitation = GroupInvitation.objects.create(
                group_path=group_path, group_name=keycloak.group_display_name(group),
                invitee=invitee, invited_by=inviter,
            )
        logger.info("Group invitation %s: %s invited %s to %s",
                    invitation.id, inviter.guid, invitee.guid, group_path)
        names = _Names()
        notified = _notify_invitee(invitation, account['email'], names(inviter))
        if notified:
            invitation.last_notified_at = timezone.now()
            invitation.save(update_fields=['last_notified_at'])
        # After the email, to tell whether it left; the invitation is stored either way
        audit.record(request, 'invitation.sent', invitation,
                     changes={'group': group_path, 'notified': notified})
        return Response({**_serialize(invitation, names, with_invitee=True), 'notified': notified},
                        status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses={200: GroupInvitationSchema})
    @action(detail=True, methods=['post'])
    def remind(self, request, pk=None):
        """
        Email the invitee again, at most once per `REMINDER_INTERVAL` since the
        last email that left (the invitation's own included). Errors carry a
        `code`: `too_soon` (429, with `next_reminder_at`), `inactive` (409: the
        account was disabled or deleted since), `mail_failed` (502).
        """
        GroupInvitation.expire_stale(pk=pk)
        names = _Names()
        with transaction.atomic():
            # Locked while the email goes: a double tap cannot send two reminders
            invitation = GroupInvitation.objects.select_for_update().filter(
                pk=pk, status=GroupInvitation.STATUS_PENDING,
            ).first()
            if invitation is None or not can_invite_to(request, invitation.group_path):
                raise NotFound()
            now = timezone.now()
            next_at = invitation.next_reminder_at
            if next_at and next_at > now:
                return Response({
                    'code': 'too_soon',
                    'detail': "Un email est déjà parti il y a moins de 24 heures.",
                    'next_reminder_at': next_at,
                }, status=status.HTTP_429_TOO_MANY_REQUESTS,
                    headers={'Retry-After': str(int((next_at - now).total_seconds()) + 1)})
            email = _keycloak(keycloak.get_active_user_email, str(invitation.invitee_id))
            if not email:
                return self._conflict('inactive', "Le compte de cette personne n'est plus actif.")
            if not _notify_invitee(invitation, email, names(invitation.invited_by), reminder=True):
                return Response({'code': 'mail_failed',
                                 'detail': "L'email n'a pas pu partir. Réessayez plus tard."},
                                status=status.HTTP_502_BAD_GATEWAY)
            invitation.last_notified_at = now
            invitation.reminders_sent += 1
            invitation.save(update_fields=['last_notified_at', 'reminders_sent'])
            audit.record(request, 'invitation.reminded', invitation,
                         changes={'reminder': invitation.reminders_sent})
        logger.info("Group invitation %s: reminder %s sent by %s",
                    invitation.id, invitation.reminders_sent, request.user.guid)
        return Response(_serialize(invitation, names, with_invitee=True))

    @extend_schema(responses={204: None})
    def destroy(self, request, pk=None):
        """Withdraw a pending invitation (any administrator of its group)."""
        invitation = self.get_queryset().filter(pk=pk, status=GroupInvitation.STATUS_PENDING).first()
        if invitation is None or not can_invite_to(request, invitation.group_path):
            raise NotFound()
        with transaction.atomic():
            invitation.status = GroupInvitation.STATUS_CANCELLED
            invitation.responded_at = timezone.now()
            invitation.save(update_fields=['status', 'responded_at'])
            audit.record(request, 'invitation.cancelled', invitation)
        logger.info("Group invitation %s cancelled by %s", invitation.id, request.user.guid)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @staticmethod
    def _locked(throttle, now):
        retry_after = int((throttle.locked_until - now).total_seconds()) + 1
        return Response({
            'code': 'locked',
            'detail': "Trop d'adresses inconnues : les invitations sont suspendues pendant 24 heures.",
            **_lookup_state(throttle, now),
        }, status=status.HTTP_429_TOO_MANY_REQUESTS, headers={'Retry-After': str(retry_after)})

    @staticmethod
    def _conflict(code, detail):
        return Response({'code': code, 'detail': detail}, status=status.HTTP_409_CONFLICT)


class MyGroupInvitationViewSet(viewsets.GenericViewSet):
    """Invitations received by the signed-in user."""

    queryset = GroupInvitation.objects.select_related('invited_by')

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        return [HasAnyRole(list(APP_ROLES))]

    def _mine(self, request):
        return self.get_queryset().filter(invitee__guid=request.user.guid)

    @extend_schema(responses={200: GroupInvitationSchema(many=True)})
    def list(self, request):
        GroupInvitation.expire_stale(invitee__guid=request.user.guid)
        names = _Names()
        pending = self._mine(request).filter(status=GroupInvitation.STATUS_PENDING)
        return Response([_serialize(i, names) for i in pending])

    def _respond(self, request, pk, accept: bool):
        GroupInvitation.expire_stale(invitee__guid=request.user.guid)
        with transaction.atomic():
            # `of`: the nullable join on the inviter cannot be locked
            invitation = self._mine(request).select_for_update(of=('self',)).filter(
                pk=pk, status=GroupInvitation.STATUS_PENDING,
            ).first()
            if invitation is None:
                raise NotFound("Cette invitation n'est plus valable.")
            if accept:
                group = _keycloak(keycloak.get_group_by_path, invitation.group_path)
                if group is None:
                    raise NotFound("Ce groupe n'existe plus.")
                _keycloak(keycloak.add_user_to_group, str(request.user.guid), group['id'])
            invitation.status = (GroupInvitation.STATUS_ACCEPTED if accept
                                 else GroupInvitation.STATUS_DECLINED)
            invitation.responded_at = timezone.now()
            invitation.save(update_fields=['status', 'responded_at'])
            audit.record(request, f"invitation.{invitation.status}", invitation)
        logger.info("Group invitation %s %s by %s", invitation.id, invitation.status, request.user.guid)
        return Response(_serialize(invitation, _Names()))

    @extend_schema(request=None, responses={200: GroupInvitationSchema})
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Join the group: the new membership shows in the next token."""
        return self._respond(request, pk, accept=True)

    @extend_schema(request=None, responses={200: GroupInvitationSchema})
    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        return self._respond(request, pk, accept=False)
