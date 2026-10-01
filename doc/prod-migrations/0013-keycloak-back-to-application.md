status: applied (2026-10-01)

# Keycloak: "Back to application" link on the info pages (`devel`)

**Run from the prod worktree (`/home/debian/hornet-finder`).**

## Scope
Client `hornet-app` (prod) gets `baseUrl: "/"` (resolved against `rootUrl` `https://velutina.ovh`). Without it, the last page of a sign-up (verify email, then set the password) is "Compte mis à jour" with no way back to the app (dead end). With it, Keycloak shows a "Retour à l'application" link to `https://velutina.ovh/`.
Realm files only seed a fresh realm (`--import-realm` skips an existing one), so the change must be applied by hand in the running Keycloak. No code, DB or volume change; no downtime.

## Prerequisites
Keycloak admin access (`https://auth.velutina.ovh/admin/master/console`), realm `hornet-finder`.

## Steps
1. Clients > `hornet-app` > Settings > Access settings > **Home URL**: `/` (or `https://velutina.ovh/`). Save.
2. `git merge --ff-only devel` and `./deploy.sh` (nothing to rebuild; keeps the realm file in sync).

## Verification
Register a test user, confirm the email, set the password: the final page shows "Retour à l'application" leading to `https://velutina.ovh/`.

## Rollback
Empty the Home URL of `hornet-app`.
