status: pending

# Keycloak 26.8.0 → 26.8.1 (`main` 64af2a6 → `devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
`auth/Dockerfile` : image de base `quay.io/keycloak/keycloak` 26.8.0 → 26.8.1 (builder et image finale). Mise à jour de **patch**, publiée le 2026-10-13, qui regroupe des correctifs de sécurité (notes de version : https://www.keycloak.org/2026/10/keycloak-2681-released). Relevé dans ces notes (via une recherche web, la page elle-même n'a pas pu être ouverte depuis la session) : CVE-2026-15943, CVE-2026-18569, CVE-2026-82968, CVE-2026-94001 et d'autres, dont un contournement de l'obligation 2FA, un contournement du usage unique de PAR, des problèmes d'autorisation et d'usurpation Kerberos. La liste complète et les sévérités sont **à relire dans les notes de version** avant de déployer ; le nombre exact de CVE n'est pas confirmé.

Ce qui **ne change pas** : backend, frontend, nginx, `.env`, volumes, thèmes, realm (`auth/realm-export*.json`). Les Authorization Services, Kerberos et PAR ne sont pas utilisés ici.

**Non testé** : l'image n'a pas pu être tirée ni construite depuis la session cloud (`quay.io` bloqué). Le build et le démarrage sont à valider en dev (`./deploy.sh -s auth` sur le worktree `devel`) avant la prod.

**Impact utilisateurs** : Keycloak redémarre (quelques secondes, connexion impossible). Une migration de schéma au premier démarrage est possible mais non attendue pour un patch : durée inconnue.

## Prérequis
- Note 0019 (26.8.0) déjà appliquée.
- Accès à quay.io depuis le serveur.
- Validation en dev faite.

## Étapes
1. Snapshot de la base Keycloak : `./zfs-snapshot.sh create --tag pre-keycloak-26.8.1 -f`
2. `git merge --ff-only devel`
3. `./deploy.sh -s auth`

## Vérification
- `./status.sh` : services et endpoints OK.
- `docker compose logs auth | grep -iE "Keycloak 26.8.1|error|warn"` : version au démarrage, pas d'erreur de migration.
- `https://velutina.ovh` : connexion Google, connexion mot de passe + OTP (admin), déconnexion, rafraîchissement de session.
- `https://auth.velutina.ovh/realms/hornet-finder/.well-known/openid-configuration` répond 200.

## Rollback
Remettre 26.8.0 dans `auth/Dockerfile` (`git revert`), puis `./deploy.sh -s auth`. Si le démarrage de 26.8.1 a migré le schéma et que 26.8.0 refuse de démarrer, restaurer le snapshot `pre-keycloak-26.8.1` (`./zfs-snapshot.sh restore`).
