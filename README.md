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
- **Authentication Server**: Keycloak 26.7 with Google OAuth provider
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

## Installation

### Prerequisites

- Git with worktree support
- Docker Engine and Docker Compose v2
- DNS records for the environment being deployed
- A valid email address for Let's Encrypt
- An initialized Keycloak realm and client for the selected environment

### Initial setup

The repository uses one worktree per environment. Each worktree has its own
ignored `.env` file, Docker Compose project, database volumes, and certificates.
The `.env` file is never shared between development and production.

1. Clone the repository and enter the main worktree:

```bash
git clone https://github.com/mdevolde/hornet-finder.git
cd hornet-finder
```

2. Create a dedicated development worktree if needed:

```bash
git worktree add ../hornet-finder-dev devel
```

3. In each worktree, create the local environment file from the template:

```bash
cp .env.example .env
```

4. Edit `.env`. Keep only one profile active and set `APP_ENV` to `dev` or
`prod`. The development and production example values are documented directly
in `.env.example`; all placeholder secrets must be replaced.

5. Make sure the Keycloak client matches the selected profile:

| Profile | Realm | Client ID | Hostname |
| --- | --- | --- | --- |
| `dev` | `hornet-finder-dev` | `hornet-api-dev` | `auth.dev.velutina.ovh` |
| `prod` | `hornet-finder` | `hornet-api` | `auth.velutina.ovh` |

`KC_CLIENT_SECRET` must be the current secret of that client. Do not reuse the
database passwords between environments.

6. Validate the Compose configuration without starting services:

```bash
docker compose-f docker-compose.dev.yml config --quiet
```

Use `docker-compose.prod.yml` in the production worktree.

### Deployment

The scripts detect the environment from `APP_ENV`; no `-e dev|prod` option is
needed:

```bash
./deploy.sh
```

Useful commands:

```bash
./deploy.sh -s api       # Rebuild and restart the API
./logs.sh api            # Show API logs
./logs.sh -f keycloak    # Follow Keycloak logs
./shutdown.sh            # Stop this worktree's environment
./deploy-certs.sh        # Generate certificates for this worktree
```

The development and production Compose files use different service names,
networks, database volumes, frontend setup, and Certbot directories. Always run
these commands from the intended worktree. Do not use `--volumes` unless data
removal is explicitly intended.

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