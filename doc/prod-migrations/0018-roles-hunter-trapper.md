status: pending

# Rôles `hunter` et `trapper`, délégation réservée aux associations d'apiculteurs (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`), après l'avoir fait et vérifié en dev (section « Dev d'abord »).**

## Périmètre
Le rôle `volunteer` réunissait deux métiers. Il est scindé :

| Avant | Après |
|---|---|
| rôle `volunteer`, groupe `/volunteers` (groupe par défaut) | rôle `hunter` (chasseurs de nids), groupe `/hunters`, attribué par un administrateur de la plateforme |
| — | rôle `trapper` (piégeurs), groupe `/trappers`, **nouveau groupe par défaut** ; `/trappers/admin` (rôle `group-admin`) = coordinateurs des piégeurs |
| `/volunteers/vsa` (« Vedrin s'anime ») | supprimé : ses membres deviennent des piégeurs ordinaires |
| `/admins` porte `volunteer` | `/admins` porte `hunter` (suit le renommage) |

Droits (backend et frontend) :
- observations et lâchers de frelons : `hunter`, `beekeeper`, `admin` (plus `trapper`) ;
- tous les nids : `hunter`, `beekeeper`, `admin` ; un piégeur voit les nids détruits et ceux qu'il a signalés (`GET /api/nests/my/`) ; tout rôle signale un nid ;
- pièges et QR Codes : `trapper`, `beekeeper` (plus `hunter`) ;
- statistiques : les quatre rôles ;
- délégation d'un piège : uniquement vers `/beekeepers/<id>`, administrateurs de la plateforme compris.

**Transition** : un jeton émis avant le renommage porte encore `volunteer`. Le code déployé le lit comme `hunter` + `trapper` (les deux métiers d'avant), donc personne ne perd de droit entre le déploiement et la fin des changements Keycloak, ni pendant l'heure de validité des jetons déjà émis. Cet alias (`LEGACY_ROLES` dans `backend/hornet_finder_api/roles.py` et `frontend/src/utils/roles.ts`) est à retirer dans la release suivante.

**Données** : aucun piège n'est délégué hors d'une association d'apiculteurs (constat de l'utilisateur, vérifié à l'étape 1). Pas de migration Django.

**Impact utilisateurs** : les anciens `volunteer` qui ne sont pas désignés chasseurs perdent l'ajout de frelons et la vue de tous les nids, au plus tard une heure après l'étape 5 (renouvellement du jeton). Leurs pièges ne changent pas.

Ce qui **ne change pas** : schéma de base, `.env`, volumes, nginx.

## Prérequis
- `main` propre, stack en service (`./status.sh`).
- **Liste des chasseurs de nids**, fournie par l'utilisateur : les seuls membres actuels de `/volunteers` qui resteront dans `/hunters`.
- Accès à la console Keycloak du realm `hornet-finder` avec un compte administrateur du realm. Les groupes et les appartenances relèvent de `manage-users`, que `flow-admin` n'a pas ; les rôles et le groupe par défaut relèvent de `manage-realm`, qu'il a.
- Jeton `$T` (`flow-admin`) et `$K=https://$KC_HOSTNAME/admin/realms/hornet-finder`, comme dans la note 0011.

## Dev d'abord
Mêmes étapes 3 à 6 sur le realm `hornet-finder-dev`, depuis le worktree dev (`./deploy.sh` à la place de `-b`). En plus :
- groupe dev `/volunteers/vol-group-a` à la place de `/volunteers/vsa` ;
- comptes de test de `./smoke-traps.sh` :
  - `t-owner` et `t-member` membres de `/trappers` et `/beekeepers/bkp-group-c` ;
  - `t-groupadmin` membre de `/beekeepers/bkp-group-c/admin` ;
  - `bkp-group-c/admin` porte `group-admin`.
  Le script délègue désormais à `/beekeepers/bkp-group-c`.

Vérifier avec `./smoke-traps.sh` (tout `ok`) et `./ui-shots.sh` avant de passer en prod.

## Étapes
1. **Comptages en lecture seule.**
   ```sh
   docker compose exec hornet-finder-api python manage.py shell -c "
   from hornet.models import Trap, BeekeeperGroup
   from hornet.trap_permissions import is_beekeeper_group
   print('pieges hors association:', [t.id for t in Trap.objects.filter(group__isnull=False) if not is_beekeeper_group(t.group.path)])
   print('groupes locaux hors association:', [g.path for g in BeekeeperGroup.objects.all() if not is_beekeeper_group(g.path)])"
   ```
   La première liste doit être vide. Sinon, s'arrêter et décider piège par piège avec l'utilisateur (le passer en public ou le désactiver). Ne pas lancer cette commande avant l'étape 2 : `is_beekeeper_group` n'existe pas dans le code actuel de prod.

   Effectifs (console : Groups → `/volunteers` → Members, et `/volunteers/vsa`, `/volunteers/vsa/admin`) : noter les nombres.

   Placer les étapes 1 à 6 dans une même fenêtre de maintenance.
2. `git merge --ff-only devel`, puis `./deploy.sh -b`. Refaire alors le comptage de l'étape 1.
3. **Rôles (écriture, `flow-admin`, à confirmer avec l'utilisateur).**
   ```sh
   # Renommer volunteer en hunter : même identifiant, donc les role mappings de /volunteers et /admins suivent
   curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
     -d '{"name":"hunter","description":"Nest hunter: hornet sightings and releases, every nest"}' "$K/roles/volunteer"
   # Nouveau rôle trapper
   curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
     -d '{"name":"trapper","description":"Trapper: owns traps and prints their QR Codes; default role of a new account"}' "$K/roles"
   ```
   Codes attendus : `204` puis `201`. Si le renommage était refusé, ne pas improviser : créer `hunter` et l'attribuer à `/volunteers` et à `/admins` à la place de `volunteer`, puis supprimer `volunteer` à l'étape 5.
4. **Groupes (console).**
   1. Groups → Create group `trappers`, description « Piégeurs » ; Role mapping : `trapper`.
   2. Sous `/trappers`, créer le sous-groupe `admin`, description « Coordinateurs des piégeurs » ; Role mapping : `group-admin`.
   3. Renommer `/volunteers` en `hunters`, description « Chasseurs de nids ». Son role mapping montre maintenant `hunter`.
   4. Realm settings → User registration → Default groups : retirer `/hunters`, ajouter `/trappers`.
5. **Appartenances (console, à confirmer avec l'utilisateur).**
   1. Ajouter à `/trappers` chaque membre de `/hunters` (l'ancien `/volunteers`) et de `/volunteers/vsa` (et de son `admin`), service accounts exceptés. Users → l'utilisateur → Groups → Join group. Le compte doit égaler la somme notée à l'étape 1, sans doublon.
   2. Retirer de `/hunters` tous ceux qui ne sont pas sur la liste des chasseurs, et les service accounts (`service-account-*`, entrés là via l'ancien groupe par défaut).
   3. Supprimer `/hunters/vsa` (anciennement `/volunteers/vsa`) et son sous-groupe `admin`.
   4. Nommer les coordinateurs des piégeurs, s'il y en a, depuis l'application : Administration → Groupes → « Piégeurs » → membre → Nommer administrateur.

   Au-delà d'une vingtaine de comptes, faire ces appartenances par l'API. Ajouter alors **temporairement** `manage-users` à `flow-admin`, avec l'accord de l'utilisateur, et le retirer aussitôt après (voir CLAUDE.md).
6. **Base locale.** Supprimer les lignes `BeekeeperGroup` hors association listées à l'étape 1. Elles ne sont référencées par aucun piège ; la suppression les retire aussi des partages de rucher, qui n'en contiennent pas en pratique, à vérifier dans la même commande.
   ```sh
   docker compose exec hornet-finder-api python manage.py shell -c "
   from hornet.models import BeekeeperGroup
   from hornet.trap_permissions import is_beekeeper_group
   stale = [g for g in BeekeeperGroup.objects.all() if not is_beekeeper_group(g.path)]
   print([(g.path, g.traps.count(), g.apiarygrouppermission_set.count()) for g in stale])"
   ```
   Si tous les compteurs sont à `0`, supprimer ces lignes avec l'accord de l'utilisateur, par exemple dans l'admin Django.
7. `./export-realm.sh -n`, relire le diff, puis `./export-realm.sh`. Commiter `auth/realm-export.json` sur `main` : les identifiants réels remplacent ceux, fictifs, de l'export livré.
8. Marquer cette note `status: applied (date)`.

## Vérification
- `./status.sh`.
- Console : un compte nouvellement inscrit arrive dans `/trappers`. Le jeton d'un chasseur porte `hunter` dans `realm_access.roles`, celui d'un piégeur `trapper`. Plus aucun `volunteer`.
- Application, en piégeur :
  - pas d'entrée « Frelon » dans le menu d'ajout ;
  - la carte montre les nids détruits et les siens ;
  - « Mes pièges » et les QR Codes sont accessibles ;
  - pas de bouton de délégation sans association.
- Application, en chasseur : ajout de frelon, tous les nids.
- En apiculteur : délégation vers son association uniquement.
- `GET /api/nests/my/?lat=..&lon=..` répond `200` pour un piégeur, et `GET /api/nests/?...` répond `403`.

## Retour arrière
1. Code : `git reset --hard <sha de main avant la fusion>`, puis `./deploy.sh -b`. L'ancien code ne connaît que `volunteer`.
2. Keycloak :
   - renommer `hunter` en `volunteer` (même `PUT` que l'étape 3, noms inversés) ;
   - remettre `/volunteers` comme groupe par défaut et y rajouter les piégeurs ;
   - supprimer `trapper` et `/trappers`.

   L'ancienne appartenance à `/volunteers/vsa` est perdue. Noter ses membres à l'étape 1 si ce groupe doit pouvoir être reconstitué.
