import jwt
from typing import Tuple, Optional
from django.http.request import HttpRequest
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from hornet_finder_api.utils import get_realm_public_key, get_user_display_name
import requests
import os
import threading
import time
from hornet.models import User
import uuid
import logging

logger = logging.getLogger(__name__)


class JWTUser:
    """
    Represents a user authenticated via JWT token.
    This class is used to create a user object from the token information.
    It extracts the guid and roles from the token info.
    """

    def __init__(self, token_info):
        self.token_info = token_info
        self.guid = token_info.get('sub')
        self.roles = token_info.get('realm_access', {}).get('roles', [])

    @property
    def is_authenticated(self):
        return True


class HasAnyRole(BasePermission):
    """
    Custom permission class that checks if the user has any of the required roles.
    This class needs to be used with the `permission_classes` decorator in views.
    Before the `permission_classes` decorator, it is necessary to use the `authentication_classes` decorator to have authenticated users.
    """

    def __init__(self, roles):
        self.required_roles = roles

    def has_permission(self, request, view):
        user = request.user
        if not user or not getattr(user, 'is_authenticated', False):
            return False

        user_roles = getattr(user, 'roles', [])
        return any(role in user_roles for role in self.required_roles)

class JWTBearerAuthentication(BaseAuthentication):
    """
    Custom authentication class that uses JWT tokens for user authentication.
    """

    KEYCLOAK_PUBLIC_KEY = None

    def authenticate(self, request: HttpRequest) -> Optional[Tuple[JWTUser, dict]]:
        """
        Authenticate the user based on the JWT token provided in the Authorization header.

        :param request: The HTTP request object
        :type request: HttpRequest
        :return: A tuple containing the JWTUser object and the token information if authentication is successful, otherwise None
        :rtype: Optional[Tuple[JWTUser, dict]]
        :raises AuthenticationFailed: If the token is invalid
        """
        token = request.META.get('HTTP_AUTHORIZATION') # Retrieve the token from the Authorization header
        if not token:
            logger.debug("No Authorization header found in request")
            return None
        
        logger.debug(f"Found Authorization header: {token[:50]}..." if len(token) > 50 else f"Found Authorization header: {token}")
        
        try:
            if not self.KEYCLOAK_PUBLIC_KEY:  # If the public key is not set, retrieve it
                logger.debug("Retrieving Keycloak public key...")
                self.KEYCLOAK_PUBLIC_KEY = get_realm_public_key()  # Get the public key of the Keycloak realm
                logger.debug("Successfully retrieved Keycloak public key")
                
            token_info = jwt.decode(token.split()[1], self.KEYCLOAK_PUBLIC_KEY, algorithms=['RS256'], audience='account') # Decode the token using the public key
            logger.debug(f"Successfully decoded JWT token for user: {token_info.get('preferred_username', 'unknown')}")
            
            user = JWTUser(token_info)  # Create a JWTUser object with the token info

            # --- On-the-fly creation of the local user if not existing ---
            guid = token_info.get('sub')
            if guid:
                try:
                    User.objects.get(guid=guid)
                except User.DoesNotExist:
                    logger.debug(f"Creating new user with GUID: {guid}")
                    User.objects.create(guid=uuid.UUID(guid))
            # ---------------------------------------------------------------

            return (user, token_info)
        except Exception as e:
            logger.error(f"JWT authentication failed: {type(e).__name__}: {e}")
            raise AuthenticationFailed("Invalid token. " + str(e)) # If the decoding of the token fails, raise an exception, indicating that the token is invalid
    


class JWTScheme(OpenApiAuthenticationExtension):
    """
    OpenAPI extension for the JWTBearerAuthentication class. It provides the security definition for the JWT token. Thanks to this extension, the user can authenticate using a JWT token in the Swagger UI.
    """
    target_class = 'hornet_finder_api.authentication.JWTBearerAuthentication'
    name = 'BearerAuth'
    match_subclasses = True
    priority = -1

    def get_security_definition(self, auto_schema):
        """
        Get the security definition for the JWT token.

        :param auto_schema: The auto schema object
        :type auto_schema: OpenApiAutoSchema
        :return: The security definition for the JWT
        :rtype: dict
        """
        return {
            'type': 'http',
            'scheme': 'bearer',
            'in': 'header',
            'name': 'Authorization',
            'description': "JWT based authentication. Just paste your jwt token here (You can retrieve your jwt token in the `Authorisation` header, in the network tab of your web console, in the requests sent to the back end.). No need to prefix it with `Bearer`."
        }
