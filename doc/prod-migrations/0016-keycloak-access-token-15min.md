status: pending

# Jeton d'accès de 15 minutes au lieu de 3 heures (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
Realm `hornet-finder` : `accessTokenLifespan` passe de `10800` (3 h) à `900` (15 min), porté dans `auth/realm-export.json` et `auth/realm-export-dev.json`. L'import du realm ne modifie pas un realm existant : le réglage est à appliquer à la main. `./deploy.sh` n'est pas nécessaire.

Effet : une révocation (compte désactivé, retrait d'un groupe ou d'un rôle) atteint l'API au plus 15 minutes plus tard, au lieu de 3 heures. Les sessions ne changent pas : le renouvellement du jeton passe par le jeton de rafraîchissement, valable tant que la session SSO l'est (3 jours d'inactivité, 7 jours au plus).

**Cette note est indépendante des autres : elle peut être appliquée en dernier, ou pas du tout.**

## Risque à valider avant la prod : les téléphones
Le téléphone est la cible principale, et le renouvellement du jeton dépend du navigateur :
- L'application renouvelle son jeton avant l'expiration (`oidc-client-ts`, prod : notification 10 minutes avant l'expiration, soit 5 minutes après l'émission avec un jeton de 15 minutes).
- Téléphone verrouillé ou application en arrière-plan, les minuteurs sont suspendus : au retour, le jeton peut déjà être expiré. Avec 3 h, cela arrivait rarement. Avec 15 minutes, cela arrivera à chaque pause un peu longue.
- L'intercepteur `frontend/src/utils/api.ts` n'essaie pas de renouveler le jeton sur une réponse 401 : il l'oublie seulement. Plusieurs écrans lisent directement `auth.user.access_token`.
- Je n'ai pas pu tester ce parcours : il dépend du comportement du navigateur mobile.

À faire en dev, sur un iPhone (Safari) et un Android (Chrome) : ouvrir l'application, verrouiller le téléphone 20 minutes, revenir, puis ajouter une observation et ouvrir la carte. Si une erreur d'authentification apparaît, ne pas appliquer en prod avant d'avoir fait renouveler le jeton au retour de l'application (correction côté frontend). Une valeur intermédiaire (30 ou 60 minutes) réduit la fréquence du problème sans le supprimer.

Le backend n'est pas concerné : il demande un jeton neuf à Keycloak à chaque appel de l'Admin API.

Ce qui **ne change pas** : backend, frontend, nginx, `.env`, volumes, thèmes.

## Prérequis
- Appliquer et tester d'abord en dev (realm `hornet-finder-dev`).
- Jeton `$T` et `$K=https://$KC_HOSTNAME/admin/realms/hornet-finder` comme dans la note 0011.

## Étapes
1. `git merge --ff-only devel`
2. **Keycloak (écriture, à confirmer avec l'utilisateur)** :
   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
     -d '{"accessTokenLifespan":900}' $K
   ```
   Le `PUT` doit répondre `204`. Équivalent console : Realm settings → Tokens → **Access Token Lifespan** = 15 minutes.

## Vérification
- `GET $K` → `accessTokenLifespan` = `900`.
- Le champ `exp` moins `iat` d'un nouveau jeton vaut 900 (`expires_in` = 900 dans la réponse du point d'accès aux jetons).
- Sur un téléphone, parcours décrit plus haut.

## Retour arrière
```sh
curl -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"accessTokenLifespan":10800}' $K
```
Les jetons déjà émis gardent leur durée d'origine.
