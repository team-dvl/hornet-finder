status: pending

# Second facteur obligatoire pour les administrateurs (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
Les titulaires du rôle `admin` (membres de `/admins`) doivent saisir un code OTP à chaque connexion par mot de passe. S'ils n'ont pas encore d'application d'authentification, Keycloak la leur fait configurer à la connexion.

Choix actuel : les administrateurs de groupes d'apiculteurs (`beekeeper-group-admin`) et de bénévoles (`group-admin`) ne sont **pas** concernés. Pour inclure un autre rôle plus tard : l'ajouter aux `CARRIERS` de `enforce-admin-2fa.sh` puis relancer `--apply` (ou rendre `mfa-required` composite enfant de ce rôle).

Dans le realm `hornet-finder` (porté par `auth/realm-export.json`, l'import ne modifie pas un realm existant) :

| Élément | Changement |
|---|---|
| Rôle de realm `mfa-required` | nouveau, composite enfant de `admin` |
| Flux `Conditional OTP` | nouvelle condition « l'utilisateur n'a PAS `mfa-required` » : l'OTP facultatif continue de fonctionner pour les autres |
| Flux `Mandatory OTP` (sous `Password and OTP`) | nouveau : OTP pour les titulaires de `mfa-required` |
| Flux du realm (`browserFlow`) | `browser` → `browser-passkey` |

Pourquoi lier le flux du realm : en prod, seul `hornet-app` utilise `browser-passkey` (surcharge du client). Les autres clients du realm, dont la console « Mon compte », suivent `browser`. Testé sur un Keycloak 26.7.4 local : un administrateur sans OTP s'y connecte, et la session SSO obtenue dispense ensuite l'application de demander l'OTP. Lier le realm à `browser-passkey` ferme ce contournement. Pour `hornet-app`, rien ne change (la surcharge pointait déjà ce flux).

Les flux modifiés sont personnalisés : Keycloak interdit de modifier les flux intégrés (`browser`) par l'API, d'où l'usage de `browser-passkey`. Le script `./enforce-admin-2fa.sh` applique les trois premières lignes du tableau de façon idempotente, avec `flow-admin` (rôle `manage-realm`, rien à ajouter).

**Hors périmètre, décidé** : une connexion par Google ou par Facebook n'est pas soumise à cette exigence (pas d'OTP local avec un fournisseur d'identité). Keycloak ne peut pas imposer le second facteur du fournisseur : un administrateur qui se connecte par Google n'a donc pas d'OTP local. Une connexion par passkey (vérification de l'utilisateur exigée, note 0012) remplace aussi l'OTP : elle vaut déjà deux facteurs.

**Impact utilisateurs**
- Les membres de `/admins` (et toute personne ayant `admin` en attribution directe), à leur première connexion par mot de passe après l'application : écran de configuration d'une application d'authentification (FreeOTP, Google Authenticator, Microsoft Authenticator), puis code à chaque connexion.
- Tous les autres, dont les administrateurs de groupes : inchangé (OTP facultatif s'ils en ont un).
- La console « Mon compte » suit désormais le flux passkey comme l'application (identifiant puis choix passkey ou mot de passe).

Ce qui **ne change pas** : backend, frontend, nginx, `.env`, volumes, thèmes. `./deploy.sh` n'est pas nécessaire.

## Prérequis
- Appliquer et tester d'abord en dev. Le realm dev est déjà lié à `browser-passkey` et n'a pas été recréé : seul `./enforce-admin-2fa.sh --apply` est nécessaire, depuis le worktree dev.
- Prévenir les administrateurs concernés. Chacun doit avoir un téléphone avec une application d'authentification sous la main.
- Garder une session administrateur ouverte pendant l'application, pour pouvoir annuler.
- Lister les personnes concernées : membres du groupe `/admins` (console : Groups → `/admins` → Members), ainsi que toute personne ayant `admin` en attribution directe (Role mapping).

## Étapes
1. `git merge --ff-only devel`
2. **Keycloak (écriture, à confirmer avec l'utilisateur).** Jeton `$T` et `$K=https://$KC_HOSTNAME/admin/realms/hornet-finder` comme dans la note 0011.
   ```sh
   ./enforce-admin-2fa.sh           # simulation : liste ce qui sera fait
   ./enforce-admin-2fa.sh --apply   # après accord : crée le rôle et les flux
   curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
     -d '{"browserFlow":"browser-passkey"}' $K
   ```
   Le `PUT` doit répondre `204`. Équivalent console pour la liaison : Authentication → `browser-passkey` → Action → Bind flow → Browser flow.

## Vérification
- `./enforce-admin-2fa.sh` : « Nothing to do: already in place. »
- `GET $K` → `browserFlow` = `browser-passkey`.
- Avec un compte de test membre de `/admins` (sans OTP) : après saisie du mot de passe, Keycloak propose de configurer l'application d'authentification, sur l'application comme sur « Mon compte ».
- Avec un compte sans rôle `admin`, y compris un administrateur de groupe : connexion inchangée.
- `./export-realm.sh -n` : le diff ne montre plus d'écart sur ces éléments.

## Retour arrière
Sans supprimer le rôle ni les flux (le flux `browser-passkey` sert encore à `hornet-app`) : retirer `mfa-required` des composites de `admin`, ce qui ramène le comportement d'origine (OTP facultatif pour tous).
```sh
RID=$(curl -s -H "Authorization: Bearer $T" $K/roles/mfa-required | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d "[{\"id\":\"$RID\",\"name\":\"mfa-required\"}]" $K/roles/admin/composites
```
Le `DELETE` doit répondre `204`. Pour remettre le realm sur `browser` : `{"browserFlow":"browser"}` (la console « Mon compte » retrouve alors le contournement décrit plus haut). Relancer `./enforce-admin-2fa.sh --apply` rétablit l'exigence. Un administrateur qui a déjà configuré son OTP le garde, et il lui est demandé comme avant.
