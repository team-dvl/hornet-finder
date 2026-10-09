status: pending

# Retrait du panneau « Ressources » de la console « Mon compte » (`devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
Realm `hornet-finder` : `userManagedAccessAllowed` passe de `true` à `false`. C'est ce réglage (« User-managed access ») qui fait afficher l'entrée « Ressources » dans la console « Mon compte ». L'application n'utilise aucun service d'autorisation (UMA) : aucun client du realm n'a `authorizationServicesEnabled`, le panneau est donc toujours vide.

L'import du realm ne modifie pas un realm existant : le réglage est à appliquer à la main. `./deploy.sh` n'est pas nécessaire. Le changement est déjà fait dans le realm `hornet-finder-dev`.

Effet : l'entrée « Ressources » disparaît du menu (`isMyResourcesEnabled: false`). Aucun autre écran ni droit ne change, personne n'a de session à refaire.

Ce qui **ne change pas** : backend, frontend, nginx, `.env`, volumes, thèmes.

**Hors périmètre** : « Applications » et « Groupes » restent visibles dans « Mon compte ». Avec Keycloak 26.8.0, ils s'affichent pour tout titulaire de `manage-account` (rôle par défaut), même sans `view-applications` ni `view-groups`. Les retirer demanderait un `content.json` dans le thème `velutina`, non fait ici.

## Prérequis
- Réglage déjà appliqué et vérifié en dev (realm `hornet-finder-dev`).
- Les fichiers `auth/realm-export.json` et `auth/realm-export-dev.json` portent encore `"userManagedAccessAllowed": true` s'ils n'ont pas été mis à jour : les rafraîchir avec `./export-realm.sh` depuis le worktree dev, avant la fusion, pour qu'un realm recréé reparte avec la bonne valeur.
- Jeton `$T` et `$K=https://$KC_HOSTNAME/admin/realms/hornet-finder` comme dans la note 0011.

## Étapes
1. `git merge --ff-only devel`
2. **Keycloak (écriture, à confirmer avec l'utilisateur)** :
   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
     -d '{"userManagedAccessAllowed":false}' $K
   ```
   Le `PUT` doit répondre `204`. Équivalent console : Realm settings → General → **User-managed access** désactivé.

## Vérification
- `curl -s -H "Authorization: Bearer $T" $K | jq .userManagedAccessAllowed` → `false`.
- Se connecter à `https://auth.velutina.ovh/realms/hornet-finder/account/` avec un compte sans rôle `admin` : le menu ne contient plus « Ressources ».
- `./export-realm.sh -n` : plus d'écart sur `userManagedAccessAllowed`.

## Retour arrière
Remettre le réglage à `true` (même `PUT` avec `{"userManagedAccessAllowed":true}`, ou la case de la console). L'entrée « Ressources » revient aussitôt.
