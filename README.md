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
├── docker-compose.{dev,prod}.yml               # One self-contained stack per environment
├── docker-compose.{dev,prod}.external-volumes.yml  # Overlay: map data volumes to external volumes
├── deploy.sh, shutdown.sh, logs.sh, deploy-certs.sh  # Operations (environment from .env)
├── storage-init.sh    # Provision external volumes (and ZFS datasets when configured)
├── status.sh          # Read-only environment status report
├── zfs-snapshot.sh    # Snapshot management for the ZFS backend
└── lib/               # Shared shell libraries (common.sh, volumes.sh, zfs.sh)
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

   Beyond the application secrets, `.env` also drives the stack itself:

   - `COMPOSE_FILE` lists the Compose files of this worktree. Docker Compose
     reads it natively, so a plain `docker compose <cmd>` run from the worktree
     root always uses the right files. Never pass `-f` by hand.
   - `API_DB_VOLUME`, `KEYCLOAK_DB_VOLUME`, `FRONTEND_DIST_VOLUME` name the
     external Docker volumes holding the data. They are the single source of
     truth for both the `external-volumes` overlay and the scripts. Leave a
     variable empty when the environment has no such volume (dev has no
     `frontend-dist`).
   - `ZFS_PARENT` (optional) selects the ZFS backend: one dataset per volume,
     named `<ZFS_PARENT>/<volume>`. Leave it empty on a host without ZFS.

5. Make sure the Keycloak client matches the selected profile:

| Profile | Realm | Client ID | Hostname |
| --- | --- | --- | --- |
| `dev` | `hornet-finder-dev` | `hornet-api-dev` | `auth.dev.velutina.ovh` |
| `prod` | `hornet-finder` | `hornet-api` | `auth.velutina.ovh` |

`KC_CLIENT_SECRET` must be the current secret of that client. Do not reuse the
database passwords between environments.

6. Validate the Compose configuration without starting services:

```bash
docker compose config --quiet
docker compose config --format yaml | grep -c 'external: true'   # 2 in dev, 3 in prod
```

7. Provision the storage once, before the first deployment:

```bash
./storage-init.sh --dry-run   # Show what would be created
./storage-init.sh             # Create missing datasets (ZFS) and volumes
```

### Storage

Data lives in external Docker volumes that the stack never creates or removes:
`deploy.sh` only checks that they exist and stops with a clear message
otherwise. `storage-init.sh` is the only script that creates storage, and it
is idempotent.

With `ZFS_PARENT` set, `storage-init.sh` creates the dataset backing each
volume *before* the Docker volume, so that Docker writes into the mounted
dataset. The parent dataset itself (`ZFS_PARENT`) is host provisioning and is
never created by the scripts. The only link between a dataset and its volume is
the name; Docker owns the directory layout under the mountpoint, and no script
derives a path from it.

On a host without ZFS, leave `ZFS_PARENT` empty: `storage-init.sh` creates
plain local Docker volumes and no `zfs` command is ever run. Everything else
is unchanged.

Snapshots of the ZFS backend are managed with `./zfs-snapshot.sh`
(`create [--tag TAG]`, `list`, `clean -k DAYS`, `delete SUFFIX...`,
`restore SUFFIX`). `restore` rolls every dataset back to the same snapshot
suffix; it refuses to run while the stack is up and asks for an explicit
confirmation.

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
./status.sh              # Read-only status report (config, storage, services, certs, endpoints)
```

The development and production Compose files use different service names,
networks, database volumes, frontend setup, and Certbot directories. Always run
these commands from the root of the intended worktree: `COMPOSE_FILE` in
`.env` is only picked up there. Do not use `--volumes` unless data removal is
explicitly intended (external volumes are never removed by Compose).

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