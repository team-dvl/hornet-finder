import os
from keycloak import KeycloakOpenID, KeycloakAdmin

def _get_keycloak_client():
    """
    Returns a Keycloak client configured for the hornet-finder realm.

    :return: A KeycloakOpenID instance for authentication and token management.
    :rtype: KeycloakOpenID
    """
    return KeycloakOpenID(
        server_url=f"http://{os.getenv('KC_HOSTNAME')}",
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
        server_url=f"http://{os.getenv('KC_HOSTNAME')}",
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
    return keycloak_openid.public_key()

def user_exists(email: str) -> bool:
    """
    Checks if a user with the given email exists in the hornet-finder realm.

    :param email: The email of the user to check.
    :type email: str

    :return: True if the user exists, False otherwise.
    :rtype: bool
    """
    keycloak_admin = _get_keycloak_admin()
    return keycloak_admin.get_user_id(email) is not None

def assign_beekeeper_role(email: str):
    """
    Assigns the 'beekeeper' role to a user with the given email.
    If the user does not exist, it raises an exception.

    :param email: The email of the user to assign the role to.
    :type email: str

    :raises ValueError: If the user does not exist or the role does not exist.
    """
    keycloak_admin = _get_keycloak_admin()
    user_id = keycloak_admin.get_user_id(email)
    
    if not user_id:
        raise ValueError(f"User with email {email} does not exist.")
    
    roles = keycloak_admin.get_realm_roles()
    role = next((role for role in roles if role['name'] == 'beekeeper'), None)
    
    if not role:
        raise ValueError("Role 'beekeeper' does not exist.")
    
    keycloak_admin.assign_realm_roles(user_id=user_id, roles=[role])
