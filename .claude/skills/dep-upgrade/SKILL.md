---
name: dep-upgrade
description: Triage Dependabot branches/PRs, fix npm/pip security alerts, or upgrade a pinned image (Keycloak, Python, Node, PostGIS). Use when asked to review Dependabot branches, handle "Dependabots high", apply npm audit or a Python/Django/DRF/PyJWT bump, or upgrade Keycloak to a new patch or minor version.
---

# Dependency and image upgrades

Work on a new branch from `origin/devel` (`chore/<what>` or `fix/<what>`), never on `devel` (see "Development from claude.ai web" in `CLAUDE.md`). There is no CI workflow in the repo: the checks below are the only gate, so run them.

## 1. Triage Dependabot branches

Dependabot opens its branches from `main`, not `devel`, and `.github/dependabot.yml` covers npm, pip, five Docker directories and GitHub Actions. Do not merge those branches as they are.

```bash
git fetch origin
for b in $(git branch -r --list 'origin/dependabot/*' --format='%(refname:short)'); do
  echo "== $b"
  git rev-list --left-right --count origin/devel...$b          # behind / ahead
  git merge-base origin/devel $b >/dev/null 2>&1 || echo "no merge base"
  git diff --stat origin/devel...$b -- . ':!auth/realm-export*.json' | tail -3
done
```

Known traps:
- Some branches carry a "refresh the dev Keycloak realm export" commit (about 1 300 changed lines, 776 + 572 in the diffstat seen in `auth/realm-export*.json`) that does not belong to the bump: take only the dependency lines.
- A branch can have **no merge base** with `devel` or be 100+ commits behind: re-apply the change by hand on a fresh branch instead of rebasing.
- Several npm branches overlap (react, react-dom and their `@types` ship together); group them in one branch.
- Majors (TypeScript 5 → 7, Node 24 → 26, Python 3.13 → 3.14) need their own build and test run; report them separately instead of folding them into a routine bump.

Report per branch: what it bumps (from → to), patch/minor/major, state (behind/ahead, merge base), and a recommendation. Do not close Dependabot PRs or delete branches without being asked.

## 2. Frontend (npm)

```bash
cd frontend
npm audit                      # before, keep the numbers (e.g. "3 high")
npm audit fix                  # transitive fixes only; no --force without asking
npm ci && npm run build        # tsc -b && vite build
npm run lint
```

`npm run lint` can already fail on the base branch: compare with `origin/devel` (run it there first) and report only new errors. Re-run `npm audit` after and give the before/after counts.

## 3. Backend (pip)

Pins live in **both** `backend/pyproject.toml` and `backend/requirements.txt`: change both, with the same version. Then, if dependencies are installed (or in the backend image): `cd backend && python manage.py check && python manage.py test`. If the environment cannot install them, say the tests were not run.

## 4. Pinned images (Keycloak, Python, Node...)

- Keycloak: `auth/Dockerfile` has **two** `FROM` lines (builder and final), keep them identical and pinned to an exact version. Look up the release notes and CVE list (web search) and quote the source and the date. Check whether a change affects the realm (Authorization Services, URI normalisation, theme templates).
- **From the cloud session, `quay.io` and `www.keycloak.org` are blocked by the egress proxy (HTTP 403, measured), so the image cannot be pulled or built there.** Say it plainly: the upgrade is prepared, not tested. Never claim it was started.
- A patch can migrate the Keycloak DB schema on first start: write the prod note with a ZFS snapshot step and a rollback (use the `prod-migration-note` skill, including the numbering check).
- Update version mentions in `README.md` and `auth/README.md` if they name the minor.

## 5. Finish

- `CHANGELOG.md`, under `[Unreleased]`: one `### Security` and one `### Changed` section, **merge into the existing ones** instead of adding a second heading of the same name. Name packages and versions; for audit fixes, the severity counts.
- Commit prefix `chore(deps):` or `fix:`; one logical bump per commit.
- UI-visible dependency changes (React, Vite, Bootstrap, Leaflet): check with `./ui-shots.sh` (default `ip14` + `pixel7`; about 17 min for the full run, so use `-s`/`-x` to narrow). It needs the `KC_TEST_*` variables in the cloud environment; if they are missing the script lists them and stops: report that instead of retrying.
- Push the branch only. Merge into `devel` only on the developer's explicit instruction (then rebase onto `origin/devel` first).
