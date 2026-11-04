status: pending

# Mise à jour de l'app au retour au premier plan (`main` fd7e74e → `devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
| Commit | Changement |
|---|---|
| `fix: PWA picks up a new version on resume` | Frontend : le service worker est enregistré par `utils/appUpdate.ts` (`virtual:pwa-register`). L'app cherche une nouvelle version quand elle revient au premier plan, quand le réseau revient et toutes les heures au premier plan, puis se recharge quand rien ne peut être perdu (aucun dialogue ouvert, aucun champ saisi sur la page), sinon au prochain changement de page. nginx : `/sw.js` et `/manifest.webmanifest` en `Cache-Control: no-cache` (au lieu d'un an, `immutable`, pour `sw.js`) |

Ce qui change dans **nginx** : deux `location =` dans `prod.conf`. `./deploy.sh` seul **ne suffit pas** : le fichier est monté un par un et le conteneur reste lié à son ancienne version après le `git merge` ; il faut le recréer (`./deploy.sh -s nginx`).

Ce qui **ne change pas** : backend, base de données, `.env`, volumes, Keycloak.

**Impact utilisateurs** : quelques secondes de coupure pendant la recréation de nginx. Les téléphones qui ont déjà l'app reçoivent cette version-ci avec l'ancien délai (au deuxième lancement à froid), car l'ancien code ne sait pas encore vérifier au retour ; les versions suivantes arrivent au retour dans l'app.

## Prérequis
- Notes précédentes appliquées.
- Stack prod en marche.

## Étapes
1. `git merge --ff-only devel`
2. `./deploy.sh -b` (reconstruit le frontend)
3. `./deploy.sh -s nginx` (recrée nginx, qui relit `prod.conf`)

## Vérification
- `./status.sh`
- `curl -skI https://velutina.ovh/sw.js | grep -i cache-control` donne `Cache-Control: no-cache` (et HTTP 200).
- `curl -skI https://velutina.ovh/manifest.webmanifest | grep -i cache-control` donne `Cache-Control: no-cache`.
- `curl -sk https://velutina.ovh/ | grep -c registerSW.js` vaut `0` (l'enregistrement est désormais dans le bundle).
- Au déploiement suivant : un téléphone où l'app est en arrière-plan affiche le nouveau numéro de version (menu) quelques secondes après son retour au premier plan.

## Rollback
`git reset --hard fd7e74e` sur `main`, puis `./deploy.sh -b` et `./deploy.sh -s nginx`.
