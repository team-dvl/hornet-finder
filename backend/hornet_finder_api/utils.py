import os
from keycloak import KeycloakOpenID, KeycloakAdmin
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

def get_user_display_name(guid: str) -> Optional[str]:
    """
    Retrieve the user's display name (first and last name), or preferred_username/email/id if not available,
    for a given Keycloak user GUID.

    :param guid: The Keycloak user ID.
    :type guid: str
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
        return user.get('preferred_username') or user.get('email') or user.get('id')
    except Exception:
        return None
