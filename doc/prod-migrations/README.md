# Prod migration notes

One file per release that needs more than `./deploy.sh` in prod: `NNNN-short-slug.md`, numbered in order.

## Workflow

1. **Dev** writes the note in the same commit (or branch) as the change it describes. It reaches `main` with the normal `devel` → `main` merge; nothing is copied by hand between worktrees.
2. **Prod** lists the pending notes (`grep -l '^status: pending' doc/prod-migrations/*.md`), applies them in order with the user's confirmation at each step, then sets `status: applied (YYYY-MM-DD)` and commits on `main`.
3. Notes are never deleted: they are the history of what was done in prod.

## Template

```markdown
status: pending

# <Title> (`main` <sha> → `devel` <sha>)

**Run from the prod worktree (`/home/debian/hornet-finder`).**

## Scope
Commits, what changes (backend, DB, Keycloak, `.env`, volumes, nginx) and what does not. User impact, downtime.

## Prerequisites
Expected state of prod before starting (git, running stack, `.env` values, ...).

## Steps
1. Snapshot (`./zfs-snapshot.sh create --tag pre-<slug> -f`) when data is touched.
2. `.env` / Keycloak changes (confirm with the user before any write).
3. `git merge --ff-only devel`
4. `./deploy.sh` (options)

## Verification
`./status.sh`, curl probes, what to check in the UI.

## Rollback
How to go back (previous sha, snapshot restore, reverted Keycloak settings).
```
