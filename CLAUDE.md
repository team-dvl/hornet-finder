# CLAUDE.md — Hornet Finder

## Architecture Overview
- **Containerized Microservices**: 5 main services: `frontend` (React/Vite/TypeScript), `backend` (Django REST + PostGIS), `auth` (Keycloak), `postgis` (PostgreSQL+PostGIS), and `nginx` (reverse proxy/SSL/static files)
- **Data Flow**: Frontend (React + PWA) → Nginx → Backend API (Django REST) ↔ PostGIS database. Authentication via Keycloak (OAuth2/JWT with service worker-based token management)
- **Environments**: Production (`velutina.ovh` and `auth.velutina.ovh`), development (`dev.velutina.ovh` and `auth.dev.velutina.ovh`). One git worktree per environment, each with its own `.env` (`APP_ENV=dev|prod`)
- **Key Files**: `docker-compose.{dev,prod}.yml` (two self-contained stacks, there is NO base `docker-compose.yml`), `docker-compose.{dev,prod}.external-volumes.yml` (overlay mapping data volumes to pre-provisioned external volumes). `COMPOSE_FILE` in `.env` selects them: never pass `-f` by hand, always run from the worktree root

## Critical Developer Workflows
- **Full Stack Development**: `./deploy.sh` from the dev worktree (or plain `docker compose up -d --build`; `COMPOSE_FILE` in `.env` picks the files)
- **Frontend Only**: `cd frontend && npm run dev` (Vite dev server on :5173)
- **Backend Management**: `cd backend && python manage.py migrate|createsuperuser|collectstatic`
- **Storage Provisioning**: `./storage-init.sh` once per worktree before the first deploy. It is the ONLY script that creates volumes/datasets; `deploy.sh` only verifies they exist and aborts otherwise (fail-safe, no implicit creation anywhere)
- **Deployment**: `./deploy.sh` (environment from `APP_ENV` in `.env`, no argument), `./deploy.sh -s api` for one service, `-b` to rebuild the prod frontend
- **SSL Management**: `./deploy-certs.sh` (Let's Encrypt, environment from `.env`)
- **Debugging**: `./logs.sh [-f] <service>` or `docker compose logs <service>`
- **Status**: `./status.sh [--no-net]` prints a read-only report (config, compose, storage, services, certificates, endpoints); exit 1 on any failure
- **Traps smoke test**: `./smoke-traps.sh` walks the traps API with the dev-only Keycloak test accounts (`KC_TEST_*` in `.env`); dev only, creates and deletes its own data
- **ZFS**: optional backend selected by `ZFS_PARENT` in `.env`; `./zfs-snapshot.sh create|list|clean|delete|restore`. ZFS logic lives ONLY in `lib/zfs.sh`, `storage-init.sh` and `zfs-snapshot.sh`; keep it out of every other script

## Project-Specific Conventions
- **No Local Registration**: Users ONLY authenticate via Keycloak (auth.velutina.ovh for prod, auth.dev.velutina.ovh for dev). No passwords/emails stored in app
- **Geospatial First**: All location data uses PostGIS `PointField` (EPSG:4326). Base pattern: `GeolocatedModel` abstract class auto-generates `point` field from `latitude`/`longitude`
- **Role-Based Access**: 3 roles (`admin`, `beekeeper`, `volunteer`) + group-based permissions. See `auth/realm-export.json` and `backend/hornet/models.py` (`BeekeeperGroup`, `ApiaryGroupPermission`)
- **JWT Auth Pattern**: Custom `JWTBearerAuthentication` validates Keycloak tokens. API endpoints use `HasAnyRole` permission class
- **PWA Auth**: Service worker (`frontend/src/sw-auth-extension.js`) manages token lifecycle, auto-refresh, offline state
- **Environment Variables**: one `.env` per worktree, from `.env.example` (dev profile active, prod profile commented). Besides secrets it holds `COMPOSE_FILE`, the volume names (`API_DB_VOLUME`, `KEYCLOAK_DB_VOLUME`, `FRONTEND_DIST_VOLUME`: single source of truth for the compose overlay AND the scripts) and `ZFS_PARENT`
- **Storage Invariants**: dataset name == volume name (`<ZFS_PARENT>/<volume>`); never derive a filesystem path from a dataset mountpoint (Docker owns the `_data` layout underneath); existence checks go through `docker volume inspect` / `zfs list` only

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
- **Docker Composition**: `docker-compose.{dev,prod}.yml` + `external-volumes` overlay, selected by `COMPOSE_FILE` in `.env`. Services communicate via container names

## Examples & Patterns
- **Model Example**: `backend/hornet/models.py` - `GeolocatedModel` pattern, PostGIS fields, validation
- **API Views**: `backend/hornet/views.py` - `GeographicFilterMixin`, authentication, serializers
- **Frontend Auth**: `frontend/src/sw-auth-extension.js` - service worker token management
- **Deployment Script**: `./deploy.sh -b` from the prod worktree - builds frontend, composes services, loads environment
- **Shell Libraries**: `lib/common.sh` (env loading, service aliases, UI), `lib/volumes.sh` (Docker volumes, verify-only for deploy), `lib/zfs.sh` (ZFS backend)
- **Geographic Queries**: `?lat=45.5&lon=2.5&radius=10` for 10km radius searches

## Tips
- Always use Docker for local dev to match prod.
- For debugging, use `./logs.sh <service>` or `docker compose logs <service>` from the worktree root.
- For SSL, use `deploy-certs.sh` and see `nginx/README.md` for renewal.

## Style Guide
- Function names, comments, docstrings, etc: use English.
- Code comments should be clear and concise. Always in English.
- For git commits: always in English, with the usual prefix (`feat:`, `fix:`, `refactor:`, ...).
- When renaming or deleting a file, use `git mv` or `git rm` to keep history, when appropriate.

---

If you are unsure about a workflow or integration, check the relevant `README.md` in each service directory for details and examples.
