# Hornet Finder API

A RESTful API built with Django and Django REST Framework for managing hornet detection data, including hornets, nests, and apiaries with geospatial capabilities.

## Features

- **Hornet Tracking**: Record hornet sightings with location, direction, duration, and color markings
- **Nest Management**: Track hornet nests with location, status, and destruction records
- **Apiary Monitoring**: Monitor beehive infestation levels with geospatial data
- **Geospatial Support**: PostGIS integration for location-based queries and analysis
- **JWT Authentication**: Secure API access with JSON Web Token authentication
- **API Documentation**: Interactive Swagger/OpenAPI documentation
- **RESTful Design**: Full CRUD operations with standard HTTP methods

## Technology Stack

- **Framework**: Django 5.2+ with Django REST Framework
- **Database**: PostgreSQL with PostGIS extension
- **Authentication**: JWT Bearer token authentication with Keycloak integration
- **Documentation**: drf-spectacular (OpenAPI 3.1.1)
- **Server**: Gunicorn WSGI server
- **Python**: 3.9+

## API Endpoints

### Core Resources

- `GET|POST /api/hornets/` - List all hornets or create a new hornet sighting
- `GET|PUT|PATCH|DELETE /api/hornets/{id}/` - Retrieve, update, or delete a specific hornet
- `GET|POST /api/nests/` - List all nests (hunters, beekeepers, admins) or report a new nest (every role)
- `GET /api/nests/my/` - The nests the requester reported, with the filters of the list (what a trapper sees besides the destroyed ones)
- `GET|POST /api/nests/` also takes `multipart/form-data`: up to 10 `photos` files with the report (resized to 1600 px, plus a 320 px thumbnail). Every nest in the list carries its `photos` (`url`, `thumbnail_url`, private media) and `permissions` (`update`, `photos`, `reactivate`, `delete`, `nearby_apiaries`) for the requester. The reporter (`created_by`) is always the requester, never a field
- `GET|DELETE /api/nests/{id}/` - Retrieve or delete a nest (platform admins)
- `PUT|PATCH /api/nests/{id}/` - Update a nest: platform admins and administrators of the nest hunters (`/hunters/admin`). `destroyed_at` is set when `destroyed` turns true (now, unless a date is given, never in the future) and kept afterwards; a destroyed nest turns back to active (`destroyed: false`, date cleared) through a platform admin only, otherwise 400
- `POST /api/nests/{id}/photos/` - Add photos (`photos` files, up to 10), same rights as the update; returns the nest
- `DELETE /api/nests/{id}/photos/{photo_id}/` - Remove a photo, same rights; returns the nest
- `GET /api/nests/{id}/nearby-apiaries/` - AFSCA numbers of the apiaries within 1 km of the nest, `["9.005.577.599", …]`, each once, sorted by number; apiaries without a number are left out. No distance and no order by distance: they would locate the apiaries. Same rights as the update (apiaries are private)
- `GET|POST /api/apiaries/` - Apiaries around a position (`lat`, `lon`, `radius`, `mine`) the caller may see, or create one (the caller becomes its owner)
- `GET|PUT|PATCH|DELETE /api/apiaries/{id}/` - Retrieve, update, or delete a specific apiary
- `GET /api/apiaries/managed/` - Apiary manager, paginated (`page`, `page_size` up to 200, default 50). `scope`: `mine` (default), `shared` (apiaries shared with one of the caller's groups, parents of their subgroups included, their own excluded) or `all` (platform admins only). Filters: `group` (path of a group the apiary is shared with), `infestation_level` (`1`, `2`, `3`, or `none` for apiaries not assessed: the level is optional), `q` (number, address, AFSCA number, comments). `ordering`: `infestation_level`, `created_at`, `address`, `id`, `-` prefix for descending order, apiaries not assessed last either way; default `-infestation_level`. No ordering by distance (and no distance shown): it would locate the apiaries

### Traps

- `GET|POST /api/traps/` - Traps around a position (`lat`, `lon`, `radius`, `active`, `mine`), or create one. The listing is open to anonymous visitors, who get the public shape (no owner, no group, no journal) and only public traps. A trap whose type is `apiary_bound` (electric harp, muzzle...: only ever set up in front of hives) is never public, whatever its `visibility`: only its owner, the members of its delegated group and platform admins see it, on the map, in detail, through its photos and its QR tag. `publicly_visible` in the trap representation tells whether anonymous visitors see it
- `GET|PATCH|DELETE /api/traps/{id}/` - Detail with its journal, update (owner or platform admin), delete
- `GET /api/traps/my/` - Traps of the caller
- `GET /api/traps/managed/` - Trap manager, paginated (`page`, `page_size` up to 200, default 50). `scope`: `mine` (default), `delegated` (traps delegated to one of the caller's groups, parents of their subgroups included, their own excluded) or `all` (platform admins only). Filters: `active` (`true` by default, `false`, `all`), `group` (path), `trap_type` (slug), `has_tag`, `q` (number, address, comments, QR code). `ordering`: `last_event_at` (default, never visited traps first), `hornet_catch_count`, `installed_at`, `address`, `id`, `distance` (needs `lat`/`lon`, no radius limit since the scope already bounds the result), `-` prefix for descending order
- `POST|DELETE /api/traps/{id}/photo/` - Replace or remove the trap photo (multipart)
- `GET|POST /api/traps/{id}/events/` - Journal of the trap, or record an intervention (multipart, `photos` repeated). Reserved to the owner and the delegated group: platform admins do not record field work
- `POST /api/traps/{id}/catches/` - Record a visit (a reading, "relevé"): `items` (one `{species_slug, quantity}` per species, one event each; the Asian hornet may be at 0, which records a reading without catch, any other species needs at least 1), `bycatch_counted` (whether the other species were counted; forced to true when one is recorded, null when not said), `actions` (maintenance done during the visit: `cleaning`, `refill`, `repair`, one event each), `photo_N` for item N. Every event shares one `batch` and `performed_at`; `items` and `actions` are JSON strings in a multipart request
- `DELETE /api/traps/{id}/catches/{batch}/` - Remove a whole visit, catches and actions
- `GET|PUT|DELETE /api/traps/{id}/delegation/` - Current delegation and the groups the caller may pick, set a group, or withdraw the delegation
- `PUT /api/traps/{id}/owner/` - Reassign a bequeathed trap (platform admin only)
- `PATCH|DELETE /api/trap-events/{id}/` - Correct or remove a journal entry
- `DELETE /api/trap-photos/{id}/` - Remove one photo
- `GET|POST /api/trap-types/`, `GET|PATCH|DELETE /api/trap-types/{id}/` - Trap type referential; readable by any authenticated user, writable by platform admins. `apiary_bound` flags the types that would reveal an apiary. Deleting a type still in use answers 409 with its trap count
- `GET|POST /api/species/`, `GET|PATCH|DELETE /api/species/{id}/` - Species referential, same rules
- `GET /api/media/{path}` - Uploaded photo, served only to users allowed to see the owning trap (nginx does the transfer through X-Accel-Redirect)

### Statistics

Signed-in users (any role). Definitions and access rules: `doc/STATISTICS.md`; code in `hornet/stats/`.

- `GET /api/stats/` - Statistics the caller may open (`id`, `title`, `description`, `kind`, `filters`, `exports`: file formats, `email_link`: whether a link can be emailed, i.e. an SMTP server is set)
- `GET /api/stats/{id}/` - One table: `traps-catches` (Asian hornets per day, ISO week or month, per trap and per week with a 95 % Poisson interval, previous year alongside) `traps-species` (catches per species; share among the insects counted on complete readings, Wilson interval, and per bucket in `series`), `trap-types` (per type: rate and selectivity with Wilson interval) or `traps-ranking` (each trap the caller can see, with its address: rate per week with its interval from 7 trap-days, `order` = `rate`|`hornets`). Parameters: `period` (`d7`, `d30`, `month`, `season` with `season` = `spring`|`summer`|`late` and `year`, `year` with `year`, `custom` with `from`/`to`), `granularity` (`day`, `week`, `month`), `compare` (`false` to leave out the previous year), `trap_type` (slug), `group` (path, one of the caller's groups unless admin), `mine`, `lat`/`lon`/`radius` (km, 50 at most). Without a zone every trap is counted; with one, only the traps the caller can see (`scope` in the response says which). Errors are `{error}` in French
- Map statistics `traps-coverage` and `traps-pressure`: a 250 m grid in Belgian Lambert 2008 (EPSG:3812) over the zone (`lat`/`lon`/`radius`) or else the map view (`bbox` = `west,south,east,north`, required then); 422 above 10,000 cells (625 km2). `reach` (coverage, 100|250|500 m, default 250): radius of a trap; `bandwidth` (pressure, same values): Gaussian smoothing. The response adds `summary`, `area`, `traps` (in service, visible to the caller) and `cells` (GeoJSON of the covered cells with their `covered` share, or of the cells with at least 7 weighted trap-days with their `rate` and `level` in `bins`); `rows` list the cells for the exports. Only traps the caller can see are counted
- `POST /api/stats/{id}/export/` - `{format, params}`, a format among the statistic's `exports` (`xlsx`, `pdf` for the tables, `csv`): signed link (`url`, `filename`, `expires_in` = 900 s) carrying the query and the caller's rights
- `GET /api/stats/export/{token}/` - The file behind a link, no JWT; 410 once expired. The CSV uses `;` and decimal commas (UTF-8 with BOM); the XLSX adds a `Paramètres` sheet; the PDF (A4 landscape, parameters, charts, table) is served inline
- `POST /api/stats/{id}/email-link/` - `{params}`: emails the caller (the JWT's `email`, not stored) a link to `https://<HOST>/export/<token>`, valid one hour and ten downloads; sliding periods are frozen to their dates. Answers `sent_to` (masked) and `expires_at`; 429 beyond 5 emails an hour, 502 when sending fails, 503 without SMTP server (`EMAIL_HOST`)
- `GET /api/stats/exports/{token}/` - What an emailed link gives, no JWT, nothing computed (mail scanners open links): `summary`, `requested_by`, `expires_at`, `downloads_left`, `formats` with their URLs; 404 unknown, 410 expired or used ten times
- `GET /api/stats/exports/{token}/{format}/` - The file, computed now with the requester's rights frozen in the job; counts one download

### QR tags

Signed QR labels stuck on traps (`hornet/tags.py`). A tag is generated blank, then attached to a trap by scanning it. The QR code carries the Vedrin s'Abeille pictogram in its centre (`hornet/assets/tag-logo.png`), on error correction level Q so it stays readable. Printing lives in the frontend under Administration → QR Codes, open to every role; management is admin only.

- `GET /api/tags/` - Live tags of the caller, with their QR code as an SVG data URI and their `caption` ("Piège #12" for an attached tag, empty when free). `unassociated=1`: free tags (every free tag for a platform admin); `associated=1`: tags attached to the caller's own traps, to reprint a damaged label
- `POST /api/tags/batch/` - Generate `count` (1–48) blank tags signed with the active key
- `POST /api/tags/sheet/` - Signed link (`url`, valid 15 minutes) to the A4 PDF of the given `values` (up to 200): 4 × 6 labels of 45 mm with cut lines, vector QR codes (`hornet/tag_pdf.py`). An attached tag gets its caption under the code, so a reprint can be matched to its trap. Only non-revoked tags are printed, and a non-admin only gets their own (free ones they generated, attached ones on their traps); 400 when nothing is printable
- `GET /api/tags/{value}/` - Resolve a scanned tag: free, or the trap it is attached to. Every refusal (bad signature, unknown, revoked) is logged
- `GET /api/tags/{value}/candidates/` - Traps the caller may attach the tag to (`q` filters)
- `POST /api/tags/{value}/associate/` - Attach a free tag to `trap_id`; `replace: true` revokes the trap's current tag
- `GET /api/admin/tags/` - Every tag with its state (`status`, `key_index`, `q`, `offset`), platform admin only
- `GET /api/admin/tags/keys/` - Tags per signing key, to check before retiring a key
- `GET /api/admin/tags/{id}/qr/` - QR code of any tag, to reprint it
- `POST /api/admin/tags/sheet/` - Same signed link, for the selected `ids` (up to 200); revoked tags are skipped
- `GET /api/tags/sheet/{token}/` - The PDF behind a signed link, shown inline. No JWT: the signature stands for the rights checked when the link was made, so the browser's own PDF viewer can open it (an iOS home-screen app ignores `window.print()` and blob downloads). Tags revoked since then are left out; 410 once expired
- `POST /api/admin/tags/{id}/revoke/` - Revoke a tag, free or attached

### Beekeeper group invitations

An administrator of a beekeeper group (member of `/beekeepers/<id>/admin`) or a platform admin invites an existing, active account (enabled, email verified) to join `/beekeepers/<id>` by typing its full email address (`hornet/invitation_views.py`). The address only serves the Keycloak lookup: it is neither stored nor logged, and names shown with invitations are first/last names only, never an email. 10 addresses without an active account within 24 hours suspend the inviter's invitations for 24 hours (`InvitationThrottle`; a successful lookup does not reset the count). An invitation expires after 30 days. The invitee is emailed at their Keycloak address (`notified` in the creation response; a mail failure keeps the invitation). Accepting adds the invitee to the Keycloak group through the backend service account (`manage-users`).

- `GET /api/group-invitations/invitable/` - Groups the caller may invite to (`path`, and `name`: the Keycloak group's description, else its name) and `lookup` (`remaining_attempts`, `locked_until`)
- `GET|POST /api/group-invitations/` - Pending invitations of those groups, or invite (`group_path`, `email`). Errors carry a `code`: `no_active_user` (404, counted, with `remaining_attempts`), `locked` (429, `Retry-After`), `self`, `already_member`, `already_invited` (409); a malformed address (400) or a Keycloak failure (503) is not counted
- `POST /api/group-invitations/{id}/remind/` - Email the invitee again (any administrator of its group), at most once per 24 hours since the last email that left, the invitation's own included. Errors carry a `code`: `too_soon` (429, `next_reminder_at`), `inactive` (409, account disabled or deleted since), `mail_failed` (502, nothing counted). The listing gives `next_reminder_at` (null: now) and `reminders_sent`
- `DELETE /api/group-invitations/{id}/` - Withdraw a pending invitation (any administrator of its group)

The emails use the layout of the Keycloak email theme (`auth/themes/velutina/email/html/template.ftl`), read at sending time from `EMAIL_THEME_DIR` (the theme folder, mounted read-only by both compose files): no copy of the HTML, the logo travels inline (`cid:`). `hornet/emails.py` resolves the four FreeMarker expressions the layout uses and refuses any other, which the tests catch; without the theme, the email goes as plain text.
- `GET /api/groups/` - The beekeeper groups the caller administers (`path`, `name`), every one for a platform admin
- `GET /api/groups/members/?group_path=` - Members of a group, administrators first: `guid`, `name` (first and last name, `null` without one, never an email), `is_admin`, `is_self`; `has_admin_group` tells whether the group has its `admin` subgroup in Keycloak
- `DELETE /api/groups/members/{guid}/?group_path=` - Remove a member from the group and its `admin` subgroup. Errors carry a `code`: `self` (409), `admin_member` (403, only a platform admin removes an administrator), `last_admin` (409). The change reaches the member's token at its next refresh (access tokens last 60 minutes)
- `PUT|DELETE /api/groups/members/{guid}/admin/?group_path=` - Name or dismiss a group administrator (platform admins only, 403 otherwise). Errors carry a `code`: `already_admin`, `not_admin`, `no_admin_group`, `last_admin` (409). A dismissed administrator listed only in `admin` stays a member
- `GET /api/me/group-invitations/` - Pending invitations of the caller
- `POST /api/me/group-invitations/{id}/accept/`, `POST /api/me/group-invitations/{id}/decline/` - Answer one; the new membership shows in the next token

### Documentation

- `GET /api/docs/` - Interactive Swagger UI documentation (development only)
- `GET /api/schema/` - OpenAPI schema (development only)

## Data Models

### Hornet
- Location (latitude, longitude, PostGIS point)
- Direction of flight
- Duration of observation
- Color markings (up to 2 colors)
- Creation timestamp and author
- Optional link to related nest

### Nest
- Location (latitude, longitude, PostGIS point)
- Public/private place indicator
- Address information
- Destruction status and date (kept once destroyed; only an admin reactivates)
- Creation timestamp and author
- Comments
- Photos (`NestPhoto`, files under `nests/<nest id>/`, served by the media view to who sees every nest and to the reporter)

### Apiary
- Location (latitude, longitude, PostGIS point)
- Infestation level (Light, Medium, High)
- AFSCA number, stored `X.XXX.XXX.XXX` (10 digits, `hornet/afsca.py`): accepted with or without separators, refused otherwise (a value recorded before the format is kept while unchanged)
- Creation timestamp and author
- Comments

## Environment Variables

The application requires several environment variables to be configured. These are typically set in the Docker Compose configuration:

- `DJANGO_SECRET_KEY` - Django secret key for cryptographic signing
- `DEBUG` - Enable/disable debug mode (default: False)
- `DATABASE_*` - PostgreSQL database connection settings
- `KEYCLOAK_*` - Keycloak authentication server configuration
- `TAG_HMAC_KEYS`, `TAG_HMAC_ACTIVE_INDEX`, `TAG_SITE_ID` - Signing keys of the QR tags, the key new tags are signed with, and the site identifier (see `.env.example` for rotation)
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_SSL` / `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` - Outgoing email. Dev: Mailpit, no TLS nor authentication. Prod: OVH MX Plan, `ssl0.ovh.net:465` with implicit TLS and a full mailbox address as user (only the user and password come from `.env`); without `EMAIL_HOST` nothing is sent and the statistics email link is not offered

Refer to the main project's [docker-compose.yml](../docker-compose.yml) file for the complete list of required environment variables.

## Development

Use the Docker Compose configuration in the project root for deployment (the backend must be linked with another services like Keycloak and PostgreSQL).

## Authentication

The API uses JWT Bearer token authentication integrated with Keycloak. To access protected endpoints:

1. Obtain a JWT token from the Keycloak authentication server
2. Include the token in the Authorization header: `Authorization: Bearer <token>`
3. For API documentation access, use the "Authorize" button in Swagger UI

## License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
