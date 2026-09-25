status: pending

# Compte de service `flow-admin` à la place de l'utilisateur (`main` 4624b62 → `devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
| Commit | Changement |
|---|---|
| (ce commit) | `CLAUDE.md` et `.env.example` : l'accès à l'Admin API Keycloak passe par le client confidentiel `flow-admin` (grant `client_credentials`, `FLOW_ADMIN_SECRET`) au lieu de l'utilisateur `flow-admin@velutina.invalid` (grant `password` sur `admin-cli`, `FLOW_ADMIN_PASSWORD`) |

Pourquoi : un utilisateur peut se connecter partout (console d'administration, « Mon compte », tout client qui accepte le grant `password`), et Keycloak ne sait pas le limiter à un client ou à une adresse IP. Un client avec compte de service n'a ni écran de connexion ni mot de passe : sans le secret, qui ne vit que dans le `.env` du host, il est inutilisable.

Ce qui **change dans Keycloak** (non couvert par `./deploy.sh`), realm `hornet-finder` :
- nouveau client `flow-admin` : confidentiel, compte de service activé, tous les autres flux désactivés ;
- rôles `realm-management` du compte de service : `manage-realm`, `view-realm`, `manage-clients`, `view-clients`, `manage-identity-providers`, `view-identity-providers`, `view-users`. **Pas** `manage-users` : il ne s'ajoute qu'au cas par cas, avec l'accord de l'utilisateur ;
- en dernier seulement, suppression de l'utilisateur `flow-admin@velutina.invalid`.

Ce qui change dans le **`.env` prod** : ajout de `FLOW_ADMIN_SECRET` (et, facultatif, `FLOW_ADMIN_CLIENT_ID=flow-admin`), puis retrait de `FLOW_ADMIN_PASSWORD`.

Ce qui **ne change pas** : code, conteneurs, volumes. Aucun conteneur ni script du dépôt n'utilise `flow-admin` : pas besoin de `./deploy.sh`.

**Impact utilisateurs** : aucun.

## Prérequis
- Notes 0002 et 0003 appliquées.
- L'utilisateur `flow-admin@velutina.invalid` existe encore, avec en attribution directe `manage-clients` et `manage-users`, ainsi que les 7 rôles à attribuer (Keycloak refuse qu'un administrateur attribue un rôle `realm-management` qu'il n'a pas lui-même). C'était le cas le 2026-09-25.

## Étapes
Toutes les écritures Keycloak et `.env` sont **à confirmer avec l'utilisateur**. Ne jamais afficher le mot de passe ni le secret.

1. `git merge --ff-only devel` (documentation seulement).
2. **Jeton de l'utilisateur actuel** (grant `password`, comme avant) :
   ```sh
   set -a; . ./.env; set +a
   R=hornet-finder; K=https://$KC_HOSTNAME/admin/realms/$R
   T=$(curl -s -d grant_type=password -d client_id=admin-cli \
         --data-urlencode "username=${FLOW_ADMIN_USERNAME:-flow-admin@velutina.invalid}" \
         --data-urlencode "password=$FLOW_ADMIN_PASSWORD" \
         https://$KC_HOSTNAME/realms/$R/protocol/openid-connect/token | jq -r .access_token)
   kc() { curl -s -H "Authorization: Bearer $T" "$@"; }
   kc "$K/clients?clientId=flow-admin" | jq length   # 0 attendu
   ```
3. **Création du client** (écriture) :
   ```sh
   kc -w '%{http_code}\n' -H 'Content-Type: application/json' -X POST "$K/clients" -d '{
    "clientId":"flow-admin","name":"flow-admin (Admin API service account)",
    "description":"Host-only service account for Keycloak Admin API calls from shell scripts. Secret lives only in the host .env.",
    "protocol":"openid-connect","enabled":true,"publicClient":false,"clientAuthenticatorType":"client-secret",
    "serviceAccountsEnabled":true,"standardFlowEnabled":false,"directAccessGrantsEnabled":false,
    "implicitFlowEnabled":false,"frontchannelLogout":false,
    "attributes":{"oauth2.device.authorization.grant.enabled":"false","oidc.ciba.grant.enabled":"false"}}'
   # 201 attendu
   ```
