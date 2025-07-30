import os
from keycloak import KeycloakOpenID, KeycloakAdmin
from typing import Optional


def _get_keycloak_client():
    """
    Returns a Keycloak client configured for the hornet-finder realm.

    :return: A KeycloakOpenID instance for authentication and token management.
    :rtype: KeycloakOpenID
    """
    return KeycloakOpenID(
        server_url="http://hornet-finder-keycloak:8080/",
        client_id="hornet-api",
        realm_name="hornet-finder",
        client_secret_key=os.getenv("KC_CLIENT_SECRET")
    )

def _get_keycloak_admin():
    """
    Returns a Keycloak admin client configured for the hornet-finder realm.

    :return: A KeycloakAdmin instance for managing users and roles.
    :rtype: KeycloakAdmin
    """
    return KeycloakAdmin(
        server_url="http://hornet-finder-keycloak:8080/",
        realm_name="hornet-finder",
        client_id="hornet-api",
        client_secret_key=os.getenv("KC_CLIENT_SECRET")
    )

def get_realm_public_key():
    """
    Returns the public key of the hornet-finder realm.
    
    :return: The public key of the realm.
    :rtype: str
    """
    keycloak_openid = _get_keycloak_client()
    public_key = keycloak_openid.public_key()
    pem_public_key = "-----BEGIN PUBLIC KEY-----\n" + public_key + "\n-----END PUBLIC KEY-----"
    return pem_public_key

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
