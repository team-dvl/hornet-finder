# Hornet Finder

A comprehensive web application for tracking Asian hornets (Vespa velutina) with geospatial capabilities, designed to help beekeepers, researchers, and volunteers monitor and combat hornet populations through collaborative data collection.

## Overview

Hornet Finder provides a complete solution for hornet detection and tracking with:

- **Hornet Sighting Tracking**: Record hornet locations, flight directions, and color markings
- **Nest Management**: Track nest locations, destruction status, and related information
- **Apiary Monitoring**: Monitor beehive infestation levels with geographic data
- **Geospatial Analysis**: PostGIS-powered spatial queries and proximity analysis
- **Role-based Access**: Multi-tier user system (admin, beekeeper, volunteer)
- **Google Authentication**: Secure OAuth-based user authentication
- **Real-time Updates**: Live data synchronization across users
- **Mobile-friendly**: Responsive design for field data collection

## Architecture

The application follows a modern containerized microservices architecture:

```
                                 Internet/Users
                                      │
                               ┌──────┴──────┐
                               │    Nginx    │ (ports 80/443)
                               │   Proxy     │ ┌─ SSL Termination
                               │  Container  │ ├─ velutina.ovh
                               └──────┬──────┘ ├─ dev.velutina.ovh
                                      │        └─ auth.velutina.ovh
                        ┌─────────────┼─────────────┐
                        │             │             │
              ┌─────────▼───────────┐ │  ┌─────────▼──────────┐
              │    Frontend         │ │  │   Authentication   │
              │   (Production)      │ │  │    (Keycloak)      │
              │   Static Files      │ │  │     Container      │
              │  /usr/share/nginx/  │ │  │       :8080        │
              └─────────────────────┘ │  └─────────┬──────────┘
                                      │            │
              ┌─────────────────────┐ │            │
              │    Frontend Dev     │ │    ┌───────▼────────┐
              │   (Vite Server)     │ │    │   Keycloak     │
              │      :5173          │ │    │   Database     │
              │   [dev profile]     │ │    │ (PostgreSQL)   │
              └─────────────────────┘ │    └────────────────┘
                                      │
                            ┌─────────▼──────────┐
                            │    Backend API     │
                            │    (Django)        │
                            │      :8000         │
                            └─────────┬──────────┘
                                      │
                            ┌─────────▼──────────┐
                            │   Main Database    │
                            │ (PostgreSQL +      │
                            │    PostGIS)        │
                            └────────────────────┘

Volume Mounts:
├─ frontend-dist:/usr/share/nginx/ (Built React app)
├─ api-db:/var/lib/postgresql/     (Main database data)
└─ keycloak-db:/var/lib/postgresql/(Auth database data)
```

## Technology Stack

### Backend
- **Framework**: Django 5.2+ with Django REST Framework
- **Database**: PostgreSQL 17 with PostGIS 3 for spatial data
- **Authentication**: JWT tokens with Keycloak integration
- **API Documentation**: Interactive OpenAPI 3.1.1 documentation
- **Server**: Gunicorn WSGI server

### Frontend
<!-- Frontend documentation will be added here -->

### Infrastructure
- **Reverse Proxy**: Nginx with SSL termination
- **Authentication Server**: Keycloak 26.2 with Google OAuth provider
- **SSL Certificates**: Let's Encrypt with automated renewal
- **Containerization**: Docker Compose for orchestration
- **Database**: PostGIS-enabled PostgreSQL for geospatial operations

## Project Structure

```
hornet-finder/
├── backend/           # Django REST API
│   ├── hornet/        # Main application models and views
│   ├── hornet_finder_api/  # Project settings and configuration
│   └── README.md      # Backend documentation
├── frontend/          # React TypeScript application
│   ├── src/           # Source code
│   └── README.md      # Frontend documentation (TBD)
├── auth/              # Keycloak authentication service
│   ├── realm-export.json  # Pre-configured realm
│   └── README.md      # Authentication documentation
├── postgis/           # PostgreSQL + PostGIS database
│   ├── initdb-postgis.sh   # Database initialization
│   └── README.md      # Database documentation
├── nginx/             # Reverse proxy configuration
│   ├── conf.d/        # Nginx configuration files
│   └── README.md      # Proxy documentation
├── certbot/           # SSL certificate management
└── docker-compose.yml # Service orchestration
```

