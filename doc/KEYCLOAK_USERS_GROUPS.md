# Modèle Keycloak des utilisateurs, rôles et groupes

Cette page décrit la configuration Keycloak attendue par Hornet Finder. Elle complète les exports `auth/realm-export.json` et `auth/realm-export-dev.json`.

## 1. Trois notions à distinguer

Keycloak utilise ici trois mécanismes différents :

1. **Rôle de realm** : entitlement global porté par le token dans `realm_access.roles`.
2. **Groupe Keycloak** : appartenance organisationnelle portée par le token dans le claim `membership`.
3. **Protocol mapper** : mapping OIDC qui transforme l'appartenance Keycloak en claim JWT. Ce n'est pas un rôle et ce n'est pas un groupe.

Les permissions d'un rucher utilisent les chemins complets des groupes (`/beekeepers/vsab`, par exemple), et non le nom court du groupe.

## 2. Rôles de realm et entitlements

Les rôles applicatifs à définir dans le realm sont :

| Rôle | Entitlements applicatifs |
| --- | --- |
| `admin` | Accès complet aux API. Peut lire, créer, modifier, archiver et supprimer les données. Pour les ruchers, contourne les permissions de groupe et l'appartenance au propriétaire. |
| `beekeeper` | Peut créer des observations de frelons, des nids et des ruchers. Peut lire et gérer ses propres ruchers. Les droits sur les ruchers d'autres utilisateurs dépendent de `ApiaryGroupPermission`. |
| `volunteer` | Peut créer des observations de frelons et des nids. Peut lire les ruchers auxquels un groupe lui donne `can_read`. Ne peut pas modifier les frelons ou les nids, qui sont réservés à `admin`. |
| `beekeeper-group-admin` | Rôle prévu pour identifier l'administrateur d'un groupe d'apiculteurs. Il est attribué aux sous-groupes `admin` des groupes d'apiculteurs. À ce jour, le backend ne l'utilise pas directement pour autoriser une opération : sa présence dans Keycloak ne remplace donc pas une permission Django. |

Les rôles `offline_access`, `uma_authorization` et les rôles techniques des clients Keycloak sont des rôles de fonctionnement Keycloak, pas des entitlements métier Hornet Finder.

### Point important sur l'héritage

Un rôle attribué à un groupe est hérité par les utilisateurs membres de ce groupe. Il est donc préférable d'attribuer les rôles métier aux groupes plutôt que de les attribuer individuellement à chaque utilisateur. Une attribution directe reste possible, mais elle rend le modèle plus difficile à maintenir.

## 3. Hiérarchie des groupes

La hiérarchie attendue est la suivante :

```text
/admins
/beekeepers
/beekeepers/<identifiant-groupe>
/beekeepers/<identifiant-groupe>/admin
/volunteers
/volunteers/<identifiant-groupe>
```

Les mappings de rôles des groupes sont les suivants :

| Groupe | Role mapping de realm |
| --- | --- |
| `/admins` | `admin`, `beekeeper`, `volunteer`, `beekeeper-group-admin` |
| `/beekeepers` | `beekeeper` |
| `/beekeepers/<identifiant-groupe>/admin` | `beekeeper-group-admin` |
| `/volunteers` | `volunteer` |

Le rôle placé sur un groupe parent est transmis à ses sous-groupes. Un membre de `/beekeepers/vsab` reçoit donc `beekeeper` et un membre de `/beekeepers/vsab/admin` reçoit en plus `beekeeper-group-admin`.

`/volunteers` est le groupe par défaut dans les exports. Tout nouvel utilisateur est donc ajouté à ce groupe tant que cette configuration reste active. Il faut ensuite déplacer ou ajouter l'utilisateur au groupe métier approprié.

## 4. Création et rattachement d'un utilisateur

Dans le realm applicatif (`hornet-finder` ou `hornet-finder-dev`) :

