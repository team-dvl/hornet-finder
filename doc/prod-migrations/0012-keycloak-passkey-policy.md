status: pending

# Politique passkey : vérification de l'utilisateur (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
Deux réglages WebAuthn du realm `hornet-finder`, portés dans `auth/realm-export.json` (et, pour le dev, `auth/realm-export-dev.json`) :

| Réglage | Avant | Après |
|---|---|---|
| `webAuthnPolicyPasswordlessUserVerificationRequirement` (passkey seule) | `not specified` | `required` |
| `webAuthnPolicyUserVerificationRequirement` (passkey en plus du mot de passe) | `not specified` | `preferred` |

Dev seulement : `webAuthnPolicyRpId` et `webAuthnPolicyPasswordlessRpId` passent de vide à `dev.velutina.ovh`. La prod a déjà `velutina.ovh`.

Ce qui **ne change pas** : le flux de connexion. La prod reste sur le flux `browser` (mot de passe) : **cette note ne lie pas `browser-passkey`**, qui reste une décision à part. Backend, frontend, nginx, `.env`, volumes, thèmes inchangés. `./deploy.sh` n'est pas nécessaire.

**Impact utilisateurs**
- Prod aujourd'hui : aucun, la connexion par passkey n'y est pas active.
- Quand `browser-passkey` sera lié : une passkey utilisée seule doit vérifier l'utilisateur (Face ID, empreinte ou code de l'appareil). Une clé USB sans PIN serait refusée. Le mot de passe et la réinitialisation par e-mail restent disponibles.
- Dev : changer le `RpId` invalide les passkeys déjà enregistrées avec l'ancien (elles étaient rattachées à `auth.dev.velutina.ovh`). Elles sont à réenregistrer depuis « Mon compte ».

## Prérequis
- Appliquer et tester d'abord en dev (realm `hornet-finder-dev`) : enregistrer une passkey sur un iPhone (Safari) et sur un Android (Chrome), se déconnecter, se reconnecter avec, et noter si l'appareil demande Face ID, l'empreinte ou le code.
- Savoir si des utilisateurs prod ont déjà une passkey : lecture seule, `GET $K/users/<id>/credentials`, type `webauthn-passwordless` (`flow-admin` a `view-users`).

## Étapes
1. `git merge --ff-only devel`
2. **Keycloak (écriture, à confirmer avec l'utilisateur)**. Jeton `$T` et `$K=https://$KC_HOSTNAME/admin/realms/hornet-finder` comme dans la note 0011 :
   ```sh
   curl -s -H "Authorization: Bearer $T" $K | python3 -c 'import sys,json;r=json.load(sys.stdin);print({k:v for k,v in r.items() if k.startswith("webAuthn") and ("UserVerification" in k or "RpId" in k)})'
   curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
     -d '{"webAuthnPolicyPasswordlessUserVerificationRequirement":"required","webAuthnPolicyUserVerificationRequirement":"preferred"}' $K
   ```
   Le `PUT` doit répondre `204`. Équivalent console : Authentication → Policies → WebAuthn Passwordless Policy → User verification requirement = Required ; WebAuthn Policy → Preferred.

## Vérification
- Relecture : `GET $K` → les deux valeurs ci-dessus.
- `./export-realm.sh -n` : plus d'écart avec les fichiers du dépôt sur ces réglages.
- Connexion par mot de passe, Google et Facebook : inchangée.

## Retour arrière
```sh
curl -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"webAuthnPolicyPasswordlessUserVerificationRequirement":"not specified","webAuthnPolicyUserVerificationRequirement":"not specified"}' $K
```
