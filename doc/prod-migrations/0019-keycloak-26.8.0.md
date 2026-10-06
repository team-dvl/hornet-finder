status: applied (2026-10-06)

# Keycloak 26.7.4 → 26.8.0 (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
`auth/Dockerfile` : image de base `quay.io/keycloak/keycloak` 26.7.4 → 26.8.0 (builder et image finale). Mise à jour **mineure** (pas un patch) : trois correctifs de sécurité, SCIM, rotation des secrets client et multi-cluster v2 passent en « supported », brute force persisté en base par défaut. Notes de version : https://www.keycloak.org/2026/10/keycloak-2680-released ; guide de migration : https://www.keycloak.org/docs/26.8.0/upgrading/

Ce qui **ne change pas** : backend, frontend, nginx, `.env`, volumes, thèmes, realm (`auth/realm-export*.json`, le champ `keycloakVersion` sera rafraîchi au prochain `./export-realm.sh`).

Points relevés dans les notes de version, à confirmer contre le guide de migration pendant la mise à jour (non vérifiés à la rédaction de cette note) :
- **Admin API** : `GET /clients` et `GET /clients/{id}` ne renvoient plus le secret client avec le seul rôle `view-clients` (il faut `manage-clients`). `flow-admin` a les deux rôles : aucun effet attendu sur `export-realm.sh` et `enforce-admin-2fa.sh`, mais l'export doit toujours masquer les secrets.
- **Brute force** : l'état des verrouillages est désormais persisté en base (migration de schéma au premier démarrage, d'où le snapshot).
- Changements annoncés sur les mappers d'IdP, les claims de groupes dans les politiques d'autorisation et la déconnexion via courtier : le realm a deux IdP (`google`, `facebook`) et cinq mappers chacun, à tester (connexion Google, déconnexion). Les Authorization Services ne sont pas activés.
- Fonctionnalités activées par défaut (`scim-api`) : surface supplémentaire sans usage ici. `KC_FEATURES` reste `token-exchange,recovery-codes` ; vérifier au démarrage qu'aucune de ces deux n'est signalée comme dépréciée ou retirée.

**Impact utilisateurs** : Keycloak redémarre (quelques secondes, connexion impossible). La migration de schéma peut allonger le premier démarrage.

## Prérequis
- Worktree prod propre, stack en marche, note 0009 (26.7.4) déjà appliquée ou appliquée dans la même fenêtre.
- Accès à quay.io depuis le serveur (pull de l'image de base).

## Étapes
1. Snapshot de la base Keycloak : `./zfs-snapshot.sh create --tag pre-keycloak-26.8.0 -f`
2. `git merge --ff-only devel`
3. `./deploy.sh -s auth` (reconstruit l'image, Keycloak redémarre)

## Vérification
- `./status.sh` : services et endpoints OK.
- `docker compose logs auth | grep -iE "Keycloak 26.8.0|error|warn"` : version au démarrage, migration sans erreur, aucune fonctionnalité signalée comme retirée.
- `https://velutina.ovh` : connexion Google, connexion avec mot de passe + OTP (admin), déconnexion, rafraîchissement de session.
- `https://auth.velutina.ovh/realms/hornet-finder/.well-known/openid-configuration` répond 200.
- `./export-realm.sh -n` : le diff ne montre aucun secret en clair.

## Rollback
Remettre 26.7.4 dans `auth/Dockerfile` (`git revert`), puis `./deploy.sh -s auth`. Si le démarrage de 26.8.0 a migré le schéma et que 26.7.4 refuse de démarrer, restaurer le snapshot `pre-keycloak-26.8.0` (`./zfs-snapshot.sh restore`).
