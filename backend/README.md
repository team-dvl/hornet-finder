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
- `GET|POST /api/nests/` - List all nests or create a new nest record
- `GET|PUT|PATCH|DELETE /api/nests/{id}/` - Retrieve, update, or delete a specific nest
- `GET|POST /api/apiaries/` - List all apiaries or create a new apiary record
- `GET|PUT|PATCH|DELETE /api/apiaries/{id}/` - Retrieve, update, or delete a specific apiary

### Traps

- `GET|POST /api/traps/` - Traps around a position (`lat`, `lon`, `radius`, `active`, `mine`), or create one. The listing is open to anonymous visitors, who get the public shape (no owner, no group, no journal) and only public traps
- `GET|PATCH|DELETE /api/traps/{id}/` - Detail with its journal, update (owner or platform admin), delete
- `GET /api/traps/my/` - Traps of the caller
- `GET /api/traps/managed/` - Trap manager, paginated (`page`, `page_size` up to 200, default 50). `scope`: `mine` (default), `delegated` (traps delegated to one of the caller's groups, parents of their subgroups included, their own excluded) or `all` (platform admins only). Filters: `active` (`true` by default, `false`, `all`), `group` (path), `trap_type` (slug), `has_tag`, `q` (number, address, comments, QR code). `ordering`: `last_event_at` (default, never visited traps first), `hornet_catch_count`, `installed_at`, `address`, `id`, `distance` (needs `lat`/`lon`, no radius limit since the scope already bounds the result), `-` prefix for descending order
- `POST|DELETE /api/traps/{id}/photo/` - Replace or remove the trap photo (multipart)
- `GET|POST /api/traps/{id}/events/` - Journal of the trap, or record an intervention (multipart, `photos` repeated). Reserved to the owner and the delegated group: platform admins do not record field work
- `GET|PUT|DELETE /api/traps/{id}/delegation/` - Current delegation and the groups the caller may pick, set a group, or withdraw the delegation
- `PUT /api/traps/{id}/owner/` - Reassign a bequeathed trap (platform admin only)
- `PATCH|DELETE /api/trap-events/{id}/` - Correct or remove a journal entry
- `DELETE /api/trap-photos/{id}/` - Remove one photo
- `GET|POST /api/trap-types/`, `GET|PATCH|DELETE /api/trap-types/{id}/` - Trap type referential; readable by any authenticated user, writable by platform admins. Deleting a type still in use answers 409 with its trap count
- `GET|POST /api/species/`, `GET|PATCH|DELETE /api/species/{id}/` - Species referential, same rules
- `GET /api/media/{path}` - Uploaded photo, served only to users allowed to see the owning trap (nginx does the transfer through X-Accel-Redirect)

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
- Destruction status and timestamp
- Creation timestamp and author
- Comments

### Apiary
- Location (latitude, longitude, PostGIS point)
- Infestation level (Light, Medium, High)
- Creation timestamp and author
- Comments

## Environment Variables

The application requires several environment variables to be configured. These are typically set in the Docker Compose configuration:

- `DJANGO_SECRET_KEY` - Django secret key for cryptographic signing
- `DEBUG` - Enable/disable debug mode (default: False)
- `DATABASE_*` - PostgreSQL database connection settings
- `KEYCLOAK_*` - Keycloak authentication server configuration
- `TAG_HMAC_KEYS`, `TAG_HMAC_ACTIVE_INDEX`, `TAG_SITE_ID` - Signing keys of the QR tags, the key new tags are signed with, and the site identifier (see `.env.example` for rotation)

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
