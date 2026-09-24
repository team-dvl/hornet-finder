status: pending

# Photo de profil (`main` 9cfe9f6 → `devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`), après la note 0002.**

## Périmètre
| Commit | Changement |
|---|---|
| (ce commit) | Photo de profil : envoi, remplacement et suppression dans la fenêtre « Informations utilisateur » (bouton « Bienvenue, … »), avatar dans la barre de navigation. Backend : `POST/DELETE/GET /api/me/avatar/`, champ `User.avatar` (migration `0012_user_avatar`, appliquée automatiquement au démarrage de l'API), fichiers publics sous `media/avatars/<guid>/`. L'URL de la photo est recopiée dans l'attribut Keycloak `picture`, qui alimente l'information `picture` du jeton et l'avatar de la console « Mon compte » |

Ce qui **change dans Keycloak** (non couvert par `./deploy.sh`) :
- deux attributs du profil utilisateur, réservés aux administrateurs (absents des formulaires) : `picture` (photo affichée) et `social_picture` (photo du compte Google/Facebook) ;
- des mappers Google et Facebook, en mode `Force`, qui tiennent `social_picture` à jour à chaque connexion sociale ;
- un mapper de jeton sur le client de l'app qui expose `social_picture` dans le jeton d'accès ;
- le rôle `manage-users` pour le compte de service du backend, qui écrit `picture`.

Logique : la photo envoyée dans l'app est prioritaire ; sans elle, la photo sociale est utilisée. Au chargement de l'app, `GET /api/me/avatar/` calcule la photo effective et la recopie dans `picture` si elle diffère du jeton. Les mappers n'écrivent jamais `picture` directement, pour ne pas écraser une photo envoyée.

Ce qui change dans **nginx** : la Content-Security-Policy (`nginx/include/security-headers.conf`) autorise les images des photos Google (`*.googleusercontent.com`) et Facebook (`platform-lookaside.fbsbx.com`, `*.fbcdn.net`). Sans cela, le navigateur bloque la photo sociale et l'app affiche l'icône par défaut. `./deploy.sh` redémarre nginx avec la nouvelle configuration.

Ce qui **ne change pas** : `.env`, volumes (les photos vont dans le volume média existant).

**Impact utilisateurs** : aucun tant que personne n'envoie de photo. L'API redémarre.

## Prérequis
- Note 0002 appliquée.
- Stack prod en marche.

## Étapes
1. Snapshot (`./zfs-snapshot.sh create --tag pre-profile-photo -f`) : une migration Django ajoute une colonne.
2. `git merge --ff-only devel`
3. `./deploy.sh` (reconstruit l'API, applique la migration `0012_user_avatar`, reconstruit le frontend avec `-b`)
4. **Keycloak (écritures, à confirmer avec l'utilisateur)**, realm `hornet-finder`. Tout se fait avec `flow-admin`, à condition qu'il ait `view-identity-providers` et `manage-identity-providers` (client `realm-management`), comme en dev. Préfixe : `K=https://auth.velutina.ovh/admin/realms/hornet-finder`.
   1. **Profil utilisateur** : `GET $K/users/profile`, ajouter à `attributes` les deux entrées suivantes, puis `PUT` du document complet :
      ```json
      {"name":"picture","displayName":"Photo","permissions":{"view":["admin"],"edit":["admin"]},"validations":{"uri":{},"length":{"max":1024}},"multivalued":false}
      {"name":"social_picture","displayName":"Photo (compte social)","permissions":{"view":["admin"],"edit":["admin"]},"validations":{"uri":{},"length":{"max":1024}},"multivalued":false}
      ```
   2. **Mapper Google** : `POST $K/identity-provider/instances/google/mappers`
      ```json
      {"name":"picture","identityProviderAlias":"google","identityProviderMapper":"google-user-attribute-mapper","config":{"syncMode":"FORCE","jsonField":"picture","userAttribute":"social_picture"}}
      ```
   3. **Facebook** : dans la config du fournisseur (`GET`/`PUT $K/identity-provider/instances/facebook`), `config.fetchedFields` = `picture.width(256).height(256)` (console : *Additional user's profile fields*). Puis `POST $K/identity-provider/instances/facebook/mappers` :
      ```json
      {"name":"picture","identityProviderAlias":"facebook","identityProviderMapper":"facebook-user-attribute-mapper","config":{"syncMode":"FORCE","jsonField":"picture.data.url","userAttribute":"social_picture"}}
      ```
   4. **Mapper de jeton** sur le client de l'app (`hornet-app`) : `POST $K/clients/<id>/protocol-mappers/models`
      ```json
      {"name":"social_picture","protocol":"openid-connect","protocolMapper":"oidc-usermodel-attribute-mapper","config":{"user.attribute":"social_picture","claim.name":"social_picture","jsonType.label":"String","access.token.claim":"true","id.token.claim":"false","userinfo.token.claim":"false","introspection.token.claim":"true"}}
      ```
   5. **Rôle du backend** : Clients → client du backend (`KC_CLIENT_ID` du `.env` prod) → Service account roles → Assign role → client `realm-management`, rôle `manage-users`. C'est une élévation de droits : le backend peut ensuite modifier n'importe quel utilisateur du realm. En dev, l'utilisateur l'a fait lui-même dans la console.

   Les URL de photo Facebook finissent par expirer ; comme `social_picture` est rafraîchi à chaque connexion Facebook, le problème ne concerne que les comptes qui ne se reconnectent plus par Facebook (l'app affiche alors l'icône par défaut).

## Vérification
- Se connecter, cliquer sur « Bienvenue, … », « Ajouter une photo » : la photo s'affiche en rond dans la fenêtre et dans la barre de navigation.
- `./logs.sh api` : aucune ligne `Could not update the Keycloak picture` (sinon le rôle `manage-users` manque).
- Users → l'utilisateur → Attributes : `picture` = `https://velutina.ovh/api/media/avatars/<guid>/<fichier>.jpg`.
- Après reconnexion, « Mon compte » affiche la photo en haut à droite.
- Compte lié à Google, sans photo envoyée : après une connexion via Google, `social_picture` est rempli, l'app affiche la photo Google et `picture` prend la même valeur.

## Retour arrière
- Retirer le rôle `manage-users` du compte de service du backend, supprimer les mappers `picture` des fournisseurs d'identité et le mapper `social_picture` du client de l'app.
- Les attributs `picture` et `social_picture` peuvent rester (inoffensifs) ou être retirés du profil utilisateur.
- Code : `git revert` puis `./deploy.sh -b`. La colonne `avatar` reste en base, sans effet ; restaurer le snapshot seulement si nécessaire.
