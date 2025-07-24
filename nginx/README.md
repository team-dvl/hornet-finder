# Nginx Reverse Proxy Service

This directory contains the Nginx reverse proxy configuration for the Hornet Finder application. Nginx serves as the main entry point, handling SSL termination, static file serving, and routing requests to appropriate backend services.

## Overview

The Nginx service provides:

- **Reverse Proxy**: Routes requests to backend services (API, Auth, Frontend)
- **SSL Termination**: HTTPS encryption with Let's Encrypt certificates
- **Static File Serving**: Efficient delivery of frontend assets and Django static files
- **Security Headers**: Enhanced security through proper HTTP headers

## Architecture

### Service Configuration

The application uses two Nginx instances:

1. **nginx-certbot**: Temporary service for SSL certificate generation
2. **nginx**: Main reverse proxy service for production traffic

### Domain Routing

- **velutina.ovh**: Production frontend application
- **dev.velutina.ovh**: Development frontend with hot-reload
- **auth.velutina.ovh**: Keycloak authentication service
- **www.velutina.ovh**: Redirects to main domain

## Configuration Files

### `prod.conf`
Production configuration for the main application domain (`velutina.ovh`):

#### SSL Configuration
- **Protocols**: TLS 1.2 and 1.3 only
- **Certificates**: Let's Encrypt SSL certificates
- **Ciphers**: High-security cipher suites

#### Location Blocks
- **`/`**: Serves built frontend static files with optimized caching
- **`/api/`**: Proxies to Django backend (`hornet-finder-api:8000`)
- **`/static/`**: Serves Django static files with long-term caching
- **`/robots.txt`**: Proxies to Django for SEO robots file

#### Caching Strategy
```nginx
# Static assets: 1 year cache with immutable flag
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# HTML files: No cache for dynamic content
location = /index.html {
    expires 0;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### `dev.conf`
Development configuration for the development domain (`dev.velutina.ovh`):

#### WebSocket Support
- **Upgrade Headers**: Proper WebSocket upgrade handling for Vite HMR
- **Connection Handling**: Maintains persistent connections for development server

#### Development Proxying
- **Frontend**: Proxies to Vite dev server (`hornet-finder-vite-dev:5173`)
- **Hot Module Replacement**: WebSocket support for instant code updates
- **API Proxying**: Same backend proxy as production

### `auth.conf`
Authentication service configuration for Keycloak (`auth.velutina.ovh`):

#### Keycloak Proxy
- **Service**: Proxies to Keycloak container (`hornet-finder-keycloak:8080`)
- **Headers**: Proper forwarding headers for authentication flows
- **SSL**: Full SSL termination for secure authentication

#### Security Headers
```nginx
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port 443;
```

### `certbot.conf`
Certificate generation configuration for Let's Encrypt:

#### ACME Challenge
- **Port 80**: HTTP server for certificate validation
- **Well-known Path**: Serves ACME challenge files
- **Multi-domain**: Supports all application domains

## SSL/TLS Configuration

### Certificate Management

The application uses Let's Encrypt for SSL certificates:

- **Certificate Path**: `/etc/letsencrypt/live/velutina.ovh/`
- **Fullchain**: `fullchain.pem` (certificate + intermediate)
- **Private Key**: `privkey.pem` (private key file)
- **Auto-renewal**: Handled by Certbot container

### Security Settings

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-CCM:ECDHE-ECDSA-CHACHA20-POLY1305;
```

- **Protocol Support**: TLS 1.2 and 1.3 only (secure versions)
- **Cipher Suites**: High-security ciphers, no anonymous or MD5
- **Perfect Forward Secrecy**: Ensured through cipher selection

## Performance Optimization

### Static File Serving

#### Frontend Assets
- **Direct Serving**: Nginx serves built frontend files directly
- **Long-term Caching**: 1-year cache for immutable assets

#### Django Static Files
- **Separate Location**: `/static/` served from shared volume
- **Cache Headers**: 30-day expiration for Django admin assets
- **Access Logging**: Disabled for performance (`access_log off`)

### Proxy Optimization

#### Connection Headers
```nginx
proxy_set_header Host $http_host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

## Volume Mounts

### Certificate Storage
- **Source**: `./certbot/conf`
- **Mount**: `/etc/letsencrypt:ro`
- **Purpose**: SSL certificate access (read-only)

### ACME Challenge
- **Source**: `./certbot/www`
- **Mount**: `/var/www/certbot`
- **Purpose**: Let's Encrypt challenge file serving

### Static Files
- **Django Static**: `staticfiles:/staticfiles`
- **Frontend Build**: `frontend-dist:/usr/share/nginx/html:ro`

## Development vs Production

### Development Mode (`dev.velutina.ovh`)
- **Frontend**: Proxies to Vite development server
- **Hot Reload**: WebSocket support for instant updates
- **Source Maps**: Development build with debugging support
- **No Caching**: Immediate file updates without cache issues

### Production Mode (`velutina.ovh`)
- **Frontend**: Serves pre-built static files
- **Optimized Caching**: Aggressive caching for performance
- **Minified Assets**: Compressed and optimized builds
- **Security Headers**: Enhanced security configuration

## Monitoring and Logging

### Access Logs
```bash
# View Nginx access logs
docker compose logs nginx
# Follow real-time logs
docker compose logs -f nginx
```

## Security Considerations

### HTTP Security Headers

Recommended security headers (can be added to configurations, if not handled by Django):

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'" always;
```

### Rate Limiting

Consider implementing rate limiting for security:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req zone=api burst=20 nodelay;
```

## Troubleshooting

### Common Issues

1. **SSL Certificate Problems**
   - Check certificate paths and permissions
   - Verify Let's Encrypt renewal process
   - Ensure proper domain validation

2. **Backend Connection Issues**
   - Verify service names in Docker network
   - Check backend service health
   - Review proxy headers configuration

3. **Static File 404 Errors**
   - Verify volume mounts are correct
   - Check file permissions in shared volumes
   - Ensure frontend build process completed

4. **WebSocket Connection Failures (Dev)**
   - Verify Upgrade and Connection headers
   - Check Vite dev server status
   - Review WebSocket proxy configuration
