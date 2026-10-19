status: pending

# Retrait de la case « Se souvenir de moi » (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
Realm `hornet-finder` : `rememberMe` passe de `true` à `false`. La case disparaît de l'écran de connexion. Elle ne changeait pas la durée de la session : `ssoSessionIdleTimeoutRememberMe` et `ssoSessionMaxLifespanRememberMe` valent 0, donc les limites normales s'appliquaient (3 jours d'inactivité, 7 jours au plus). Seule la persistance du cookie SSO de Keycloak en dépendait ; l'application garde ses jetons dans `localStorage` et les renouvelle sans ce cookie.

L'import du realm ne modifie pas un realm existant : le réglage est à appliquer à la main. Le thème `velutina` ne contient plus le bloc de la case (`login-username.ftl`), `./deploy.sh -s auth` le recharge si le thème n'est pas monté en volume.

Effet : aucune session n'est interrompue. Les utilisateurs qui avaient coché la case gardent leur cookie persistant jusqu'à son expiration.

Ce qui **ne change pas** : backend, frontend, nginx, `.env`, volumes, durées de session.

## Prérequis
- Réglage à faire aussi dans le realm `hornet-finder-dev` (Realm settings → Login → **Remember me**).
- Jeton `$T` et `$K=https://$KC_HOSTNAME/admin/realms/hornet-finder` comme dans la note 0011.

## Étapes
1. `git merge --ff-only devel`
2. `./deploy.sh -s auth` si le thème n'est pas lu en direct depuis le worktree.
3. **Keycloak (écriture, à confirmer avec l'utilisateur)** :
   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
     -d '{"rememberMe":false}' $K
   ```
   Le `PUT` doit répondre `204`. Équivalent console : Realm settings → Login → **Remember me** désactivé.

## Vérification
- `curl -s -H "Authorization: Bearer $T" $K | jq .rememberMe` → `false`.
- L'écran de connexion ne montre plus la case ; « Mot de passe oublié ? » reste affiché.
- `./export-realm.sh -n` : plus d'écart sur `rememberMe`.

## Retour arrière
Remettre `rememberMe` à `true` (même `PUT` avec `{"rememberMe":true}`, ou la case de la console) et rétablir `login-username.ftl` depuis git.
