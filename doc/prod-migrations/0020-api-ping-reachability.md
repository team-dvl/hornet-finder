status: pending

# Bandeau « Serveur injoignable » et sonde `/api/ping` (`main` → `devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
| Changement | Où |
|---|---|
| `location = /api/ping` : réponse statique `{"status":"ok"}` (`Cache-Control: no-store`, sans journal d'accès), servie par nginx sans passer par Django | `nginx/conf.d/prod.conf` (et `app-dev.conf` en dev) |
| Frontend : sonde de joignabilité du serveur et bandeau « Serveur injoignable » sous la barre de navigation, avec nouvelle tentative automatique | `frontend/src/utils/reachability.ts`, `components/layout/ReachabilityBanner.tsx` |
| CSP : `connect-src` accepte `https://api.ipify.org` et `https://api6.ipify.org` (adresse IP publique de l'appareil, demandée seulement à l'ouverture de l'aide du bandeau, pour la communiquer à qui gère la liste autorisée du pare-feu) | `nginx/include/security-headers.conf` (et `-dev`) |
| Frontend : écrans d'erreur (error boundary) à la place d'une page blanche quand l'affichage d'une page échoue | `components/common/ErrorBoundary.tsx`, `components/layout/ErrorFallback.tsx` |

La sonde n'est pas périodique tant que le serveur répond : elle part au lancement, au retour au premier plan, aux événements réseau du téléphone et après un appel API resté sans réponse. Seul un serveur injoignable déclenche des tentatives automatiques (5, 10, 20, 30 puis 60 s, avec ±20 % d'aléa, seulement app visible). Chaque sonde coûte environ 1 Ko, répondu par nginx.

Ce qui **ne change pas** : backend, base de données, `.env`, volumes, Keycloak.

**Impact utilisateurs** : quelques secondes de coupure pendant la recréation de nginx. Sans ce changement nginx, le bandeau s'afficherait en permanence : `/api/ping` serait transmis à Django, qui ne répond pas `{"status":"ok"}`.

## Prérequis
- Notes précédentes appliquées, stack prod en marche.

## Étapes
1. `git merge --ff-only devel`
2. `./deploy.sh -b` (reconstruit le frontend)
3. `./deploy.sh -s nginx` (recrée nginx, qui relit `prod.conf`; un fichier monté un par un reste lié à son ancienne version après le merge)

## Vérification
- `./status.sh`
- `curl -sk -i https://velutina.ovh/api/ping` : `200`, `Content-Type: application/json`, `Cache-Control: no-store`, corps `{"status":"ok"}`.
- `curl -skI https://velutina.ovh/ | grep -io "connect-src[^;]*"` contient `api.ipify.org`.
- Dans l'app, aucun bandeau. Réseau coupé (mode avion) : le bandeau « Serveur injoignable » apparaît, puis disparaît au retour du réseau (bouton « Réessayer » ou attente).

## Rollback
`git reset --hard <sha avant merge>` sur `main`, puis `./deploy.sh -b` et `./deploy.sh -s nginx`.
