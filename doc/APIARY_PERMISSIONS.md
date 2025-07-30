# Apiary Endpoints Permissions

This document describes the permissions logic for all `/apiaries/` endpoints in the Hornet Finder backend.

## Roles
- **admin**: Platform administrator
- **beekeeper**: Registered beekeeper
- **other**: Any other authenticated user (e.g. volunteer)

## Group Permissions
- Group access is managed via the `ApiaryGroupPermission` model.
- A user can access an apiary via group membership if their JWT `membership` scope matches a group path in the database.
- Permissions are fine-grained: `can_read`, `can_update`, `can_delete`.

## Endpoints & Permissions Table

| Endpoint                | admin         | beekeeper (owner) | beekeeper (group) | other (group) |
|------------------------|---------------|-------------------|-------------------|---------------|
| GET /apiaries/         | all           | own + group(read) | own + group(read) | group(read)   |
| POST /apiaries/        | allowed       | allowed           | -                 | -             |
| GET /apiaries/{id}/    | all           | own + group(read) | own + group(read) | group(read)   |
| PATCH /apiaries/{id}/  | all           | own + group(update)| own + group(update)| group(update) |
| DELETE /apiaries/{id}/ | all           | own + group(delete)| own + group(delete)| group(delete) |

### Legend
- **all**: All apiaries
- **own**: Apiaries created by the user
- **group(read/update/delete)**: Apiaries accessible via group membership with the corresponding permission
- **allowed**: Action is permitted
- **-**: Action is not permitted

## Details
- **Admin** users have full access to all apiaries and all actions.
- **Beekeeper** users can always manage their own apiaries, and may have additional access via group permissions.
- **Other** users (e.g. volunteers) can only access apiaries if a group they belong to has explicit permissions.
- All access is enforced both at the list and detail endpoints.
- Geographical filtering is available on GET endpoints via `lat`, `lon`, and `radius` query parameters.

---
For implementation details, see the backend code in `hornet/views.py` and `hornet/models.py`.
