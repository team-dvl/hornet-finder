status: applied (2026-10-01)

# Pièges à accumulation (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
Migration `0021_trap_accumulation` :
- `TrapType.accumulates` (faux par défaut) : le type de piège garde ses prises d'un relevé à l'autre.
- `TrapEvent.observed_quantity` (ce que contenait le piège) et `TrapEvent.emptied` (vidé après le relevé). `quantity` reste le nombre de nouvelles prises, désormais déduit de `observed_quantity`.
- `Trap.contents` : ce que le dernier relevé a laissé dans le piège.

Reprise des données : chaque relevé existant reçoit `observed_quantity = quantity` et `emptied = true`, ce qui était sa règle (compter ce que l'on retire). Les nouvelles prises, `hornet_catch_count` et les statistiques ne changent pas.

Aucun type n'est marqué « à accumulation » par la migration : tant qu'un administrateur ne coche pas la case, le relevé reste celui d'aujourd'hui. Ce qui **ne change pas** : Keycloak, `.env`, volumes, nginx.

## Prérequis
`main` propre, stack en service (`./status.sh`).

## Étapes
1. `./zfs-snapshot.sh create --tag pre-trap-accumulation -f` (la migration réécrit les relevés).
2. `git merge --ff-only devel`
3. `./deploy.sh -b` (reconstruit le frontend ; l'API est recréée et applique `0021`).
4. Dans l'application, Administration → Types de piège : cocher **Accumule les captures** sur les types concernés (harpe électrique, nasse, piège létal, Jabeprode... selon l'usage réel). Décision de l'utilisateur, type par type.

## Vérification
- `./status.sh` ; `./deploy.sh` affiche la migration `0021_trap_accumulation` appliquée.
- Aucun relevé sans valeur observée (attendu : `0`) :
  ```
  docker compose exec hornet-finder-api python manage.py shell -c "from hornet.models import TrapEvent; print(TrapEvent.objects.filter(kind='catch', observed_quantity__isnull=True).count())"
  ```
- Sur un piège d'un type coché : le relevé affiche « Contenu du piège » et demande « Vidé / Laissé en place » ; un second relevé repart du contenu laissé.

## Rollback
`git reset --hard <sha de main avant la fusion>` sur `main`, puis `./deploy.sh -b`. Les colonnes ajoutées sont ignorées par l'ancien code, mais les relevés « laissés en place » enregistrés entre-temps garderaient des nouvelles prises que l'ancien code ne recalcule plus : restaurer le snapshot `pre-trap-accumulation` si de tels relevés existent.
