status: pending

# Rappels des pièges, réglages des notifications (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`), après l'avoir fait et vérifié en dev. Suppose la note 0024 (notifications push, clés VAPID) appliquée.**

## Périmètre
- Migration `0027_trap_reminders` : délais de rappel par type de piège, préférences de notification par compte, sorte et lien des notifications, nouvelle table `hornet_trapreminder`. Les essais déjà envoyés deviennent de la sorte `test`.
- **Nouveau service** `hornet-finder-scheduler` (même image que l'API, `manage.py run_scheduler`) : il envoie les rappels à 9 h (10 h le dimanche). Il lit le même environnement que l'API (base, clés VAPID) : rien à ajouter dans `.env`.
- Frontend : onglet « À relever » du module Pièges, module « Notifications », première demande d'autorisation, actions « Remiser » / « Remettre en service » : reconstruire le frontend (`-b`).

Ce qui **ne change pas** : Keycloak, nginx, volumes, `.env`.

**Impact utilisateurs** : aucun rappel tant qu'aucun type de piège n'a de délai. Les utilisateurs voient la nouvelle tuile « Notifications » et, à partir de leur 2e visite, une fois, la question « Recevoir les rappels ? ».

## Prérequis
- `main` propre, stack en service (`./status.sh`), note 0024 appliquée (clés VAPID de prod dans `.env`).
- Les délais voulus par type de piège (relevé, attractif), fournis par l'utilisateur.

## Étapes
1. `git merge --ff-only devel`
2. `./deploy.sh -b` (reconstruit l'API, le scheduler et le frontend ; l'API applique `0027_trap_reminders`).
3. Vérifier que le scheduler tourne : `./logs.sh scheduler` affiche « Scheduler started ».
4. Dans l'application, en administrateur : *Administration → Types de pièges*, renseigner les délais de chaque type (vide : pas de rappel).

## Vérification
- `./status.sh` liste `hornet-finder-scheduler` en service.
- `docker compose exec hornet-finder-api python manage.py send_trap_reminders --dry-run` : liste ce qui partirait maintenant (ou « Skipped » hors des heures d'envoi ; `--now <aujourd'hui>T09:05` pour simuler 9 h).
- Onglet *Pièges → À relever* sur un compte propriétaire de pièges.

## Rollback
1. `git checkout <sha précédent>` puis `./deploy.sh -b`, puis `docker compose rm -sf hornet-finder-scheduler` (le service n'existe plus dans l'ancien compose).
2. Les colonnes et la table peuvent rester (ignorées par l'ancien code) ; pour les retirer : `docker compose exec hornet-finder-api python manage.py migrate hornet 0026` avant le checkout.
