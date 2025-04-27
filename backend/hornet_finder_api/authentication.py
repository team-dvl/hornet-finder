import jwt
import os
from typing import Tuple, Optional
from django.urls import resolve
from django.http.request import HttpRequest
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from drf_spectacular.extensions import OpenApiAuthenticationExtension


PROTECTED_PATH = {  # Keys are url names, defined in urls.py
    
}

class JWTBearerAuthentication(BaseAuthentication):
    """
    Custom authentication class for JWT tokens. It checks if the token is valid and if the user has the required role to access the resource.
    Each protected path is associated with a list of tuples, each tuple containing a method and a role required to access the resource.
    The list of protected paths is defined in the PROTECTED_PATH dictionary.
    """

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
        url_name = resolve(request.path_info).url_name # Get the url identifier, defined in urls.py, which is used as a key in the PROTECTED_PATH dictionary
        if not (url_name in PROTECTED_PATH.keys() \
                and any(request.method == method for method, _ in PROTECTED_PATH[url_name])):
            # If the url is not in the PROTECTED_PATH dictionary or the method is not in the list of methods allowed for the url, return None (no authentication required)
            return None
        token = request.META.get('HTTP_AUTHORIZATION') # Retrieve the token from the Authorization header
        if not token:
            raise AuthenticationFailed("No token provided.")
        try:
            public_key = os.environ.get('KEYCLOAK_PUBLIC_KEY')
            token_info = jwt.decode(token.split()[1], public_key, algorithms=['RS256'], audience='account') # Decode the token using the public key
            request.token_info = token_info # Store the token info in the request object (with some information about the user such as the roles)
            if not any(request.method == method for method, role in PROTECTED_PATH[url_name]
                    if role in token_info['realm_access']['roles']):
                raise AuthenticationFailed("You don't have the required role to access this resource.") # Check if the user has the required role to access the resource
        except Exception as e:
            raise AuthenticationFailed("Invalid token. " + str(e)) # If the decoding of the token fails, raise an exception, indicating that the token is invalid
        return (token_info, None) # Return the token info and None (no user object is needed)
    


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
