status: pending

# PKCE `S256` imposé sur le client de l'application (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
Dans le realm `hornet-finder`, les clients `hornet-app` et `hornet-app-dev` reçoivent l'attribut `pkce.code.challenge.method = S256`, porté dans `auth/realm-export.json`. Le dev l'impose déjà sur `hornet-app-dev` (realm `hornet-finder-dev`) : rien à faire côté dev.

Effet : Keycloak refuse toute demande de connexion de ces clients sans défi PKCE `S256` (`error=invalid_request`, « Missing parameter: code_challenge_method »), et refuse `plain`.

L'import du realm ne modifie pas un realm existant : le réglage est à appliquer à la main. `./deploy.sh` n'est pas nécessaire.

**Impact utilisateurs** : aucun attendu. L'application envoie déjà le défi `S256` à chaque connexion (`oidc-client-ts`, flux `code`), et la version dev, qui l'impose déjà, fonctionne. Un onglet resté ouvert sur une ancienne page de connexion n'est pas concerné.

Ce qui **ne change pas** : backend, frontend, nginx, `.env`, volumes, thèmes.

## Prérequis
- Se connecter en dev (realm `hornet-finder-dev`) depuis l'application : c'est déjà le cas, le dev impose `S256`.
- Jeton `$T` et `$K=https://$KC_HOSTNAME/admin/realms/hornet-finder` comme dans la note 0011.

## Étapes
1. `git merge --ff-only devel`
2. **Keycloak (écriture, à confirmer avec l'utilisateur)** :
   ```sh
   for CID in hornet-app hornet-app-dev; do
     ID=$(curl -s -H "Authorization: Bearer $T" "$K/clients?clientId=$CID" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
     curl -s -H "Authorization: Bearer $T" "$K/clients/$ID" \
       | python3 -c 'import sys,json;c=json.load(sys.stdin);c["attributes"]["pkce.code.challenge.method"]="S256";print(json.dumps(c))' \
       | curl -s -o /dev/null -w "$CID %{http_code}\n" -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d @- "$K/clients/$ID"
   done
   ```
   Chaque `PUT` doit répondre `204`. Équivalent console : Clients → `hornet-app` → Advanced → Advanced settings → **Proof Key for Code Exchange Code Challenge Method** = `S256`.

## Vérification
- Se déconnecter puis se reconnecter à l'application (`https://velutina.ovh`) : la connexion aboutit.
- Une demande sans défi est refusée :
  ```sh
  curl -s -D - -o /dev/null "https://$KC_HOSTNAME/realms/hornet-finder/protocol/openid-connect/auth?client_id=hornet-app&redirect_uri=https://velutina.ovh/&response_type=code&scope=openid" | grep -i '^location'
  ```
  La redirection contient `error=invalid_request` et `code_challenge_method`.
- `./export-realm.sh -n` : plus d'écart avec le dépôt sur ces clients.

## Retour arrière
Même commande avec `c["attributes"]["pkce.code.challenge.method"]=""` (aucune méthode imposée).
