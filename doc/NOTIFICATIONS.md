# Notifications push

Un administrateur écrit à un membre ou à tout un groupe ; le message s'affiche sur l'écran des appareils abonnés, application fermée. Premier objectif : mesurer comment les notifications se comportent en PWA selon les plateformes.

## Fonctionnement

- **Abonnement** : chaque utilisateur active les notifications **par appareil** (Mon profil → Notifications). Le navigateur donne une adresse (*endpoint*) chez son service de notification (FCM pour Chrome et Android, Mozilla, Apple) et deux clés de chiffrement ; l'API les garde (`PushSubscription`). Un même appareil appartient à une seule personne : à la connexion de quelqu'un d'autre sur le téléphone, l'abonnement lui passe (`usePushRebind`), et il est retiré à la déconnexion.
- **Identité de l'API (VAPID, RFC 8292)** : une paire de clés par environnement signe chaque envoi. Générer avec `docker compose run --rm --no-deps --entrypoint python <service api> manage.py generate_vapid_keys`, puis `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (secrète) et au besoin `VAPID_SUBJECT` dans `.env`. `--entrypoint python` est nécessaire : l'entrypoint de l'image lance toujours gunicorn et ignore la commande donnée. Sans clés, l'application ne propose pas les notifications. Changer les clés désabonne tous les appareils.
- **Envoi** : depuis la liste des membres d'un groupe (*Administration → Mon groupe / Groupes / Piégeurs*), « Notifier le groupe » ou « Notifier » sur un membre. Mêmes droits que la liste : administrateur du groupe pour son groupe, administrateur de la plateforme partout (`/trappers` contient tous les comptes, donc atteint tout le monde ou n'importe qui). Les administrateurs de `/hunters` n'ont pas encore de liste de membres, donc pas d'envoi. L'expéditeur n'est jamais destinataire. Titre ≤ 60 caractères, texte ≤ 200, 10 envois par heure et par expéditeur.
- **Livraison** : l'API crée un `PushDelivery` par appareil et envoie en arrière-plan (8 envois en parallèle). Le service de notification répond 201 (pris en charge), 404/410 (appareil désabonné : l'abonnement est supprimé) ou une erreur.
- **Accusé de réception** : le service worker (`frontend/src/sw.ts`) affiche la notification puis appelle `POST /api/push/ack/<id>/` (sans session ; l'identifiant, non devinable, est le seul justificatif). Le délai entre l'envoi et l'accusé est affiché dans *Administration → Notifications* (administrateurs de la plateforme).
- **Journal d'audit** : `notification.sent` garde le titre et les effectifs, jamais le texte.
- **Conservation** (`push.purge_expired`, à chaque passage du service planifié) : l'historique des envois (`PushNotification`, avec leurs `PushDelivery`) est supprimé après 90 jours (`PUSH_HISTORY_DAYS`). Un appareil sur lequel l'application n'a pas été ouverte depuis 183 jours (`PUSH_DEVICE_IDLE_DAYS`, environ 6 mois) est oublié : chaque ouverture réenregistre l'abonnement et met à jour `last_seen_at`. Un appareil oublié dont le navigateur garde l'autorisation se réabonne de lui-même à la prochaine ouverture ; entre-temps, il ne reçoit rien. `manage.py purge_push_history --dry-run` compte ce qui partirait.

## Pastille sur l'icône

Il n'y a pas de boîte de réception : la pastille compte les notifications reçues **depuis la dernière ouverture de l'application**. Le service worker ajoute 1 à chaque push (compteur gardé dans le cache `push-badge`, qui survit à l'arrêt du worker) et le dessine avec `navigator.setAppBadge`. Rien n'est compté si l'application est au premier plan. La page efface le compteur, la pastille et les notifications encore affichées à l'ouverture et à chaque retour au premier plan (`usePushBadgeReset`).

| Plateforme | Pastille |
|---|---|
| iPhone / iPad (PWA installée, permission accordée) | Chiffre sur l'icône. |
| Ordinateur (Chrome, Edge, Safari 17+, application installée) | Chiffre sur l'icône. |
| Android (Chrome) | Un point posé par le système tant qu'une notification est dans le panneau, sans chiffre : `setAppBadge` n'y change rien. |

## Ce qu'on attend des plateformes (à vérifier par appareil)

| Plateforme | Attendu |
|---|---|
| Android, Chrome (onglet ou PWA installée) | Fonctionne, application fermée. Les économiseurs de batterie de certains constructeurs peuvent retarder la réception. |
| iPhone / iPad, iOS 16.4 ou plus | **Seulement dans la PWA ajoutée à l'écran d'accueil** ; l'autorisation se demande depuis cette application. Pas de push dans un onglet Safari. |
| Ordinateur : Chrome, Edge, Firefox, Safari (macOS 13+) | Fonctionne ; navigateur fermé, cela dépend du système. |

Une notification doit toujours s'afficher : iOS et Chrome retirent l'autorisation d'un site dont les pushes ne montrent rien (le worker affiche même un message sans contenu lisible).

## Protocole de test

1. En dev, générer et renseigner les clés, `./deploy.sh`.
2. Sur chaque appareil (Android Chrome, iPhone PWA installée, ordinateur) : se connecter, *Mon profil → Notifications* → activer, puis le bouton d'essai.
3. Avec un second compte administrateur de groupe : « Notifier » un membre, puis le groupe.
4. *Administration → Notifications* : statut (accepté / appareil retiré / injoignable) et délai d'affichage de chaque appareil. Tester aussi application fermée, écran verrouillé, mode économie d'énergie.

## Rappels des pièges

Les propriétaires de pièges reçoivent un rappel quand un relevé ou le renouvellement de l'attractif est dû. Code : `backend/hornet/reminders.py` ; écran : onglet *Pièges → À relever*.

- **Délais** : par type de piège (*Administration → Types de pièges*), `reading_interval_days` (relevé tous les N jours) et `refill_interval_days` (attractif tous les N jours). Vide : pas de rappel.
- **Ce qui est dû** est calculé à partir du journal, jamais stocké : un relevé est dû N jours après le dernier relevé (un événement `catch`, même vide) ou, sans relevé, après l'installation ; l'attractif N jours après la dernière recharge (`refill`) ou l'installation. Une inspection ne compte pas. Un relevé antérieur à une remise en service ne compte pas non plus.
- **Destinataire** : le propriétaire seul. Un piège remisé (`active` faux) ou sans propriétaire n'a pas de rappel ; *Remettre en service* (une installation) relance les deux délais.
- **Heure** : 9 h, 10 h le dimanche (heure de Bruxelles) ; un passage en retard rattrape jusqu'à 20 h, rien après.
- **Répétition** : le jour de l'échéance, puis tous les 2 jours tant que rien n'est enregistré, 3 relances au plus, puis plus rien jusqu'au prochain événement du piège (`TrapReminder` garde la date de référence et le nombre d'envois).
- **Regroupement** : une notification par piège et par sorte de rappel ; à partir de 3 rappels pour une même personne dans un même passage, un seul message récapitulatif. Un rappel répété pour le même piège remplace le précédent à l'écran (`tag`).
- **Clic** : la notification ouvre `/traps/due?trap=<id>` (ou `/traps/due` pour un récapitulatif) ; si l'application est déjà ouverte, le service worker la ramène au premier plan et la fait naviguer sans la recharger.
- **Qui est compté** : seulement les propriétaires qui ont un appareil abonné et la sorte de rappel activée ; quelqu'un qui s'abonne plus tard reçoit ce qui est dû à ce moment-là. Les rappels ne sont pas inscrits au journal d'audit (action du système, répétée chaque jour).

## Notifications des nids

Code : `backend/hornet/nest_alerts.py` (envoi), `backend/hornet/nest_season.py` (fin de saison) ; écran : module *Nids*.

- **Nouveau nid** (sorte « Tous les nouveaux nids ») : aux coordinateurs (administrateurs de la plateforme, `/hunters/admin`), activé d'office pour eux ; aux apiculteurs qui l'ont activé (coupé par défaut, choix explicite). Un nid signalé vide ne prévient que les coordinateurs.
- **Nid près de mes ruchers** : aux propriétaires des ruchers à moins de 1 km (`NEARBY_APIARY_RADIUS_M`) et aux administrateurs des associations avec lesquelles l'un de ces ruchers est partagé (`ApiaryGroupPermission`, lecture). Seulement pour un nid actif.
- **Suivi de mes signalements** : à qui suit le nid (`Nest.owner`, celui qui l'a signalé au départ), quand une vérification le confirme, l'écarte ou le trouve vide, et quand sa destruction est enregistrée ; rien quand c'est cette personne qui l'enregistre. Quand le suivi d'un nid lui est confié (`PUT /api/nests/{id}/owner/`), la nouvelle personne est prévenue aussitôt (« Un nid vous a été confié »), hors fenêtre horaire comme un message de groupe : c'est l'action d'une personne.
- **Une notification par événement et par personne**, la plus parlante (son propre rucher, puis celui de son association, puis « nouveau nid ») ; jamais sur sa propre action. `NestAlert` garde qui a reçu quoi, `NestEvent.alerted_at` marque l'événement traité.
- **Heure** : la fenêtre des rappels de pièges, de 9 h (10 h le dimanche) à 20 h, heure de Bruxelles. Un nid signalé dans la fenêtre part au passage suivant (10 minutes au plus) ; hors fenêtre, à l'ouverture suivante. Un événement resté 48 h sans envoi (service arrêté) est abandonné.
- **Regroupement** : à partir de 3 nouveaux nids pour une même personne dans un passage, un seul récapitulatif.
- **Texte** : le numéro du nid et la commune (code postal à 4 chiffres et localité lus dans l'adresse), lieu public ou privé, nombre de photos. Jamais l'adresse complète ni un nom : le texte se lit sur l'écran verrouillé. Toucher ouvre `/nests?nest=<id>`.
- Seules les personnes qui ont un appareil abonné sont comptées ; les envois ne vont pas au journal d'audit (action du système).
- **Fin de saison** : le 1<sup>er</sup> mars, les nids de la saison précédente encore signalés ou confirmés passent abandonnés (une entrée « Fin de saison » au journal, un événement `nest.season_ended` au journal d'audit), sans notification.
- `docker compose exec <service api> python manage.py send_nest_alerts --dry-run` affiche ce qui partirait (`--now 2026-10-20T09:05` pour simuler une heure).

### Le service planifié

Le service `scheduler` des fichiers compose (`hornet-finder-dev-scheduler`, `hornet-finder-scheduler`) est l'image de l'API lancée avec `manage.py run_scheduler` au lieu de gunicorn (surcharge de l'`entrypoint`). Toutes les 10 minutes, il fait un passage : envoyer les rappels dus aujourd'hui et pas encore partis, marquer abandonnés les nids dont la saison est finie, envoyer les notifications des nids en attente, puis purger l'historique et les appareils inutilisés (voir *Conservation*). Chaque tâche est indépendante : l'échec de l'une n'empêche pas l'autre. Le passage est idempotent et prend un verrou PostgreSQL (`pg_try_advisory_xact_lock`), deux passages simultanés n'envoient donc rien en double. Tant que l'API n'a pas appliqué ses migrations, il réessaie au passage suivant.

- `./deploy.sh -s scheduler` le redémarre seul ; `./logs.sh scheduler` montre ses passages.
- `docker compose exec <service api> python manage.py send_trap_reminders --dry-run` affiche ce qui partirait maintenant, sans rien envoyer (`--now 2026-10-20T09:05` pour simuler une heure).

## Réglages de chacun

Le module *Notifications* (tuile de l'accueil) réunit :

- **Cet appareil** : l'abonnement de l'appareil (interrupteur) et l'essai. Par appareil.
- **Me prévenir pour** : rappels de relevé, rappels d'attractif, nouveaux nids, nids près de mes ruchers, suivi de mes signalements, messages de mon groupe, messages de la plateforme. Par compte, pour tous les appareils. Chaque sorte n'est proposée qu'aux personnes concernées (`notification_kinds.concerns` : les nouveaux nids aux coordinateurs et aux apiculteurs, les nids près des ruchers aux apiculteurs). Tout est activé par défaut, sauf « Tous les nouveaux nids » pour un apiculteur ; seul ce qui diffère du défaut est enregistré (`User.notification_prefs`, `{sorte: booléen}`). Couper des messages d'administrateur demande une confirmation. Un message d'un administrateur de la plateforme est de la sorte « plateforme », celui d'un administrateur de groupe de la sorte « groupe » ; ceux qui l'ont coupée sont comptés à part (`muted`) dans le résultat de l'envoi.
- Les interrupteurs ont l'apparence de la plateforme : iOS sur iPhone et iPad, Material ailleurs (`data-platform` sur `<html>`, `components/ui/Switch.tsx`).

### Première demande

Un volet « Recevoir les rappels ? » s'ouvre une seule fois par appareil (`PushPromptSheet`) : à partir de la 2<sup>e</sup> visite, si le navigateur peut recevoir des notifications et ne les a jamais autorisées ni refusées, jamais sur un autre dialogue ni le jour où la suggestion d'installation s'est montrée. « Activer » est le geste qui déclenche la demande du navigateur (obligatoire sur iPhone) ; « Plus tard » repousse de 30 jours ; « Ne plus demander » arrête. Sur iPhone, hors application installée, c'est la suggestion d'installation qui passe d'abord.

## Limites connues

- **iPhone et mise à jour** : après un déploiement, l'ancien service worker peut rester actif tant que l'application n'a pas été fermée complètement (balayée du sélecteur d'applications) puis rouvrue. Un abonnement créé avec un ancien worker sans gestion du push reçoit les messages sans rien afficher : c'est ce qui a été observé en test.

- Le contenu s'affiche sur l'écran verrouillé : rien de confidentiel.
- La pastille est un compteur approximatif : deux pushes reçus en même temps peuvent n'en compter qu'un, et une notification balayée à la main du panneau n'est pas retirée du compte avant la prochaine ouverture.
- « Accepté » ne dit pas que la personne a vu le message ; seul l'accusé du worker le dit.
- Pas de repli par email, pas d'historique côté destinataire, pas d'envoi à `/hunters` ni à « tout le monde » d'un clic (passer par `/trappers`).