4. **Rôles du compte de service** (écriture) :
   ```sh
   CID=$(kc "$K/clients?clientId=flow-admin" | jq -r '.[0].id')
   SA=$(kc "$K/clients/$CID/service-account-user" | jq -r .id)
   RM=$(kc "$K/clients?clientId=realm-management" | jq -r '.[0].id')
   ROLES=$(kc "$K/clients/$RM/roles" | jq -c '[.[]|select(.name|IN("manage-realm","view-realm","view-clients","manage-clients","view-identity-providers","manage-identity-providers","view-users"))|{id,name}]')
   echo "$ROLES" | jq length   # 7 attendu
   kc -w '%{http_code}\n' -H 'Content-Type: application/json' -X POST "$K/users/$SA/role-mappings/clients/$RM" -d "$ROLES"   # 204
   kc "$K/users/$SA/role-mappings/clients/$RM" | jq -c '[.[].name]'
   ```
5. **Secret dans le `.env` prod** (écriture, sans affichage). Garder une copie du `.env` hors du dépôt avant, puis ajouter les deux lignes juste après `FLOW_ADMIN_PASSWORD` :
   ```sh
   SEC=$(kc "$K/clients/$CID/client-secret" | jq -r .value)
   [ -n "$SEC" ] && [ "$SEC" != null ] && ! grep -q '^FLOW_ADMIN_SECRET=' .env && \
     awk -v s="$SEC" '{print} /^FLOW_ADMIN_PASSWORD=/{print "FLOW_ADMIN_CLIENT_ID=flow-admin"; print "FLOW_ADMIN_SECRET=" s}' .env > .env.new && \
     cat .env.new > .env && rm .env.new   # cat > .env garde les droits du fichier
   unset SEC
   grep -oE '^FLOW_ADMIN_[A-Z_]*' .env
   ```
6. **Test du compte de service**, voir *Vérification* ci-dessous. Ne pas aller plus loin si un appel échoue.
7. **En dernier seulement** (écritures) : supprimer l'utilisateur, avec le jeton `$T` de l'étape 2, puis retirer `FLOW_ADMIN_PASSWORD` (et `FLOW_ADMIN_USERNAME` s'il existe) du `.env` prod :
   ```sh
   U=$(kc "$K/users?username=flow-admin@velutina.invalid&exact=true" | jq -r '.[0].id')   # e5fa24de-743a-46dc-abf7-db00ba987115
   kc -w '%{http_code}\n' -X DELETE "$K/users/$U"   # 204
   sed -i '/^FLOW_ADMIN_PASSWORD=/d; /^FLOW_ADMIN_USERNAME=/d' .env
   ```

## Vérification
```sh
set -a; . ./.env; set +a
R=hornet-finder; K=https://$KC_HOSTNAME/admin/realms/$R; TOK=https://$KC_HOSTNAME/realms/$R/protocol/openid-connect/token
T=$(curl -s -d grant_type=client_credentials -d client_id=${FLOW_ADMIN_CLIENT_ID:-flow-admin} \
      --data-urlencode "client_secret=$FLOW_ADMIN_SECRET" $TOK | jq -r .access_token)
for p in "" /identity-provider/instances /clients /users/profile '/users?max=1' /authentication/flows /roles /groups; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $T" "$K$p") GET $p"; done   # 200 partout
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $T" https://$KC_HOSTNAME/admin/realms/master   # 403
curl -s -d grant_type=client_credentials -d client_id=flow-admin $TOK | jq -r .error   # unauthorized_client (pas de secret)
```
Après l'étape 7 : `GET $K/users?username=flow-admin@velutina.invalid&exact=true` renvoie `[]`.

Résultat en dev (2026-09-25) : 200 sur tous les appels ci-dessus, 403 sur `master`, `unauthorized_client` sans secret ou avec le grant `password`.

## Retour arrière
- Tant que l'étape 7 n'est pas faite, l'utilisateur `flow-admin@velutina.invalid` et `FLOW_ADMIN_PASSWORD` restent utilisables comme avant : il suffit de supprimer le client (`DELETE $K/clients/$CID`) et les lignes `FLOW_ADMIN_CLIENT_ID` / `FLOW_ADMIN_SECRET` du `.env`.
- Après l'étape 7 : recréer un utilisateur n'est plus nécessaire, le compte de service suffit. Pour une opération qui demande `manage-users`, l'ajouter au compte de service avec l'accord de l'utilisateur (console : Clients → `flow-admin` → Service account roles, en compte administrateur), puis le retirer.
- Secret compromis : Clients → `flow-admin` → Credentials → *Regenerate*, puis mettre à jour `FLOW_ADMIN_SECRET` dans le `.env`.
