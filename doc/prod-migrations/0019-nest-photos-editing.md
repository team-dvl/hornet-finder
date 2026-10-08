status: pending

# Photos, modification et date de destruction des nids (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`), après l'avoir fait et vérifié en dev (section « Dev d'abord »).**

## Périmètre
Migration `0022_nest_photos` : nouvelle table `hornet_nestphoto` (photos d'un nid, fichiers sous `media/nests/<id>/`). Aucune donnée existante n'est réécrite.

Droits :
- tout rôle joint des photos au signalement d'un nid ;
- les administrateurs de la plateforme et les **coordinateurs des chasseurs de nids** (nouveau sous-groupe Keycloak `/hunters/admin`) modifient un nid, ajoutent et retirent ses photos, et voient les numéros AFSCA des ruchers à 1 km au plus ;
- la date de destruction (`destroyed_at`) est posée quand un nid est marqué détruit ; seul un administrateur réactive un nid détruit. Les nids détruits avant cette version restent sans date (rien n'est inventé).

Ce qui **ne change pas** : `.env`, volumes, nginx (les photos passent par la vue média existante, `/_media/` sert tout `media/`).

**Impact utilisateurs** : aucun tant que `/hunters/admin` est vide ; les administrateurs ont les nouvelles fonctions dès le déploiement.

## Prérequis
- `main` propre, stack en service (`./status.sh`).
- Accès à la console Keycloak du realm `hornet-finder` avec un compte administrateur du realm (créer un groupe relève de `manage-users`, que `flow-admin` n'a pas).
- La liste des coordinateurs des chasseurs de nids, fournie par l'utilisateur.

## Dev d'abord
Mêmes étapes sur le realm `hornet-finder-dev` depuis le worktree dev (`./deploy.sh`), puis `./ui-shots.sh` : fiche d'un nid, ajout et suppression d'une photo, formulaire de modification. Le compte de test administrateur suffit pour les photos et la modification.

## Étapes
1. `./zfs-snapshot.sh create --tag pre-nest-photos -f`
2. `git merge --ff-only devel`
3. `./deploy.sh -b` (reconstruit le frontend ; l'API applique `0022_nest_photos`).
4. Console Keycloak, realm `hornet-finder` (confirmer avec l'utilisateur avant d'écrire) :
   - Groups → `hunters` → *Create child group* : nom `admin`, description « Coordinateurs des chasseurs de nids » ;
   - `/hunters/admin` → Role mapping → *Assign role* : `group-admin` ;
   - y ajouter les coordinateurs désignés (Members → *Add member*).
5. Les coordinateurs reçoivent leurs droits au renouvellement de leur jeton (au plus 60 minutes) ou en se reconnectant.

## Vérification
- `./status.sh` ; `./deploy.sh` affiche la migration `0022_nest_photos` appliquée.
- Dans l'application, en administrateur : fiche d'un nid → tuile appareil photo, ajouter une photo, l'ouvrir, la supprimer ; « Modifier » → marquer détruit, enregistrer : la fiche affiche « Détruit le ».
- En coordinateur : mêmes actions ; sur un nid détruit, l'interrupteur « Nid détruit » est verrouillé.

## Rollback
1. `git checkout <sha précédent>` puis `./deploy.sh -b`.
2. La table `hornet_nestphoto` peut rester (ignorée par l'ancien code) ; pour la retirer : `./zfs-snapshot.sh restore <suffixe du snapshot pre-nest-photos>` (voir `./zfs-snapshot.sh list` ; perd les données saisies depuis) ou `docker compose exec hornet-finder-api python manage.py migrate hornet 0021` avant le checkout.
3. Le sous-groupe `/hunters/admin` peut rester : l'ancien code ne lui donne aucun droit.
