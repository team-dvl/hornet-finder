status: pending

# Invitations aux groupes d'apiculteurs, emails de l'API (`main` → `devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
| Commit | Changement |
|---|---|
| `feat: invitations to join a beekeeper group` | Administration → Invitations : un administrateur de groupe d'apiculteurs (ou de la plateforme) invite un compte existant en tapant son adresse email complète ; l'invité accepte ou refuse depuis la page d'accueil. Backend : `/api/group-invitations/…`, `/api/me/group-invitations/…`, migration `0018_group_invitations` (appliquée automatiquement au démarrage de l'API) |
| `feat: email group invitations through the OVH MX Plan server` | L'API envoie un email à l'invité, par le serveur SMTP du MX Plan OVH |
| (ce commit) | Les emails reprennent la mise en page du thème email de Keycloak (le dossier `auth/themes/velutina/email` est monté en lecture seule dans l'API, `/app/email-theme`) ; un administrateur du groupe peut envoyer un rappel, une fois par 24 heures au plus. Migration `0019_group_invitation_reminders` (deux colonnes) |

Ce qui **change dans le `.env` prod** : deux variables, `EMAIL_HOST_USER` et `EMAIL_HOST_PASSWORD`. Le reste de la configuration SMTP est dans `docker-compose.prod.yml` : `ssl0.ovh.net`, port 465, TLS implicite (`EMAIL_USE_SSL=true`), comme les réglages SMTP du realm dans Keycloak. `./status.sh` exige désormais ces deux variables en prod.

Expéditeur : `Velutina <contact@velutina.ovh>` (`DEFAULT_FROM_EMAIL`), avec authentification par `admin@velutina.ovh` : exactement la combinaison déjà utilisée par Keycloak (Realm settings → Email : *From* `contact@velutina.ovh`, *Username* `admin@velutina.ovh`, SSL, port 465).

Ce qui change dans **`docker-compose.prod.yml`** : le montage `./auth/themes/velutina/email:/app/email-theme:ro` sur l'API. C'est un dossier (et non un fichier) : après un `git merge`, l'API voit la nouvelle version du thème sans être recréée.

Ce qui **ne change pas** : Keycloak (le compte de service du backend a déjà `manage-users`, note 0003 ; le thème n'est que relu), nginx, volumes Docker.

**Impact utilisateurs** : l'API redémarre (quelques secondes). Un envoi d'email ajoute la durée de la connexion SMTP à la requête d'invitation (délai maximal 15 s) ; en cas d'échec, l'invitation est quand même enregistrée et l'administrateur est invité à prévenir la personne.

Limites OVH à garder en tête (MX Plan, d'après les sources publiques, non vérifié dans le contrat) : de l'ordre de 200 emails par heure et par compte. Les invitations en sont très loin, mais le compte est partagé avec Keycloak.

## Prérequis
- Notes 0001 à 0005 appliquées.
- Les emails de Keycloak arrivent (par exemple « Mot de passe oublié » sur `auth.velutina.ovh`) : cela prouve que le compte `admin@velutina.ovh` et l'expéditeur `contact@velutina.ovh` sont acceptés par OVH.
- Le mot de passe de la boîte `admin@velutina.ovh` (le même que dans Keycloak, qui l'affiche masqué). S'il contient une apostrophe `'`, le changer d'abord (dans l'espace client OVH **et** dans Keycloak) : la valeur est écrite entre apostrophes dans le `.env`.

## Étapes
Écritures dans `.env` : **à confirmer avec l'utilisateur**. Ne jamais afficher le mot de passe.

1. Snapshot (`./zfs-snapshot.sh create --tag pre-group-invitations -f`) : les migrations créent deux tables.
2. Copie du `.env` hors du dépôt, puis ajout des deux variables sans affichage. Les apostrophes gardent la valeur littérale pour `bash` (`load_env`) comme pour Docker Compose (pas d'interprétation de `$`) :
   ```sh
   read -rs -p 'Mot de passe de admin@velutina.ovh : ' P; echo
   grep -q '^EMAIL_HOST_USER=' .env || \
     printf "EMAIL_HOST_USER=admin@velutina.ovh\nEMAIL_HOST_PASSWORD='%s'\n" "$P" >> .env
   unset P
   grep -oE '^EMAIL_HOST_[A-Z]*' .env
   ```
3. `git merge --ff-only devel`
4. `./deploy.sh -b` (reconstruit l'API, applique `0018_group_invitations` et `0019_group_invitation_reminders`, recrée le conteneur avec les nouvelles variables et le montage du thème, reconstruit le frontend)

## Vérification
- `./status.sh` : aucune variable manquante.
- Envoi de test par la commande intégrée de Django, avant toute invitation réelle :
  ```sh
  docker exec hornet-finder-api python manage.py sendtestemail admin@velutina.ovh
  ```
  Aucune erreur dans la sortie, et le message arrive dans la boîte `admin@velutina.ovh`. En cas de `SMTPAuthenticationError` (535), le mot de passe ou l'utilisateur est faux ; en cas de délai dépassé, le port 465 sortant est bloqué depuis le serveur.
- Thème lisible par l'API : `docker exec hornet-finder-api ls /app/email-theme/html/template.ftl` répond sans erreur.
- Depuis un compte administrateur : Administration → Invitations, inviter un compte de test. Message « Invitation envoyée… » (et non « l'email n'a pas pu partir »), email reçu par le compte invité avec le logo et le bandeau de couleurs des emails Keycloak, invitation visible sur sa page d'accueil. La cloche de rappel est grisée (« rappel dès le … », 24 heures après l'envoi).
- `./logs.sh api` : aucune ligne `Could not email group invitation` ni `Email theme unavailable`.

## Retour arrière
- Emails seuls : retirer `EMAIL_HOST_USER` et `EMAIL_HOST_PASSWORD` du `.env` et `./deploy.sh -s api`. Les invitations fonctionnent toujours, sans email (l'administrateur est prévenu de l'échec à chaque envoi).
- Fonctionnalité entière : `git revert` puis `./deploy.sh -b`. Les tables `hornet_groupinvitation` et `hornet_invitationthrottle` restent en base, sans effet ; restaurer le snapshot seulement si nécessaire.
