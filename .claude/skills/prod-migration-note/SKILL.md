---
name: prod-migration-note
description: Write or check a prod migration note (doc/prod-migrations/NNNN-slug.md) for a change that needs more than ./deploy.sh in prod (Keycloak realm setting, .env value, volume, image upgrade with schema migration, nginx, data fix). Use whenever a change is prepared in dev that prod cannot get with a plain merge of devel and ./deploy.sh, or when asked whether a note is needed.
---

# Prod migration note

The note is the only channel between the dev and prod worktrees (see `doc/prod-migrations/README.md`, which holds the template and the workflow). Never edit or read the other worktree.

## 1. Decide whether a note is needed

Needed when prod must do **more than** `git merge --ff-only devel` + `./deploy.sh` (+ `-b`, `-s <service>`):
- a Keycloak realm setting (the realm import never modifies an existing realm: a changed `auth/realm-export*.json` setting must be applied by hand or with `flow-admin`);
- a new or changed `.env` variable, a volume, a ZFS dataset, an nginx or certificate change;
- an image upgrade that may migrate a database schema (Keycloak, PostGIS, Postgres): snapshot first;
- a data fix or a one-off management command.

Not needed: code-only changes, a Python or npm dependency bump, a theme baked into the Keycloak image. When in doubt, write it: a useless note costs a minute, a missing one costs a prod incident.

## 2. Number it from the freshest state

Two notes were once created as `0007-*` in parallel. Before choosing the number:

```bash
git fetch origin
git ls-tree --name-only origin/devel doc/prod-migrations/ | sort | tail -3
git branch -r --list 'origin/*' | head -30   # other open branches may hold a note too
for b in $(git branch -r --format='%(refname:short)' | grep -v HEAD); do
  git ls-tree --name-only "$b" doc/prod-migrations/ 2>/dev/null; done | sort -u | tail -3
```

Take the highest `NNNN` seen anywhere, plus one. After a rebase onto `origin/devel`, list the folder again: two files with the same number must be renumbered (`git mv`) before pushing.

## 3. Write it

- File `doc/prod-migrations/NNNN-slug.md`, first line `status: pending`, then the template of the README. Written in French like the existing notes; commands and identifiers unchanged.
- Title carries the branch context: `(\`main\` <sha> → \`devel\`)`; use the real shas (`git rev-parse --short origin/main`).
- **Scope**: what changes and what does not (backend, DB, Keycloak, `.env`, volumes, nginx), user impact and downtime in seconds if known; say "unknown" rather than guess.
- **Steps**: snapshot (`./zfs-snapshot.sh create --tag pre-<slug> -f`) whenever data or a DB schema may change; every Keycloak/`.env` write is marked "à confirmer avec l'utilisateur"; give the Admin API call with `$T` and `$K` as in earlier notes (never a secret value).
- **Verification**: `./status.sh`, a curl with the expected HTTP code, what to look at in the UI.
- **Rollback**: previous sha, snapshot restore, reverse call. For a Keycloak upgrade, say what happens if the new version already migrated the schema.
- Also apply the dev side when the note concerns the `hornet-finder-dev` realm, and say so under Prerequisites.

## 4. Ship it

Commit the note in the same commit (or branch) as the change. Mention it in the `CHANGELOG.md` entry under `[Unreleased]` when users or admins notice the change. Prod later sets `status: applied (YYYY-MM-DD)`; never delete a note.
