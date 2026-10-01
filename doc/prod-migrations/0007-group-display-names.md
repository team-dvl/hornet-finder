status: applied (2026-09-30)

# Noms réels des groupes dans la délégation et le partage (`main` → `devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
| Commit | Changement |
|---|---|
| `feat: pick delegation and sharing groups by their real name` | Délégation d'un piège et partage d'un rucher : liste de groupes nommés comme dans Keycloak (description du groupe, sinon son nom), y compris pour un administrateur de la plateforme (toutes les associations `/beekeepers/*`), au lieu d'un champ texte `/beekeepers/xyz`. Les groupes enregistrés localement (`BeekeeperGroup`) prennent ce nom à chaque délégation ou partage, et via la commande `sync_group_names` |

Ce qui **ne change pas** : schéma de la base, Keycloak (lecture seule par le compte de service du backend), `.env`, nginx, volumes.

**Impact utilisateurs** : l'API redémarre (quelques secondes). Les badges des pièges et ruchers déjà délégués ou partagés affichent `beekeepers / xyz` jusqu'à l'étape 3.

## Prérequis
- Notes 0001 à 0006 appliquées.
- Chaque association d'apiculteurs a une **description** dans Keycloak (Groups → le groupe → *Description*, par exemple « Vedrin s'abeille ») : c'est le nom affiché. Sans description, le nom technique (`vsab`) est repris, y compris par `sync_group_names`.

## Étapes
1. `git merge --ff-only devel`
2. `./deploy.sh -b`
3. Renommer les groupes existants (idempotent ; ne touche que la colonne `name` de `hornet_beekeepergroup`) :
   ```sh
   docker compose exec hornet-finder-api python manage.py sync_group_names
   ```
   Chaque ligne affiche `chemin: ancien nom → nouveau nom` (ou `=` si inchangé).

## Vérification
- `./status.sh`
- Fiche d'un piège → Délégation : la liste montre les noms des associations.

## Rollback
Revenir au sha précédent et `./deploy.sh -b`. Les noms renommés restent : ils ne servent qu'à l'affichage.
