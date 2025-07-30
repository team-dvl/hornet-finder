# Copilot Instructions for Hornet Finder

## Architecture Overview
- **Microservices, Dockerized**: The project is split into `frontend` (React/Vite), `backend` (Django REST + PostGIS), `auth` (Keycloak), `postgis` (PostgreSQL+PostGIS), and `nginx` (reverse proxy/SSL/static).
- **Data Flow**: Users interact via the frontend, which communicates with the backend API (Django) via REST. Authentication is handled by Keycloak (OAuth2/JWT). All geospatial data is stored in PostGIS.
- **Domains**: `velutina.ovh` (prod), `dev.velutina.ovh` (dev), `auth.velutina.ovh` (auth service).

## Developer Workflows
- **Build all services**: Use `docker-compose up --build` from the repo root. For frontend-only: `cd frontend && npm run build`.
- **Backend (Django)**: Use `manage.py` for migrations, superuser, etc. (`cd backend`).
- **Frontend (Vite/React)**: Dev server: `npm run dev` in `frontend/`. Production build: `npm run build`.
- **Auth (Keycloak)**: Managed via Docker; config in `auth/realm-export.json` and `auth/docker-entrypoint.sh`.
- **Database**: PostGIS setup/updates via scripts in `postgis/`.
- **Nginx**: Configs in `nginx/conf.d/`, SSL via Let's Encrypt, see `deploy-certs.sh`.

## Project-Specific Conventions
- **No local user registration**: All users authenticate via Keycloak (auth.velutina.ovh); no passwords stored in the app; no email or GDPR-sensitive data in the app.
- **Environment Variables**: Use `.env` files for service-specific configs (see `docker-compose.yml`).
- **Role-based access**: Roles are `admin`, `beekeeper`, `volunteer` (see `auth/realm-export.json`).
- **Group-based access**: Users can belong to multiple groups, with permissions managed at the group level.
- **Geospatial everywhere**: All location data uses PostGIS types (EPSG:4326). Models: see `backend/hornet/models.py`.
- **API Auth**: JWT Bearer tokens from Keycloak; see `backend/hornet_finder_api/authentication.py`.
- **Frontend Auth**: Uses `sw-auth-extension.js` for service worker-based auth.
- **API Docs**: Swagger/OpenAPI at `/api/docs/` (dev only).

## Integration Points
- **Frontend <-> Backend**: REST API, endpoints in `backend/README.md`.
- **Backend <-> DB**: Django ORM with PostGIS fields.
- **Backend <-> Auth**: JWT validation, see `backend/hornet_finder_api/authentication.py`.
- **Nginx**: Handles SSL, static, and API proxying. See `nginx/README.md` and `nginx/conf.d/prod.conf`.

## Examples & Patterns
- **Model Example**: See `backend/hornet/models.py` for geospatial fields.
- **API Example**: See `backend/README.md` for endpoint structure.
- **Frontend Auth**: See `frontend/src/sw-auth-extension.js` for service worker integration.
- **Keycloak Realm**: See `auth/realm-export.json` for roles/clients.

## Tips
- Always use Docker for local dev to match prod.
- For debugging, check logs in `logs/` and use `docker-compose logs <service>`.
- For SSL, use `deploy-certs.sh` and see `nginx/README.md` for renewal.

## Style Guide
- function names, comments, docstrings, etc: use English.
- code comments should be clear and concise. Always in english,
- for git commits: always in English, with the usual prefix ('feat:, fix;, refactor;, ...').


---

If you are unsure about a workflow or integration, check the relevant `README.md` in each service directory for details and examples.
