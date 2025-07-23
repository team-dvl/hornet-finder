# Authentication Service

This directory contains the Keycloak authentication server configuration for the Hornet Finder application. Keycloak provides centralized authentication and authorization services with support for OpenID Connect and OAuth 2.0 protocols.

## Overview

The authentication service is built on Keycloak 26.2 and provides:

- **User Authentication**: Secure login/logout functionality with JWT tokens
- **Role-based Access Control**: Multi-tier user roles (admin, beekeeper, volunteer)
- **OAuth 2.0/OpenID Connect**: Standard protocol support for secure API access
- **Google Authentication Provider**: Google is configured as the primary authentication provider
- **External Identity Provider**: No local user registration or password-based authentication
- **Session Management**: Configurable session timeouts and remember-me functionality

## Architecture

### Components

- **Keycloak Server**: Main authentication server (Port 8080)
- **PostgreSQL Database**: Dedicated database for Keycloak data storage
- **Realm Configuration**: Pre-configured realm with clients and roles

### User Roles

The system defines three main user roles:

1. **Admin**: Full system administration privileges
2. **Beekeeper**: Beekeepers with enhanced permissions
3. **Volunteer**: Community volunteers with basic reporting permissions

## Files Description

### `Dockerfile`
Multi-stage Docker build configuration:
- **Builder stage**: Compiles Keycloak with required features
- **Runtime stage**: Optimized production image with PostgreSQL database support

### `docker-entrypoint.sh`
Smart entrypoint script that handles both development and production environments:
- **Development mode**: Uses `start-dev` with relaxed hostname validation
- **Production mode**: Uses optimized `start` with proper proxy headers
- **Database connection**: Automatic PostgreSQL integration
- **Realm import**: Automatically imports the pre-configured realm

### `realm-export.json`
Complete realm configuration export containing:
- **Realm settings**: "hornet-finder" realm with "Velutina" display name
- **Client configurations**:
  - `hornet-api`: Backend API client with service account
  - `hornet-app`: Production frontend application client
  - `hornet-app-dev`: Development frontend application client
- **User roles and permissions**
- **Authentication flows and security policies**
- **Session and token configurations**

## Configuration

### Environment Variables

The service requires the following environment variables (set in docker-compose.yml):

- `KC_DB_PASSWORD` (`KEYCLOAK_DB_PASSWORD` in `.env`): PostgreSQL database password for Keycloak
- `KC_HOSTNAME`: Server hostname (determines dev/prod mode)
- `KC_BOOTSTRAP_ADMIN_PASSWORD`: Initial admin password for Keycloak

### Client Applications

#### hornet-api (Backend)
- **Type**: Confidential client with service account
- **Purpose**: Backend API authentication
- **Flow**: Service account for server-to-server communication
- **Permissions**: Full scope access

#### hornet-app (Production Frontend)
- **Type**: Public client
- **Root URL**: https://velutina.ovh
- **Purpose**: Production web application
- **Flow**: Authorization Code with PKCE
- **Redirect URIs**: https://velutina.ovh/*

#### hornet-app-dev (Development Frontend)
- **Type**: Public client
- **Purpose**: Development environment
- **Flow**: Authorization Code with PKCE
- **Redirect URIs**: Development URLs

## Security Features

### Token Configuration
- **Access Token Lifespan**: 5 minutes (300 seconds)
- **Refresh Token**: Enabled with rotation
- **Session Timeout**: 30 minutes idle, 10 hours maximum
- **Remember Me**: Supported for better user experience

### Security Policies
- **Google OAuth**: Authentication handled by Google's secure OAuth 2.0 flow
- **External Identity Management**: User credentials managed by Google (no local passwords)
- **SSL/TLS**: Required for external connections

### CORS and Origins
- **Web Origins**: Configured per client
- **Redirect URIs**: Strictly validated
- **Post Logout**: Configurable redirect URIs

## Development

### Local Development
When `KC_HOSTNAME` is set to `0.0.0.0:8080`, the service runs in development mode with:
- Relaxed hostname validation (`hostname-strict=false`)
- Development server optimizations
- Local hostname binding (`auth.localhost`)

### Production Deployment
In production mode (when `KC_HOSTNAME` is not `0.0.0.0:8080`):
- Optimized startup with pre-built configuration
- Proxy header support for reverse proxy setups
- Strict hostname validation
- Production security settings

## Integration

### Backend API Integration
The Django backend integrates with Keycloak through:
- JWT Bearer token authentication
- Custom authentication class: `JWTBearerAuthentication`
- Token validation against Keycloak's public keys
- User role extraction from JWT claims

### Frontend Integration
The frontend application connects via:
- OpenID Connect Authorization Code flow
- Automatic token refresh handling
- Role-based UI component rendering
- Secure logout with session cleanup

## Administration

### Accessing Keycloak Admin Console
- **URL**: `https://auth.velutina.ovh/admin/master/console` (production) or `http://auth.localhost:8080/admin/master/console` (development)
- **Default Admin**: Configure through environment variables during first startup
- **Realm Management**: Access the "hornet-finder" realm for user and client management

### Common Administrative Tasks
- **User Management**: Create, modify, or disable user accounts
- **Role Assignment**: Assign roles to users based on their responsibilities
- **Client Configuration**: Modify redirect URIs or client settings
- **Session Management**: Monitor active sessions and force logout if needed

## Monitoring and Maintenance

### Realm configuration
- **Realm Export**: Configuration can be exported/imported via admin console

### First Startup
The configuration is automatically applied on the first startup, but you have to manually set up two things:
1. **hornet-api** client credentials must be regenerated (and updated in the backend env variable `KC_CLIENT_SECRET`)
2. **Google Authentication**: You need to recreate, in your Google Console, credentials for Keycloak to use Google as an authentication provider, and update the client ID and secret in the Keycloak configuration.
After these steps, you need to restart the whole compose stack to apply the changes.

## Troubleshooting

### Common Issues
1. **Database Connection**: Verify PostgreSQL service is running and accessible
2. **Hostname Issues**: Check `KC_HOSTNAME` environment variable configuration
3. **Client Registration**: Ensure redirect URIs match exactly
4. **Token Validation**: Verify JWT token format and expiration
5. **CORS Errors**: Check web origins configuration in client settings

### Log Access
Container logs can be accessed via:
```bash
docker compose logs hornet-finder-keycloak
```

## Security Considerations

- **Keep Updated**: Regularly update Keycloak version for security patches
- **Secret Management**: Rotate client secrets and database passwords regularly
- **SSL/TLS**: Always use HTTPS in production environments
- **Network Security**: Restrict database access to Keycloak service only
- **Monitoring**: Implement logging and monitoring for authentication events
