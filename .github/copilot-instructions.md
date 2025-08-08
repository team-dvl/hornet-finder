# Copilot Instructions for Hornet Finder

## Architecture Overview
- **Containerized Microservices**: 5 main services: `frontend` (React/Vite/TypeScript), `backend` (Django REST + PostGIS), `auth` (Keycloak), `postgis` (PostgreSQL+PostGIS), and `nginx` (reverse proxy/SSL/static files)
- **Data Flow**: Frontend (React + PWA) → Nginx → Backend API (Django REST) ↔ PostGIS database. Authentication via Keycloak (OAuth2/JWT with service worker-based token management)
- **Environments**: Production (`velutina.ovh` and `auth.velutina.ovh`), development (`dev.velutina.ovh` and `auth.dev.velutina.ovh`)
- **Key Files**: `docker-compose.yml` (base), `docker-compose.{dev,prod}.yml` (environment-specific overrides), `docker-compose.{dev,prod}.zfs.yml`

## Critical Developer Workflows
- **Full Stack Development**: `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build` 
- **Frontend Only**: `cd frontend && npm run dev` (Vite dev server on :5173)
- **Backend Management**: `cd backend && python manage.py migrate|createsuperuser|collectstatic`
- **Deployment**: Use `./deploy.sh {dev|prod}` - handles environment selection, frontend build, Docker composition
- **SSL Management**: `./deploy-certs.sh` and `./generate-certs-dev.sh` for Let's Encrypt certificates
- **Debugging**: `docker-compose logs <service>`

## Project-Specific Conventions
- **No Local Registration**: Users ONLY authenticate via Keycloak (auth.velutina.ovh for prod, auth.dev.velutina.ovh for dev). No passwords/emails stored in app
- **Geospatial First**: All location data uses PostGIS `PointField` (EPSG:4326). Base pattern: `GeolocatedModel` abstract class auto-generates `point` field from `latitude`/`longitude`
- **Role-Based Access**: 3 roles (`admin`, `beekeeper`, `volunteer`) + group-based permissions. See `auth/realm-export.json` and `backend/hornet/models.py` (`BeekeeperGroup`, `ApiaryGroupPermission`)
- **JWT Auth Pattern**: Custom `JWTBearerAuthentication` validates Keycloak tokens. API endpoints use `HasAnyRole` permission class
- **PWA Auth**: Service worker (`frontend/src/sw-auth-extension.js`) manages token lifecycle, auto-refresh, offline state
- **Environment Variables**: Each service uses `.env` files. See `.env.{dev,prod}.example` for required vars

## Data Model Patterns
- **Core Entities**: `Hornet` (sightings with colors/direction), `Nest` (destruction tracking), `Apiary` (infestation monitoring)
- **Geospatial Queries**: Use Django's `GeographicFilterMixin` pattern in views for radius-based filtering (`lat`, `lon`, `radius` params)
- **User Model**: Simple UUID-based `User` model synced from Keycloak (no Django auth)
- **PostGIS Integration**: Models inherit from `GeolocatedModel` for automatic point generation from lat/lng

## Frontend Architecture
- **Tech Stack**: React 19 + TypeScript + Vite + Bootstrap + Leaflet maps + Redux Toolkit
- **Development vs Production**: Vite dev server (`:5173`) only used in dev with volume-mounted frontend directory for hot reload. Production serves pre-built static files via Nginx
- **PWA Features**: Service worker auth extension, offline capability via `vite-plugin-pwa`
- **Auth Flow**: `react-oidc-context` + custom service worker for token management
- **Key Dependencies**: `leaflet`/`react-leaflet` (maps), `jwt-decode`, `axios`, `bootstrap`/`react-bootstrap`

## Integration Points
- **Frontend ↔ Backend**: REST API documented in `backend/README.md`. All endpoints require JWT Bearer token except health checks
- **Backend ↔ PostGIS**: Django ORM with `django.contrib.gis`. Use `Distance`, geographic filtering in querysets
- **Auth Integration**: `JWTBearerAuthentication` validates Keycloak JWT tokens, creates `JWTUser` objects with roles/groups
- **Nginx Routing**: Prod serves static files directly, proxies `/api/*` to Django, handles SSL termination
- **Docker Composition**: Base `docker-compose.yml` + environment overlays. Services communicate via container names

## Examples & Patterns
- **Model Example**: `backend/hornet/models.py` - `GeolocatedModel` pattern, PostGIS fields, validation
- **API Views**: `backend/hornet/views.py` - `GeographicFilterMixin`, authentication, serializers
- **Frontend Auth**: `frontend/src/sw-auth-extension.js` - service worker token management
- **Deployment Script**: `./deploy.sh prod` - builds frontend, composes services, loads environment
- **Geographic Queries**: `?lat=45.5&lon=2.5&radius=10` for 10km radius searches

## Tips
- Always use Docker for local dev to match prod.
- For debugging, use `docker-compose logs <service>`.
- For SSL, use `deploy-certs.sh` and see `nginx/README.md` for renewal.

## Style Guide
- function names, comments, docstrings, etc: use English.
- code comments should be clear and concise. Always in english,
- for git commits: always in English, with the usual prefix ('feat:, fix;, refactor;, ...').
- when renaming or deleting a file, try with 'git mv' or 'git rm' to keep history, when appropriate.


---

If you are unsure about a workflow or integration, check the relevant `README.md` in each service directory for details and examples.
