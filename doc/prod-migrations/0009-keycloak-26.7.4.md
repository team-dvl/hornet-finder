status: applied (2026-09-30)

# Keycloak 26.7.3 → 26.7.4 (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
`auth/Dockerfile` : image de base `quay.io/keycloak/keycloak` 26.7.3 → 26.7.4 (builder et image finale). Mise à jour de patch, qui corrige six CVE (dont cinq notées « high » et deux dénis de service non authentifiés). Voir les notes de version : https://www.keycloak.org/2026/09/keycloak-2674-released

Ce qui **ne change pas** : backend, frontend, nginx, `.env`, volumes, thèmes, realm (`auth/realm-export*.json`).

Les Authorization Services ne sont pas activés sur les clients du realm : la normalisation d'URI modifiée dans cette version (seul changement pouvant altérer des décisions d'accès) ne nous concerne pas.

**Impact utilisateurs** : Keycloak redémarre (quelques secondes pendant lesquelles la connexion est impossible). Un patch peut migrer le schéma de la base Keycloak au premier démarrage, d'où le snapshot.

## Prérequis
- Worktree prod propre, stack en marche.
- Accès à quay.io depuis le serveur (pull de l'image de base).

## Étapes
1. Snapshot de la base Keycloak : `./zfs-snapshot.sh create --tag pre-keycloak-26.7.4 -f`
2. `git merge --ff-only devel`
3. `./deploy.sh -s auth` (reconstruit l'image, Keycloak redémarre)

## Vérification
- `./status.sh` : services et endpoints OK.
- `docker compose logs auth | grep -i "Keycloak 26.7.4"` : version au démarrage, sans erreur de migration.
- `https://velutina.ovh` : connexion, déconnexion, rafraîchissement de session.
- `https://auth.velutina.ovh/realms/hornet-finder/.well-known/openid-configuration` répond 200.

## Rollback
Remettre 26.7.3 dans `auth/Dockerfile` (`git revert`), puis `./deploy.sh -s auth`. Si le démarrage de 26.7.4 a migré le schéma et que 26.7.3 refuse de démarrer, restaurer le snapshot `pre-keycloak-26.7.4` (`./zfs-snapshot.sh restore`).
