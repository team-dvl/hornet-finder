status: applied (2026-10-01)

# Politique passkey : vérification de l'utilisateur (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
Deux réglages WebAuthn du realm `hornet-finder`, portés dans `auth/realm-export.json` (et, pour le dev, `auth/realm-export-dev.json`) :

| Réglage | Avant | Après |
|---|---|---|
| `webAuthnPolicyPasswordlessUserVerificationRequirement` (passkey seule) | `not specified` | `required` |
| `webAuthnPolicyUserVerificationRequirement` (passkey en plus du mot de passe) | `not specified` | `preferred` |

Dev seulement : `webAuthnPolicyRpId` et `webAuthnPolicyPasswordlessRpId` passent de vide à `dev.velutina.ovh`. La prod a déjà `velutina.ovh`.

Ce qui **ne change pas** : le flux de connexion, le backend, le frontend, nginx, `.env`, volumes, thèmes. `./deploy.sh` n'est pas nécessaire.

**Correction** : le flux du realm prod est `browser`, mais le client `hornet-app` est surchargé pour utiliser `browser-passkey` (Clients → `hornet-app` → Advanced → Authentication flow overrides). La connexion par passkey est donc **déjà active pour l'application en prod**, et ce changement y prend effet dès qu'il est appliqué.

**Impact utilisateurs**
- Prod, dès l'application : une passkey utilisée seule doit vérifier l'utilisateur (Face ID, empreinte ou code de l'appareil). Une clé USB sans PIN serait refusée. Le mot de passe et la réinitialisation par e-mail restent disponibles.
- Aucun effet pour les utilisateurs qui n'ont pas de passkey.
- Dev : changer le `RpId` invalide les passkeys déjà enregistrées avec l'ancien (elles étaient rattachées à `auth.dev.velutina.ovh`). Elles sont à réenregistrer depuis « Mon compte ».

## Prérequis
- Appliquer et tester d'abord en dev (realm `hornet-finder-dev`) : enregistrer une passkey sur un iPhone (Safari) et sur un Android (Chrome), se déconnecter, se reconnecter avec, et noter si l'appareil demande Face ID, l'empreinte ou le code.
- Savoir si des utilisateurs prod ont déjà une passkey sans mot de passe : lecture seule, `GET $K/users/<id>/credentials`, type `webauthn-passwordless` (`flow-admin` a `view-users`). Avec le flux actif en prod, c'est ce qui décide de l'impact réel.

## Étapes
1. `git merge --ff-only devel`
2. **Keycloak (écriture, à confirmer avec l'utilisateur)**. Jeton `$T` et `$K=https://$KC_HOSTNAME/admin/realms/hornet-finder` comme dans la note 0011 :
   ```sh
   # Etat actuel (lecture)
   curl -s -H "Authorization: Bearer $T" $K | python3 -c 'import sys,json;r=json.load(sys.stdin);print({k:v for k,v in r.items() if k.startswith("webAuthn") and ("UserVerification" in k or "RpId" in k)})'
   # Ecriture : il faut renvoyer tout le bloc webAuthnPolicy*
   curl -s -H "Authorization: Bearer $T" $K | python3 -c 'import sys,json;r=json.load(sys.stdin);p={k:v for k,v in r.items() if k.startswith("webAuthnPolicy")};p["webAuthnPolicyPasswordlessUserVerificationRequirement"]="required";p["webAuthnPolicyUserVerificationRequirement"]="preferred";print(json.dumps(p))' \
     | curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d @- $K
   ```
   Le `PUT` doit répondre `204`. **Un `PUT` partiel (seulement ces deux champs) répond aussi `204` mais ne change rien : toujours relire après.** Équivalent console : Authentication → Policies → WebAuthn Passwordless Policy → User verification requirement = Required ; WebAuthn Policy → Preferred.

   En dev (realm `hornet-finder-dev`), ajouter `;p["webAuthnPolicyRpId"]=p["webAuthnPolicyPasswordlessRpId"]="dev.velutina.ovh"` juste avant `;print` : les passkeys déjà enregistrées avec l'ancien `RpId` sont à réenregistrer.

## Vérification
- Relecture : `GET $K` → les deux valeurs ci-dessus.
- `./export-realm.sh -n` : plus d'écart avec les fichiers du dépôt sur ces réglages.
- Connexion par mot de passe, Google et Facebook : inchangée.

## Retour arrière
```sh
curl -s -H "Authorization: Bearer $T" $K | python3 -c 'import sys,json;r=json.load(sys.stdin);p={k:v for k,v in r.items() if k.startswith("webAuthnPolicy")};p["webAuthnPolicyPasswordlessUserVerificationRequirement"]=p["webAuthnPolicyUserVerificationRequirement"]="not specified";print(json.dumps(p))' \
  | curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d @- $K
```
