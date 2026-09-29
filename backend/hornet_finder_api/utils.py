import os
from keycloak import KeycloakOpenID, KeycloakAdmin
from keycloak.exceptions import KeycloakGetError
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class KeycloakConfigurationError(Exception):
    """Raised when Keycloak configuration is missing or invalid."""
    pass


def _get_required_env_var(var_name: str) -> str:
    """
    Get a required environment variable or raise a configuration error.
    
    :param var_name: The name of the environment variable.
    :return: The value of the environment variable.
    :raises KeycloakConfigurationError: If the environment variable is not set.
    """
    value = os.getenv(var_name)
    if not value:
        raise KeycloakConfigurationError(
            f"Required environment variable '{var_name}' is not set. "
            f"Please configure this variable in your .env file."
        )
    return value


def _get_keycloak_client():
    """
    Returns a Keycloak client configured for the hornet-finder realm.

    :return: A KeycloakOpenID instance for authentication and token management.
    :rtype: KeycloakOpenID
    :raises KeycloakConfigurationError: If required configuration is missing.
    """
    return KeycloakOpenID(
        server_url=_get_required_env_var("KC_INTERNAL_URL"),
        client_id=_get_required_env_var("KC_CLIENT_ID"),
        realm_name=_get_required_env_var("KC_REALM"),
        client_secret_key=_get_required_env_var("KC_CLIENT_SECRET")
    )

def _get_keycloak_admin():
    """
    Returns a Keycloak admin client configured for the hornet-finder realm.

    :return: A KeycloakAdmin instance for managing users and roles.
    :rtype: KeycloakAdmin
    :raises KeycloakConfigurationError: If required configuration is missing.
    """
    return KeycloakAdmin(
        server_url=_get_required_env_var("KC_INTERNAL_URL"),
        realm_name=_get_required_env_var("KC_REALM"),
        client_id=_get_required_env_var("KC_CLIENT_ID"),
        client_secret_key=_get_required_env_var("KC_CLIENT_SECRET")
    )

def get_realm_public_key():
    """
    Returns the public key of the hornet-finder realm.
    
    :return: The public key of the realm.
    :rtype: str
    """
    try:
        logger.debug("Creating Keycloak client to retrieve public key...")
        keycloak_openid = _get_keycloak_client()
        logger.debug("Successfully created Keycloak client, calling public_key()...")
        public_key = keycloak_openid.public_key()
        logger.debug(f"Successfully retrieved public key: {public_key[:50]}...")
        pem_public_key = "-----BEGIN PUBLIC KEY-----\n" + public_key + "\n-----END PUBLIC KEY-----"
        return pem_public_key
    except Exception as e:
        logger.error(f"Failed to retrieve Keycloak public key: {type(e).__name__}: {e}")
        raise

def get_realm_jwks_url() -> str:
    """
    Returns the JWKS (JSON Web Key Set) URL of the hornet-finder realm.

    Unlike the single-key `public_key()` endpoint, the JWKS contains every active signing
    key of the realm (one per algorithm/kid), which is required to validate tokens correctly
    when several algorithms (e.g. RS256 and PS256) are enabled at once.

    :return: The JWKS URL of the realm.
    :rtype: str
    """
    server_url = _get_required_env_var("KC_INTERNAL_URL").rstrip('/')
    realm_name = _get_required_env_var("KC_REALM")
    return f"{server_url}/realms/{realm_name}/protocol/openid-connect/certs"

def user_exists(guid: str) -> bool:
    """
    Checks if a user with the given Keycloak GUID exists in the hornet-finder realm.

    :param guid: The Keycloak user GUID to check.
    :type guid: str

    :return: True if the user exists, False otherwise.
    :rtype: bool
    """
    keycloak_admin = _get_keycloak_admin()
    try:
        user = keycloak_admin.get_user(guid)
        return user is not None
    except Exception:
        return False

def get_user_display_name(guid: str, allow_email: bool = True) -> Optional[str]:
    """
    Retrieve the user's display name (first and last name), or preferred_username/email/id if not available,
    for a given Keycloak user GUID.

    :param guid: The Keycloak user ID.
    :type guid: str
    :param allow_email: When False, only a first/last name is returned: usernames are
        email addresses in this realm, so every other identifier may disclose one.
    :return: The user's display name, or an alternative identifier, or None if not found.
    :rtype: Optional[str]
    """
    keycloak_admin = _get_keycloak_admin()
    try:
        user = keycloak_admin.get_user(guid)
        first = user.get('firstName', '')
        last = user.get('lastName', '')
        if first or last:
            return f"{first} {last}".strip()
        if not allow_email:
            return None
        return user.get('preferred_username') or user.get('email') or user.get('id')
    except Exception:
        return None

