---
name: audited-endpoint
description: Checklist for any backend change that writes data (new or changed endpoint, viewset action, model field, Keycloak action) so that the audit trail stays complete. Use when adding or modifying a POST/PUT/PATCH/DELETE endpoint, a business field of an audited model, or an action done in Keycloak, and when audit.tests.CoverageTests fails.
---

# Audited endpoint checklist

Every business action is recorded by the `audit` app (`backend/audit/`, `doc/AUDIT_TRAIL.md`). The trail is append-only, kept `AUDIT_RETENTION_DAYS` (365) and read by platform admins only. Work through the points below in order; each one is a separate file, which is why they get forgotten.

## 1. Record the action in the backend

- Inside the transaction of the change, never through signals (`queryset.update()`, `bulk_create` and Keycloak calls bypass them):
  - creation, deletion, batch: `audit.record(request, '<domain>.<verb>', obj, changes=..., refs=[...])`. A deletion passes `(kind, pk)` and `changes=audit.snapshot(instance)`: the snapshot is the only trace left.
  - update: `with audit.track(request, '<domain>.updated', obj):` around the save.
  - an action done in Keycloak: record right after its success.
- Examples to copy: `hornet/trap_views.py` (`audit.record(... 'trap.created' ...)` with `audit.snapshot`, `audit.track(... 'trap.updated' ...)`, `'species.reordered'` with `changes={'order': ids}`).
- `refs` lists every object the action concerns (`trap:42`, `group:/beekeepers/x`, `user:<guid>`): the history of an object searches them.
- Never put an email, an IP address, a token or a name in an event: people are GUIDs, resolved from Keycloak when the trail is read.

## 2. Declare the code and the fields

- `backend/audit/actions.py`, dict `ACTIONS`: `'<domain>.<verb>': "English description"`. `record` raises `ValueError` for an unlisted code.
- A new business field of an audited model: `FIELDS` in `backend/audit/recorder.py`.
- A field holding a person's GUID: `PERSON_FIELDS` in **both** `backend/audit/views.py` and `frontend/src/utils/auditLabels.ts`.

## 3. French labels in the frontend

`frontend/src/utils/auditLabels.ts`: the action in `ACTION_LABELS`, the field in `FIELD_LABELS` (and `TYPE_FIELD_LABELS` when it depends on the object type). An unlabelled code is shown raw (`actionLabel` falls back on the code).

## 4. Declare the endpoint in the coverage test

`backend/audit/tests.py`:
- viewset action: key `(router basename, view method, http method)` in `AUDITED` with the action code(s) (use `'a / b'` for several), or in `NOT_AUDITED` with the reason (a personal setting, a device receipt, a read signed as POST);
- plain view outside the routers: `PLAIN_VIEWS`, keyed by URL name, with the code or `"read"`.

`CoverageTests` fails both ways: an undeclared writing endpoint, and a declared one that no longer exists.

## 5. Test the event

Add a test next to the existing ones in `audit/tests.py` (or the module's tests): call the endpoint, then assert the `AuditEvent` (action, target, `refs`, `changes`). For a deletion, assert the snapshot.

## 6. Frontend surface and help

- A new object sheet offers the admin history through `useHistoryAction` (`frontend/src/hooks/useHistoryAction.ts`) in its `SheetActions`.
- If the scope of what is recorded changes, keep `help/AdminDoc.tsx`, section `audit`, true: it tells every user what the trail records.

## 7. Run it

`cd backend && python manage.py test audit hornet`. **The cloud container has no Django installed** (checked: `import django` fails), so the tests run in the dev stack (`docker compose exec api python manage.py test audit`) or after `pip install -r backend/requirements.txt`. If you could not run them, say so: do not report the coverage test as passing.

Also add the user-visible part to `CHANGELOG.md` under `[Unreleased]`; a data-model change may need a `doc/prod-migrations` note (see the `prod-migration-note` skill).
