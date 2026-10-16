status: pending

# Notifications push (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`), après l'avoir fait et vérifié en dev.**

## Périmètre
- Migration `0026_push_notifications` : trois nouvelles tables (`hornet_pushsubscription`, `hornet_pushnotification`, `hornet_pushdelivery`).
- Nouvelle dépendance Python `pywebpush` (reconstruction de l'image de l'API).
- Le service worker de la PWA passe de `generateSW` à `injectManifest` (`frontend/src/sw.ts`) : le frontend de prod doit être reconstruit (`-b`).
- `.env` : une paire de clés VAPID propre à la prod (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optionnellement `VAPID_SUBJECT`). Sans elles, l'application ne propose pas les notifications.

Ce qui **ne change pas** : Keycloak, nginx, volumes. Pas d'interruption au-delà du redémarrage de l'API.

**Impact utilisateurs** : aucun tant que personne n'active les notifications. Les administrateurs de groupe et de la plateforme voient « Notifier » dans la liste des membres. Le service worker est remplacé au premier chargement suivant (mise à jour automatique).

## Prérequis
- `main` propre, stack en service (`./status.sh`).
- Fait et vérifié en dev avec au moins un Android et un iPhone (PWA installée, iOS 16.4 ou plus).

## Étapes
1. `git merge --ff-only devel`
2. Générer les clés (une fois, **ne pas réutiliser celles de dev**) :
   ```
   docker compose run --rm --no-deps --entrypoint python hornet-finder-api manage.py generate_vapid_keys
   ```
   Les deux lignes affichées vont dans `.env` du worktree prod. La clé privée ne doit apparaître nulle part ailleurs (ni commit, ni logs, ni chat).
3. `./deploy.sh -b` (reconstruit l'image de l'API et le frontend ; l'API applique `0026_push_notifications`).

## Vérification
- En étant connecté : *Mon profil → Notifications* propose un interrupteur et un bouton d'essai.
- Activer sur un appareil, « Envoyer un essai » : la notification arrive en quelques secondes.
- *Administration → Notifications* (administrateur de la plateforme) liste l'essai avec le statut 201 et le délai.

## Rollback
1. `git checkout <sha précédent>` puis `./deploy.sh -b`. L'ancien service worker est regénéré ; les abonnements restent en base, inutilisés.
2. Les tables peuvent rester (ignorées par l'ancien code) ; pour les retirer : `docker compose exec hornet-finder-api python manage.py migrate hornet 0023` avant le checkout.
3. Changer de clés VAPID désabonne tous les appareils : ne le faire qu'en connaissance de cause.