def get_user_group_paths(guid: str) -> list:
    """
    Retrieve the full Keycloak group paths of a user.

    Only used as a fallback for a user who has not authenticated since their
    groups were last mirrored locally: the normal source is the `membership`
    claim of the caller's own token.

    :param guid: The Keycloak user ID.
    :type guid: str
    :return: The list of full group paths, empty when unknown.
    :rtype: list
    """
    try:
        groups = _get_keycloak_admin().get_user_groups(guid)
        return [g['path'] for g in groups if g.get('path')]
    except Exception as e:
        # Never fatal: the caller falls back to the locally mirrored paths
        logger.warning(f"Failed to retrieve Keycloak groups of {guid}: {type(e).__name__}: {e}")
        return []

def find_active_user_by_email(email: str) -> Optional[dict]:
    """
    The enabled Keycloak account whose verified email is exactly `email`.

    Keycloak searches emails by substring unless `exact` is set; the equality
    is checked again here so a partial address can never match. An account
    with an unverified email does not count: nothing proves the address is
    its holder's.

    :param email: Full email address, compared case-insensitively.
    :return: The user representation, or None.
    :raises Exception: Any Keycloak failure, left to the caller.
    """
    email = email.strip().lower()
    users = _get_keycloak_admin().get_users({'email': email, 'exact': 'true'})
    for user in users:
        if ((user.get('email') or '').lower() == email
                and user.get('enabled') and user.get('emailVerified')):
            return user
    return None


def get_active_user_email(guid: str) -> Optional[str]:
    """
    The verified email of an enabled account, or None (disabled, unverified or deleted).

    :raises Exception: Any other Keycloak failure, left to the caller.
    """
    try:
        user = _get_keycloak_admin().get_user(guid)
    except KeycloakGetError as exc:
        if exc.response_code == 404:
            return None
        raise
    if user.get('enabled') and user.get('emailVerified'):
        return user.get('email') or None
    return None


def get_group_by_path(path: str) -> Optional[dict]:
    """
    The Keycloak group at `path` (with its attributes), or None when it does not exist.

    :raises Exception: Any other Keycloak failure, left to the caller.
    """
    try:
        return _get_keycloak_admin().get_group_by_path(path)
    except KeycloakGetError as exc:
        if exc.response_code == 404:
            return None
        raise


def get_child_groups(path: str) -> list:
    """
    The direct subgroups of the group at `path`, with their attributes.

    :return: Group representations, empty when the parent does not exist.
    :raises Exception: Any Keycloak failure, left to the caller.
    """
    parent = get_group_by_path(path)
    if parent is None:
        return []
    return _get_keycloak_admin().get_group_children(parent['id'], {'briefRepresentation': 'false'})


def group_display_name(group: dict) -> str:
    """The description of a Keycloak group (its full name, e.g. "Vedrin s'abeille"), else its name."""
    return (group.get('description') or '').strip() or group.get('name') or group.get('path', '')


def add_user_to_group(guid: str, group_id: str) -> None:
    """
    Make a user a direct member of a Keycloak group (idempotent).
    Requires the `manage-users` role on the backend service account.

    :raises Exception: Any Keycloak failure, left to the caller.
    """
    _get_keycloak_admin().group_user_add(guid, group_id)


def set_user_picture(guid: str, url: Optional[str]) -> None:
    """
    Set (or remove, with `url=None`) the `picture` attribute of a Keycloak user.

    The attribute feeds the standard `picture` claim of the tokens. The whole
    representation is sent back, because an update replaces the attribute map.
    Requires the `manage-users` role on the backend service account.

    :param guid: The Keycloak user ID.
    :param url: Absolute URL of the photo, or None to remove it.
    :raises Exception: Any Keycloak failure, left to the caller.
    """
    keycloak_admin = _get_keycloak_admin()
    user = keycloak_admin.get_user(guid)
    attributes = dict(user.get('attributes') or {})
    if url:
        attributes['picture'] = [url]
    else:
        attributes.pop('picture', None)
    keycloak_admin.update_user(guid, {**user, 'attributes': attributes})
