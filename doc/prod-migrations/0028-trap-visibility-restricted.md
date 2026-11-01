status: pending

# Visibilité des pièges : public ou restreint, transfert de propriétaire (`main` 64af2a6 → `devel` 06c1549)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`), après l'avoir fait et vérifié en dev.**

## Périmètre
- Migration de **données** `0034_trap_visibility_restricted` (appliquée par l'API au démarrage, comme les autres) :
  - la visibilité `group` des pièges devient `restricted` ;
  - **tous** les pièges existants d'un type « lié à un rucher » passent en `restricted`, quel que soit leur propriétaire : ils étaient enregistrés `public` mais jamais montrés, ils le restent. Leurs propriétaires qui n'ont pas de ruches pourront les rendre publics.
- Code : visibilité `public` / `restricted` indépendante de la délégation ; transfert d'un piège à un autre propriétaire (administrateur de la plateforme ou d'un groupe) avec nettoyage de la délégation ; nouvelle sorte de notification `trap_handover` ; nouvel événement d'audit système `trap.restricted`. Reconstruire le frontend (`-b`).
- La migration `0033_platformsettings` (réglages de la plateforme, déjà dans `devel`) est appliquée dans le même démarrage.

Ce qui **ne change pas** : Keycloak, nginx, volumes, `.env`.

**Impact utilisateurs** : rien ne devient visible qui ne l'était pas. Les pièges « groupe seulement » restent restreints et ceux des types liés à un rucher restent cachés. Les propriétaires voient un interrupteur « Piège public » dans la fiche de leur piège. Durée de la migration : une mise à jour de quelques lignes (inconnue, de l'ordre de la seconde).

## Prérequis
- `main` propre, stack en service (`./status.sh`).
- Aucune note en attente à appliquer avant celle-ci (0027 incluse si elle est encore `pending`).

## Étapes
1. Snapshot : `./zfs-snapshot.sh create --tag pre-trap-visibility -f` (des données sont modifiées).
2. `git merge --ff-only devel`
3. `./deploy.sh -b` (reconstruit l'API, le scheduler et le frontend ; l'API applique `0033` et `0034`).

## Vérification
- `./status.sh`.
- Plus aucune visibilité `group`, et aucun piège de type lié à un rucher qui ne soit restreint :
  `docker compose exec hornet-finder-api python manage.py shell -c "from hornet.models import Trap; from django.db.models import Count; print(list(Trap.objects.values('visibility').annotate(n=Count('id'))), Trap.objects.filter(trap_type__apiary_bound=True).exclude(visibility='restricted').count())"`
  doit afficher seulement `public` / `restricted`, et `0` pour le second nombre.
- Dans l'application, sur un piège dont on est propriétaire : *Délégation* affiche l'interrupteur « Piège public » (un cadenas « Privé » pour un apiculteur avec un piège lié à un rucher). En administrateur, *Plateforme → Notifications* liste « Pièges transférés ».

## Rollback
1. Le plus sûr : restaurer le snapshot `pre-trap-visibility` (`./zfs-snapshot.sh restore`), puis `git checkout <sha précédent>` et `./deploy.sh -b`.
2. Sans restaurer : avant le checkout, `docker compose exec hornet-finder-api python manage.py migrate hornet 0033` remet `group` à la place de `restricted` pour tous les pièges restreints (la visibilité effective est inchangée : aucun n'est public).
