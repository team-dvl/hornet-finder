status: pending

# Politique de mot de passe, protection contre la force brute et e-mail Facebook (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
Trois réglages du realm `hornet-finder`, portés dans `auth/realm-export.json` et `auth/realm-export-dev.json` :

| Réglage | Avant | Après |
|---|---|---|
| `passwordPolicy` | aucune | `length(12) and notUsername and notEmail` |
| `bruteForceProtected` | `false` | `true` |
| `failureFactor` | `30` (sans effet) | `10` |
| Fournisseur `facebook` : `trustEmail` | `true` | `false` |

Inchangés : `permanentLockout=false`, `waitIncrementSeconds=60`, `minimumQuickLoginWaitSeconds=60`, `maxFailureWaitSeconds=900`, `maxDeltaTimeSeconds=43200`, fournisseur `google` (`trustEmail=true`).

L'import du realm ne modifie pas un realm existant : **les trois réglages sont à appliquer à la main** sur le realm prod. `./deploy.sh` n'est pas nécessaire (aucun code ni image ne change).

**Impact utilisateurs**
- Mot de passe : la politique ne s'applique qu'à la création d'un compte ou au changement d'un mot de passe. Les mots de passe existants restent valables.
- Force brute : 10 échecs de connexion dans une fenêtre de 12 h bloquent le compte 1 minute, puis le délai double jusqu'à 15 minutes. Contrepartie : quelqu'un qui connaît l'adresse d'un utilisateur peut la bloquer temporairement (15 minutes au plus par série d'échecs). Le blocage n'est jamais définitif. Les connexions par Google, Facebook et passkey ne sont pas concernées.
- Facebook : un nouveau compte créé par Facebook reçoit l'e-mail de vérification d'adresse (`verifyEmail=true`) à sa première connexion. Une connexion Facebook dont l'adresse correspond à un compte existant passe par l'écran de confirmation de rattachement, puis par une vérification par e-mail ou par le mot de passe du compte. Les comptes déjà rattachés à Facebook ne changent pas.

Le backend n'accepte les invitations que pour un compte à adresse vérifiée (`emailVerified`, `utils.py`) : le changement Facebook rend cette vérification fiable.

Ce qui **ne change pas** : backend, base de données, frontend, nginx, `.env`, volumes, thèmes.

## Prérequis
- Appliquer et vérifier d'abord en dev (realm `hornet-finder-dev`, mêmes commandes avec `KC_HOSTNAME` et le realm du `.env` dev).
- Worktree prod propre, SMTP prod fonctionnel (Realm settings → Email → « Test connection »), car la vérification d'adresse Facebook en dépend.
- `flow-admin` dispose déjà de `manage-realm` (realm) et `manage-identity-providers` (fournisseur) : rien à ajouter.

## Étapes
1. `git merge --ff-only devel`
2. **Keycloak (écriture, à confirmer avec l'utilisateur)**. Depuis le worktree prod, sans afficher le secret :
   ```sh
   set -a; . ./.env; set +a
   R=hornet-finder; K=https://$KC_HOSTNAME/admin/realms/$R
   T=$(curl -s -d grant_type=client_credentials -d client_id=flow-admin \
     --data-urlencode "client_secret=$FLOW_ADMIN_SECRET" \
     https://$KC_HOSTNAME/realms/$R/protocol/openid-connect/token | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

   # Sauvegarde de l'état actuel (lecture)
   curl -s -H "Authorization: Bearer $T" $K | python3 -c 'import sys,json;r=json.load(sys.stdin);print({k:r.get(k) for k in ("passwordPolicy","bruteForceProtected","failureFactor","permanentLockout")})'

   # Politique de mot de passe et force brute
   curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
     -d '{"passwordPolicy":"length(12) and notUsername and notEmail","bruteForceProtected":true,"failureFactor":10}' $K

   # Facebook : ne plus considérer l'adresse comme vérifiée (le secret masqué renvoyé par GET est conservé par Keycloak)
   curl -s -H "Authorization: Bearer $T" $K/identity-provider/instances/facebook \
     | python3 -c 'import sys,json;d=json.load(sys.stdin);d["trustEmail"]=False;print(json.dumps(d))' \
     | curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d @- $K/identity-provider/instances/facebook
   ```
   Chaque `PUT` doit répondre `204`. Équivalent console : Authentication → Policies → Password policy ; Realm settings → Security defenses → Brute force detection ; Identity providers → Facebook → Trust Email.

## Vérification
- Relecture : `GET $K` → `passwordPolicy`, `bruteForceProtected=true`, `failureFactor=10` ; `GET $K/identity-provider/instances/facebook` → `trustEmail=false` et `config.clientSecret` toujours `**********`.
- Inscription avec un mot de passe de 11 caractères : refusée (« longueur minimale 12 »). Avec 12 caractères : acceptée.
- Connexion Facebook et Google d'un compte existant : elles fonctionnent toujours.
- Console → Events : pas d'erreur `LOGIN_ERROR` inattendue après application.
- Ne pas tester le blocage sur un compte réel de prod. En dev : 10 mots de passe faux, le suivant est refusé même avec le bon mot de passe pendant 1 minute.
- `./export-realm.sh -n` : le diff ne montre plus d'écart avec les fichiers du dépôt sur ces réglages.

## Retour arrière
```sh
curl -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"passwordPolicy":"","bruteForceProtected":false,"failureFactor":30}' $K
```
puis remettre `trustEmail` à `true` sur le fournisseur `facebook` (même méthode que ci-dessus avec `True`). Les comptes créés entre-temps gardent leur mot de passe.
