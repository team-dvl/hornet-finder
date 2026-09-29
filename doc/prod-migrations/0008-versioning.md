status: pending

# Version affichée dans l'application (`main` → `devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
Gestion de versions par tags git (`release.sh`, `CHANGELOG.md`, `doc/VERSIONING.md`). Frontend seul : la version s'affiche en bas du menu. Ni backend, ni base, ni `.env`, ni Keycloak, ni nginx.

## Prérequis
- Notes 0001 à 0007 appliquées.
- Au moins un tag `vX.Y.Z` posé depuis le worktree dev (sinon le menu affiche `v0.0.0-<sha>`).

## Étapes
1. `git merge --ff-only devel`
2. `./deploy.sh -b` (reconstruit le frontend avec la version)

## Vérification
Le menu affiche `vX.Y.Z` (sans suffixe si le worktree prod est exactement sur le tag).

## Rollback
Revenir au sha précédent et `./deploy.sh -b`.
