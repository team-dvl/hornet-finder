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
- **Phone screenshots**: `./ui-shots.sh [-d ip14|se|w320|pixel7|galaxy] [-o dir]` walks the main screens with Playwright (WebKit for iPhones, Chromium for Android) as the dev test admin, opens dialogs without submitting, reports horizontal overflow; dev only, creates and deletes its own fixtures. Screenshots land in `ui-shots/` (ignored by git)
- **Traps smoke test**: `./smoke-traps.sh` walks the traps API with the dev-only Keycloak test accounts (`KC_TEST_*` in `.env`); dev only, creates and deletes its own data
- **Catch-all mailbox (dev only)**: all dev emails (Keycloak, Django) land in Mailpit, never relayed: UI at `https://dev.velutina.ovh/mail/` (Keycloak SSO, realm role `mail-reader`), API via `./mail-api.sh list|search|get|links|clear`. See `doc/mail-catcher.md`
- **Keycloak Admin API access**: a confidential client with a service account, `flow-admin` (no login screen, no user, no password grant; realm-management roles on the app realm, not on master: `manage-realm`, `view-realm`, `manage-clients`, `view-clients`, `manage-identity-providers`, `view-identity-providers`, `view-users`), is available for the Keycloak REST Admin API (auth flows, realm roles, groups, clients, identity providers). Credentials are in `.env`: `FLOW_ADMIN_SECRET` (and `FLOW_ADMIN_CLIENT_ID` if set, otherwise `flow-admin`). Get a token with the `client_credentials` grant on the app realm (`hornet-finder` in prod, `hornet-finder-dev` in dev): `curl -s -d grant_type=client_credentials -d client_id=flow-admin --data-urlencode "client_secret=$FLOW_ADMIN_SECRET" https://$KC_HOSTNAME/realms/<realm>/protocol/openid-connect/token`, then call `https://$KC_HOSTNAME/admin/realms/<realm>/...`. It deliberately lacks `manage-users`: add it only case by case, with the user's agreement, and remove it afterwards. Never print the secrets; read-only calls are fine, confirm with the user before any write, especially in prod
- **Prod migrations**: any change needing more than `./deploy.sh` in prod gets a note in `doc/prod-migrations/NNNN-slug.md` (`status: pending`, template in its `README.md`), written in dev and committed with the change. Prod applies pending notes after merging `devel`, marks them `status: applied (date)`, never deletes them. This is the only channel between the dev and prod worktrees: never edit the other worktree, never read its `.env`
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

## Mobile UX Guidelines
The phone is the primary target: iPhone (Safari/WebKit, reference iPhone 14, 390 px) and Android (Chrome, 360-412 px) alike, down to 320 px. The desktop is the easy case.
- **Screen budget first**: every pixel on a phone must earn its place. No decorative headers, no text repeating a title, a badge or a label, no read-only coordinates (an address, or nothing). Page titles are hidden on a phone, where the navbar already names the page; `PageHeader` shows the page's one-sentence description there instead.
- **Explanations go in `HelpTip`** (`components/common/HelpTip.tsx`), never as paragraphs, `Form.Text` hints or info `Alert`s. Visible text is limited to labels, values, errors and consequences the user must see before acting.
- **Dialogs use `AppModal`** (`components/ui`): full screen below `sm`, scrollable body, footer for actions only, back-to-top button, safe areas. Scrolling pages get their back-to-top button from `PageLayout`. Never a raw `<Modal>`. Short choices and panels use `BottomSheet`, confirmations `ConfirmDialog` (or `ConfirmationModal` for delete/archive).
- **One way to close**: the header close button. No "Fermer" button; forms have no "Annuler" either (the close button cancels, `locked` keeps a stray tap outside from losing the input). Only a confirmation asks "Annuler / <action>".
- **One dialog at a time**: never stack a dialog on another. A confirmation, sub-form or photo replaces the dialog it comes from (hide the parent while the child is shown); pickers render inline. The map keeps a single modal through `useMapModals`.
- **Back closes the overlay**: the Android back button / iOS back swipe closes the open dialog or sheet; `AppModal` and `BottomSheet` do it through `useOverlayHistory`. Custom overlays must use that hook too.
- **Icons, not words, for secondary actions**: `IconButton` (icon only on a phone, label from `sm` up, `aria-label` + tooltip always). The main action of a screen keeps icon + short verb: "Enregistrer", "Ajouter", "Capture". Action bars of object sheets use `.sheet-actions`.
- **Icons come from bootstrap-icons** (action names in `utils/icons.ts`); map objects keep their emoji (`OBJECT_ICONS`). FontAwesome is not loaded: `fa-*` classes render nothing.
- **Touch**: targets ≥ 44×44 px; fields ≥ 16 px on touch screens (smaller makes iOS zoom on focus), so no `size="sm"` form controls; `inputMode="numeric"` for numbers; no `autoFocus` that pops the keyboard over what the user must see.
- **Native or touch controls over desktop widgets**: native `select`, `date`, `datetime-local`, `details`; chips, segmented buttons and swatch grids (`ColorSelector`, `InfestationLevelInput`) instead of dropdown menus; bottom sheets instead of popovers.
- **No overflow, no nested scrolling**: rows of buttons wrap (`flex-wrap`), long text truncates (`text-truncate`, `ClampedText`), flex children that must keep their shape get `flex-shrink: 0`. Nothing scrolls sideways, not even a box inside the page (tables become lists on a phone, see `ReferentialTable`); a dialog body is the only scrolling box (paginate long lists instead of boxing them). Tiles sit in `.tile-grid` (equal heights, two columns on a phone).
- **Viewport**: heights in `dvh` with a `vh` fallback; edges respect `env(safe-area-inset-*)`.
- **Navbar**: always one line; the menu button never moves; on a phone the breadcrumb is a back link plus the current level.
- **Map**: at most three floating buttons (position, layers, add); filters and admin tools live in the layers sheet, additions in the add sheet. Nests, apiaries and traps share one cluster group (`MarkerClusterGroup`), so markers never stack at any zoom: a tap on a cluster fans out up to 8 objects around their spot, zooms in on larger spread-out clusters, and lists the others in the overlap sheet.
- **Consistency**: dates through `utils/format.ts` (`fr-BE`); object sheets built from `FieldRow`; no inline colours or sizes on buttons, shared CSS classes in `App.css` instead.
- **Check on both engines**: any UI change is checked with `./ui-shots.sh` (WebKit and Chromium, 320 px included) before it is committed, not only in a desktop browser.

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