## Core Features

### Data Models

#### Hornet Sightings
- **Location**: Precise GPS coordinates with PostGIS point geometry
- **Flight Data**: Direction and duration of observation
- **Identification**: Color marking system for individual tracking
- **Metadata**: Timestamp, observer, and optional nest association

#### Nest Records
- **Geographic Data**: Location with address information
- **Status Tracking**: Creation, destruction status, and timestamps
- **Access Control**: Public/private location designation
- **Documentation**: Comments and observation notes

#### Apiary Management
- **Location Tracking**: Beehive geographic positions
- **Infestation Monitoring**: Three-level infestation assessment
- **Historical Data**: Temporal tracking of infestation changes
- **Owner Management**: Beekeeper association and contact information

### User Roles

1. **Admin**: Full system administration and user management
2. **Beekeeper**: Professional beekeepers with enhanced data access
3. **Volunteer**: Community members with basic reporting capabilities

## Deployment

### Prerequisites

- Docker and Docker Compose
- Domain name with DNS configuration
- Email address for Let's Encrypt certificate registration

### Environment Configuration

Create a `.env` file in the project root:

```env
# Application Settings
COMPOSE_PROFILES=dev                          # Use 'dev' for development mode
DEBUG=False                                   # Set to True for development
DJANGO_SECRET_KEY=your_secret_key_here        # Django cryptographic key
HOST=your_domain.com                          # Your domain name
DEV_HOST=dev.your_domain.com                  # Development domain

# Network Configuration  
PROXY_PORT=80                                 # HTTP port (80 for production)

# Database Configuration
DB_PASSWORD=your_secure_db_password           # PostgreSQL password

# Authentication Configuration
KEYCLOAK_DB_PASSWORD=your_keycloak_db_pass    # Keycloak database password
KC_BOOTSTRAP_ADMIN_PASSWORD=admin_password    # Initial Keycloak admin password
KC_HOSTNAME=auth.your_domain.com              # Keycloak hostname (use 0.0.0.0:8080 for local)
KC_CLIENT_SECRET=secret                       # Client secret from Keycloak hornet-api client
```

### Production Deployment

1. **Clone the repository**:
```bash
git clone https://github.com/mdevolde/hornet-finder.git
cd hornet-finder
```

2. **Configure environment variables** (see above)

<!-- Next steps will be added here -->

## API Documentation

The REST API provides full CRUD operations for all data models:

- **Base URL**: `/api/`
- **Authentication**: JWT Bearer tokens
- **Documentation**: Interactive Swagger UI at `/api/docs/`
- **Schema**: OpenAPI 3.1.1 specification

### Core Endpoints

```
GET|POST /api/hornets/              # Hornet sightings
GET|POST /api/nests/                # Nest records  
GET|POST /api/apiaries/             # Apiary data
GET|PUT|DELETE /api/{resource}/{id}/ # Individual resource operations
```

## Component Documentation

Each major component has detailed documentation:

- **[Backend API](./backend/README.md)**: Django REST API with spatial capabilities
- **[Authentication](./auth/README.md)**: Keycloak setup and Google OAuth integration
- **[Database](./postgis/README.md)**: PostGIS spatial database configuration
- **[Reverse Proxy](./nginx/README.md)**: Nginx SSL termination and routing
- **[Frontend](./frontend/README.md)**: *Documentation coming soon*

## Security Features

- **HTTPS Everywhere**: Full SSL/TLS encryption with HTTP to HTTPS redirect
- **JWT Authentication**: Secure token-based API access
- **OAuth Integration**: Google authentication for user management
- **Role-based Access**: Granular permissions based on user roles
- **CORS Protection**: Proper cross-origin resource sharing configuration
- **SQL Injection Prevention**: Django ORM with parameterized queries
- **XSS Protection**: Content Security Policy and input sanitization

## Monitoring and Maintenance

### Logging
```bash
# View service logs
docker compose logs [service_name]

# Follow real-time logs
docker compose logs -f [service_name]

# Available services: nginx, hornet-finder-api, hornet-finder-keycloak, hornet-finder-api-db
```