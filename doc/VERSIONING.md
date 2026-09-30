# Versioning

The version is the git tag `vMAJOR.MINOR.PATCH` ([semver](https://semver.org/)).
No file stores it by hand.

| Bump | When |
|---|---|
| `major` | breaking change of the API or a manual, non-backward-compatible step in prod |
| `minor` | new feature, backward compatible |
| `patch` | bug fix only |

## Cutting a release

1. While working, add entries under `## [Unreleased]` in `CHANGELOG.md`
   (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`), in the same
   commit as the change.
2. From the dev worktree, on `devel`, with a clean tree:
   ```bash
   ./release.sh minor --dry-run   # shows the notes and the new version
   ./release.sh minor --push      # commit "chore: release vX.Y.Z", annotated tag, push
   ```
3. Prod merges `devel` as usual (`git merge --ff-only devel`) then `./deploy.sh -b`:
   the tag comes with the shared repository, so prod builds exactly `X.Y.Z`.

## Where the version shows up

`lib/version.sh` computes it with `git describe --tags --match 'v[0-9]*' --dirty`
(exported as `APP_VERSION` by `load_env`), and the compose files pass it to the
frontend as `VITE_APP_VERSION`. It is displayed at the end of the menu
(`utils/version.ts`, `NavbarComponent`).

| Shown | Meaning |
|---|---|
| `v1.4.0` | build made exactly on the tag |
| `v1.4.0-7-g3d79b93` | 7 commits after `v1.4.0` (dev, or prod not yet on a release) |
| `…-dirty` | uncommitted changes in the worktree |
| `v0.0.0-<sha>` | no tag reachable |
| `vdev` | build not started through the scripts (plain `docker compose`) |

The dev frontend reads the version when its container is (re)created, so run
`./deploy.sh -s frontend` after committing or tagging to refresh it. The prod one is fixed at build time (`./deploy.sh -b`).