1. Créer ou laisser créer l'utilisateur via le fournisseur d'identité Google.
2. Ouvrir **Users**, puis l'utilisateur concerné.
3. Dans **Groups**, ajouter l'utilisateur au groupe approprié :
   - `/volunteers/<identifiant-groupe>` pour un bénévole rattaché à une organisation ;
   - `/beekeepers/<identifiant-groupe>` pour un apiculteur ;
   - `/beekeepers/<identifiant-groupe>/admin` uniquement pour le responsable du groupe ;
   - `/admins` uniquement pour un administrateur de la plateforme.
4. Vérifier dans **Role mapping** que les rôles hérités correspondent à l'intention.
5. Déconnecter/reconnecter l'utilisateur ou renouveler son token : les claims du JWT ne changent pas dans un token déjà émis.

Ne pas utiliser l'attribut utilisateur `role` comme source d'autorisation : le backend lit `realm_access.roles`.

## 5. Mappings OIDC à définir

### 5.1 Mapping des rôles

Le client doit inclure le client scope intégré `roles`. Il fournit notamment le claim :

```json
{
  "realm_access": {
    "roles": ["beekeeper"]
  }
}
```

Les clients `hornet-app` et `hornet-app-dev` ont déjà `roles` dans leurs **Default client scopes** dans les exports. Il ne faut pas créer un mapper métier parallèle pour remplacer `realm_access.roles`.

### 5.2 Mapping des groupes métier

Le backend cherche précisément :

```json
{
  "membership": [
    "/beekeepers/vsab",
    "/beekeepers/vsab/admin"
  ]
}
```

Pour l'obtenir, définir ou conserver un client scope OIDC nommé `membership` avec :

- **Mapper type** : `Group Membership`
- **Token claim name** : `membership`
- **Full group path** : activé
- **Multivalued** : activé
- **Add to access token** : activé
- **Add to ID token** : activé
- **Add to userinfo** : activé si l'interface doit l'afficher

Les exports configurent ce mapper avec `oidc-group-membership-mapper`. Le scope `membership` est optionnel sur `hornet-app` et `hornet-app-dev`, mais le frontend le demande dans `scope=openid profile email membership`. Si la configuration est recréée manuellement, il faut donc ajouter ce scope aux clients et conserver le même nom de claim.

Le claim `groups` n'est pas le claim utilisé par le backend pour les permissions d'apiary. Il faut vérifier le contenu du JWT décodé et rechercher `membership`.

## 6. Correspondance avec Django

Chaque groupe qui doit donner accès à un rucher doit aussi être créé dans l'administration ou via l'API Django dans `BeekeeperGroup` :

| Keycloak | Django `BeekeeperGroup` |
| --- | --- |
| `/beekeepers/vsab` | `path=/beekeepers/vsab` |
| `/beekeepers/ena` | `path=/beekeepers/ena` |

Le champ `path` doit correspondre exactement, y compris le premier `/` et la casse. Ensuite, créer une ligne `ApiaryGroupPermission` pour chaque rucher et chaque groupe, en choisissant `can_read`, `can_update` et `can_delete`.

Créer le groupe dans Keycloak ne crée pas automatiquement le groupe dans Django. Inversement, une ligne Django sans chemin présent dans `membership` ne donnera aucun accès.

## 7. Différences entre les environnements

Les realms sont distincts :

| Environnement | Realm | Client navigateur |
| --- | --- | --- |
| Développement | `hornet-finder-dev` | `hornet-app-dev` |
| Production | `hornet-finder` | `hornet-app` |

Les groupes de développement et de production ne doivent pas être mélangés. Les exports contiennent des exemples de sous-groupes différents ; toute organisation ajoutée dans un environnement doit être créée dans le realm correspondant et synchronisée avec la base Django de cet environnement.

## 8. Vérification rapide

Pour valider une configuration utilisateur :

1. Le token contient un rôle métier dans `realm_access.roles`.
2. Le token contient `membership` avec les chemins complets attendus.
3. Le chemin de groupe existe dans `BeekeeperGroup.path`.
4. Une ligne `ApiaryGroupPermission` existe pour le rucher concerné.
5. Le niveau demandé (`can_read`, `can_update` ou `can_delete`) est activé.

Un utilisateur peut être correctement authentifié tout en n'ayant aucun accès à un rucher : l'authentification, les role mappings, le protocol mapper et les permissions Django sont quatre vérifications distinctes.
