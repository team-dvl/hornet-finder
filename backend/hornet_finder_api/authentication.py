import jwt
import os
from typing import Tuple, Optional
from django.urls import resolve
from django.http.request import HttpRequest
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from hornet_finder_api.utils import get_realm_public_key


class JWTUser:
    def __init__(self, token_info):
        self.token_info = token_info
        self.username = token_info.get('email')
        self.roles = token_info.get('realm_access', {}).get('roles', [])

    @property
    def is_authenticated(self):
        return True


class HasAnyRole(BasePermission):
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
    Custom authentication class for JWT tokens. It checks if the token is valid and if the user has the required role to access the resource.
    Each protected path is associated with a list of tuples, each tuple containing a method and a role required to access the resource.
    The list of protected paths is defined in the PROTECTED_PATH dictionary.
    """

    KEYCLOAK_PUBLIC_KEY = None

    def authenticate(self, request: HttpRequest) -> Optional[Tuple[dict, None]]:
        """
        Authenticate the user based on the JWT token provided in the Authorization header.
        It checks if the token is valid and if the user has the required role to access the resource.

        :param request: The HTTP request object
        :type request: HttpRequest
        :return: A tuple containing the token info and None (no user object is needed) if an authentication is needed, otherwise None
        :rtype: Optional[Tuple[dict, None]]
        :raises AuthenticationFailed: If the token is invalid or the user doesn't have the required role to access the resource
        """
        token = request.META.get('HTTP_AUTHORIZATION') # Retrieve the token from the Authorization header
        if not token:
            return None
        try:
            if not self.KEYCLOAK_PUBLIC_KEY:  # If the public key is not set, retrieve it
                self.KEYCLOAK_PUBLIC_KEY = get_realm_public_key()  # Get the public key of the Keycloak realm
            token_info = jwt.decode(token.split()[1], self.KEYCLOAK_PUBLIC_KEY, algorithms=['RS256'], audience='account') # Decode the token using the public key
            user = JWTUser(token_info)  # Create a JWTUser object with the token info
            return (user, token_info)
        except Exception as e:
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
