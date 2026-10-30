# Module ruchers : conception

Gestion des ruches et des colonies, à côté de la lutte contre le frelon : ruchers, ruches, colonies, visites (planifiées puis rapportées), photos. Public : les petits ruchers familiaux, conduits pour le maintien de l'espèce et la pollinisation, sans orientation miel. Le varroa est géré par la rupture de ponte (division, essaimage), sans traitement chimique.

Statut : **étape 1 (ruches) implémentée** (app Django `apiculture`, onglet *Ruches* du module *Ruchers*), étapes suivantes à venir. La reprise des données de l'application Glide actuelle est un projet séparé (voir « Reprise Glide » en fin de document) ; ce module lui réserve seulement un point d'ancrage.

## Décisions

| # | Question | Décision |
|---|---|---|
| A | App séparée ou intégrée ? | **Intégrée** : nouvelle app Django `apiculture`, module frontend chargé à la demande |
| 1 | Participants sans compte à une visite | Oui, nom en texte libre, jamais repris dans l'audit |
| 2 | Hébergeur et apiculteur responsable | Deux notions distinctes : l'hébergeur (qui accueille le rucher) est un attribut du rucher, l'apiculteur responsable (à qui la ruche est confiée) un attribut de la ruche |
| 3 | Propriété d'une ruche | Un groupe **ou** une personne, mutuellement exclusifs |
| 4 | Public du module | Tous les apiculteurs (rôle `beekeeper`) |
| 5 | Réseau aux ruchers | Pas garanti : **la saisie de terrain fonctionne hors ligne** |
| 6 | Compatibilité des barrettes | Nucleus, TBH et TBH Chandler interchangeables entre eux. Les Warré ont aussi des barrettes (pas de cadres), non interchangeables avec les autres. La ruche tronc n'en a pas |
| 7 | Trou de vol avec cloison | Un par compartiment : les observations d'entrée se notent par colonie |
| 8 | Nombre maximal de barrettes | Fixe par type : 24 pour TBH et Chandler (partagées entre les deux colonies quand il y a une cloison), 12 pour le nucleus, 8 par élément de Warré |

## Architecture

- **Backend** : app Django `apiculture` dans le projet existant, ses propres modèles et migrations. Elle dépend de `hornet` (`Apiary`, `User`, `BeekeeperGroup`, droits de groupe, `images.py`, vue des médias, `audit`, `push`, planificateur), jamais l'inverse. Seuls points d'entrée dans le reste de l'application : un compteur dans `pending.COUNTERS`, la documentation dans `help/registry.ts`.
- **Frontend** : module `/ruchers` (pages chargées par `lazy()`), visible au rôle `beekeeper`, tuile sur l'accueil et entrée de menu.
- **Pourquoi intégrer** : réutilisation de l'authentification, des groupes, des photos, de l'audit, des notifications (un abonnement push est lié à une origine : une seconde application obligerait à installer une seconde PWA et à réautoriser les notifications), du déploiement et des sauvegardes. `Apiary` resterait sinon en deux exemplaires. Et le frelon fait partie de la vie du rucher (cité dans 18 % des comptes rendus Glide, muselières).
- **Contrepartie acceptée** : l'application dépasse son nom (`velutina.ovh`) et les mises en production sont couplées. La frontière à sens unique garde une extraction possible.

## Modèle de données

Les objets créés sur le terrain (colonies, visites, inspections, photos) ont une **clé primaire UUID générée par le client**, condition du fonctionnement hors ligne (voir plus bas). Les ruches aussi, par homogénéité.

### Type de ruche (`HiveType`, référentiel, comme `TrapType`)

Modifiable par les administrateurs de la plateforme.

| Champ | Rôle |
|---|---|
| `slug`, `name`, `description`, `photo`, `sort_order` | présentation |
| `bar_family` | barrettes interchangeables entre types de même famille : `topbar` (TBH, Chandler, nucleus), `warre`, vide (tronc) |
| `max_bars` | nombre maximal de barrettes, fixe par type : TBH et Chandler 24, nucleus 12, vide pour Warré et tronc |
| `bars_per_box` | Warré : 8 barrettes par élément (le nombre d'éléments, lui, varie) |
| `max_colonies` | 2 pour TBH et Chandler (avec cloison), 1 sinon |

Valeurs initiales : TBH, TBH Chandler, Warré, tronc, nucleus. La vue détaillée propre à chaque type (barrettes d'une Chandler, éléments d'une Warré) est une étape ultérieure.

### Rucher (`hornet.Apiary`, existant)

Inchangé, plus un **hébergeur** facultatif (`host_name`) : un nom en texte libre, jamais écrit dans le journal d'audit (le lien vers un compte viendra si le besoin se confirme). Le rucher garde sa position, son responsable (`owner`), son numéro AFSCA et son partage par groupe.

### Ruche (`Hive`)

- `name`, `number` (modifiables : **rien ne référence une ruche par son nom**), `hive_type`, `photo`, `commissioned_at`, `comments`.
- `status` : en service, remisée, réformée.
- Propriétaire : `owner_group` **ou** `owner_user` (contrainte de base : exactement un des deux).
- `keeper` : l'apiculteur à qui la ruche est confiée.
- `divider_bar` (étape 2) : position de la cloison (numéro de barrette), vide sans cloison.
- `external_ref` : identifiant dans une source externe (reprise Glide), unique quand renseigné.
- Historiques datés (du, au) : **emplacements** (`HivePlacement` : ruche, rucher) et **responsables** (`HiveCustody` : ruche, apiculteur). Une ruche remisée n'a pas d'emplacement courant.

### Colonie (`Colony`)

- `name` (le surnom donné par les apiculteurs), `started_at`, `ended_at`.
- `origin` : division, souche restée après essaimage, essaim récolté, essaim nu acheté, inconnue.
- `parent` : colonie d'origine (division, essaimage), d'où la généalogie.
- `end_cause` : morte, réunie (avec la colonie qui l'absorbe), désertée, inconnue.
- **Occupation** (`ColonyOccupancy`, datée) : colonie, ruche, compartiment (1 ou 2). La colonie est distincte de la ruche : un transfert (nucleus vers TBH, compartiment vers une autre ruche) garde son identité et sa généalogie.
- Règles vérifiées par le serveur : colonies actives d'une ruche ≤ `max_colonies` de son type ; compartiment 2 seulement avec une cloison ; cloison retirée seulement si un compartiment est libre ; transfert de barrettes seulement entre types de même `bar_family`.

### Événements de colonie

Actions explicites, jamais déduites du texte (dans Glide, divisions et essaimages ne vivent que dans les comptes rendus, la généalogie est perdue) :

| Action | Effet |
|---|---|
| Division vers l'autre compartiment | pose la cloison si besoin, crée la colonie fille (compartiment 2) |
| Division ou essaim récolté vers une autre ruche (souvent un nucleus) | crée la colonie dans cette ruche |
| Essaimage | la colonie restante est la souche, l'essaim parti est noté (récolté : nouvelle colonie) |
| Transfert | déplace la colonie (et le nombre de barrettes) vers une autre ruche ou un autre compartiment |
| Réunion, mort, désertion | ferme la colonie |

La date de ces événements alimente la **rupture de ponte** attendue (calculée, pas saisie).

### Visite (`Visit`)

- Une sortie à **un rucher**, pas une ligne par ruche (Glide : 27 sorties sur plusieurs ruches encodées en 56 lignes).
- `status` : prévue, faite, annulée. `planned_at`, `started_at`, `duration` (facultative : dans Glide la fin était vide 192 fois sur 449, et parfois antérieure au début).
- `title` libre (Glide : 307 intitulés différents pour 449 visites) et `kinds` parmi un petit ensemble (contrôle, nourrissage, division, récolte d'essaim, transfert, pose de muselière, autre).
- Participants : comptes (`VisitParticipant`) et noms en texte libre (`guest_names`). Glide : un tiers des visites a plusieurs participants, jusqu'à 6.
- `report` : compte rendu libre, champ à part entière.

### Inspection (`Inspection`, une visite × une colonie)

L'unité de saisie est la **colonie** (deux colonies dans une TBH : deux comptes rendus), avec la ruche et le compartiment. Colonie vide permise pour une ruche dont l'occupant n'est pas encore connu. Tous les champs structurés sont **facultatifs** et la note libre reste première (dans Glide tout est texte, médiane 211 caractères) :

| Champ | Fréquence dans les comptes rendus Glide |
|---|---|
| nourrissage : type (sirop, candi), quantité | 153 / 449 |
| activité au trou de vol, entrée de pollen | 138 |
| comportement (calme → agressive) | 59 |
| frelons devant l'entrée (aucun, quelques-uns, nombreux), muselière posée | 79, 16 |
| couvain, œufs, reine vue, cellules royales | 30, 5, 21, 15 |
| essaimage observé | (101 mentions d'« essaim ») |
| configuration : barrettes occupées (topbar), éléments (Warré), position de la cloison | « idem » ou « inchangé » ~80 fois |

La configuration est **reprise de la visite précédente** et seulement corrigée. Les observations d'entrée se notent par colonie (un trou de vol par compartiment).

### Photos (`VisitPhoto`)

Toujours téléversées dans l'application (pipeline `images.py` : JPEG ≤ 1600 px, environ 0,2 à 0,4 Mo, miniature), rattachées à la visite et facultativement à une colonie ou une ruche, rangées sous `apiculture/<id>/` pour que la vue des médias résolve les droits par le chemin. Jamais de lien externe (Glide : 82 photos sur 109 sont des liens Drive, 3 des liens iCloud déjà perdus ou fragiles).

## Droits

- **Lecture** d'une ruche, de ses colonies et visites : son propriétaire (la personne, ou les membres du groupe propriétaire), son apiculteur responsable, les lecteurs du rucher où elle se trouve (partage par groupe existant), les administrateurs de la plateforme.
- **Saisie d'une visite** (et de ses inspections, photos, événements de colonie) : l'apiculteur responsable, le propriétaire (personne ou administrateur du groupe propriétaire), les participants inscrits de la visite, les administrateurs de la plateforme.
- **Ruche** (création, déplacement, remise, changement de responsable ou de propriétaire) : le propriétaire et les administrateurs de la plateforme.
- Règles regroupées dans `apiculture/permissions.py`, sur le modèle de `apiary_permissions.py` (préfixes de groupes).

## Fonctionnement hors ligne

La saisie de terrain (visites, inspections, photos, événements de colonie) fonctionne sans réseau ; la consultation aussi, pour ce qui a été chargé.

- **Cache de lecture** (IndexedDB) : ruchers, ruches, colonies et dernière inspection de chaque colonie (pour la reprise de configuration) de l'utilisateur, rafraîchis à chaque ouverture en ligne. Volume attendu : quelques centaines de Ko.
- **File d'envoi** (IndexedDB) : chaque création ou modification est une opération rejouable portant l'UUID de l'objet (création idempotente : un envoi rejoué ne crée pas de doublon). Une colonie créée hors ligne par une division peut ainsi être référencée par l'inspection suivante dans la même file. Les opérations sont rejouées **dans l'ordre** ; la première refusée par le serveur (capacité de la ruche, droits) arrête la file et s'affiche à l'utilisateur pour correction.
- **Photos** : compressées dans le navigateur (≈ 1600 px) avant d'être stockées comme `Blob`, envoyées après la visite. Ordre de grandeur : 20 photos ≈ 6 Mo, loin des quotas des navigateurs.
- **Modifications concurrentes** : chaque objet modifiable porte une version ; une modification fondée sur une version dépassée est refusée et présentée à l'utilisateur, jamais écrasée en silence. Les créations, l'essentiel du travail de terrain, ne sont pas concernées.
- **Synchronisation** depuis la page, jamais depuis le service worker (règle de `utils/oidc.ts` ; Background Sync n'existe pas sur Safari iOS) : au lancement, à la reprise et au retour du réseau, sur les événements de `utils/reachability.ts`. Un indicateur montre le nombre d'éléments en attente.
- **Session** : sans `offline_access`, le jeton de rafraîchissement suit la session Keycloak (inactivité 3 jours, durée maximale 7 jours dans `realm-export.json`). Après plus longtemps hors ligne, il faut se reconnecter : la file est **conservée par utilisateur (GUID)** et rejouée après la reconnexion du même utilisateur, jamais sous un autre compte.
- **Effacement par le navigateur** : Safari peut vider le stockage d'un site non installé que l'utilisateur n'a pas ouvert pendant 7 jours d'utilisation du navigateur ; l'application installée sur l'écran d'accueil n'est pas concernée. L'application demande `navigator.storage.persist()` et recommande l'installation (PWA) ; un élément jamais envoyé reste signalé.
- **Dates** : `performed_at` vient de l'appareil (heure de la visite), le serveur garde aussi l'heure de réception. Affichage en `Europe/Brussels` (`utils/format.ts`).

## Audit, conservation, vie privée

- Actions d'audit (`audit/actions.py` et `auditLabels.ts`) : `hive.create`, `hive.update`, `hive.move`, `hive.custody`, `hive.store`, `hive.delete`, `colony.create`, `colony.split`, `colony.transfer`, `colony.end`, `visit.plan`, `visit.create`, `visit.update`, `visit.delete`, `visit.photo_add`, `visit.photo_delete`. `refs` : `hive:<id>`, `colony:<id>`, `visit:<id>`, `apiary:<id>`, `user:<guid>`. Les noms en texte libre (participants sans compte, hébergeur) n'entrent jamais dans un événement. Une opération rejouée depuis la file est auditée à sa réception, avec sa date d'exécution dans `changes`.
- **Conservation** : pas de purge à 5 ans comme pour les observations de frelons (`retention.py`) ; l'historique d'une colonie a de la valeur sur la durée. Une ruche réformée et ses données sont supprimées par son propriétaire, pas par le temps.
- **Politique de confidentialité** : le cache IndexedDB et la file d'envoi s'ajoutent à l'article 9 de `PrivacyPolicy.tsx` (stockage strictement nécessaire au fonctionnement demandé). Les données de terrain restent sur l'appareil jusqu'à leur envoi ; une déconnexion volontaire propose de les envoyer ou de les effacer.

## Étapes

Chaque étape est livrable seule, avec ses tests, son audit, son aide (section `apiaries#hives` de `help/ApiariesDoc.tsx` tant que le module reste celui des ruchers) et un passage de `./ui-shots.sh`.

| # | Étape | Contenu |
|---|---|---|
| 1 ✅ | Ruches | `HiveType` (référentiel et administration), `Hive`, emplacements et responsables datés, hébergeur du rucher, liste des ruches par rucher, fiche ruche. Reportés : photo de ruche (la vue des médias résout les droits par chemin, à étendre au module), changement de propriétaire d'une ruche |
| 2 | Colonies | occupation par compartiment, cloison, événements (division, essaimage, transfert, fin), généalogie |
| 3 | Socle hors ligne | cache de lecture, file d'envoi, photos en attente, indicateur, persistance du stockage |
| 4 | Journal de visites | visite d'un rucher, inspections par colonie, participants, photos, reprise de configuration, le tout par la file d'envoi |
| 5 | Planification | visites prévues, agenda, rappels push (planificateur), compteur « À faire » dans `pending.py` ; en option un flux iCal |
| 6 | Vues par type de ruche | barrettes d'une TBH, Chandler ou nucleus (cloison, deux colonies), éléments d'une Warré |

Le journal (4) précède la planification (5) : dans Glide, 438 visites sur 449 sont des visites faites, 8 seulement des visites prévues non faites. Le socle hors ligne (3) précède le journal pour que la saisie de terrain soit pensée hors ligne dès sa première version ; les étapes 1 et 2 utilisent déjà des UUID et des créations idempotentes.

## Reprise Glide (projet séparé)

Hors de ce module ; ce qu'il en retient pour la conception :

- les visites Glide référencent une ruche **par son nom** : 11 anciens noms ne correspondent plus à aucune ruche (environ 80 % des visites). La reprise passera par une table de correspondance validée à la main, et s'appuiera sur `external_ref` ;
- ni rucher ni colonie dans Glide : ruchers à créer (position), colonies à reconstituer ou à démarrer à la date de bascule ;
- dates de début en `JJ/MM/AAAA hh:mm` heure locale, dates de fin en ISO UTC et peu fiables ;
- photos : stockage Glide (téléchargeable), Google Drive (accès du compte nécessaire), iCloud (perdues) ;
- l'export contient des noms et des adresses : il ne va jamais dans le dépôt.

## Reste à fournir

- Avec une cloison, celle-ci occupe-t-elle une position de barrette (deux colonies : 23 barrettes au plus à elles deux) ? Hypothèse retenue : oui, `divider_bar` est la position de la cloison, le compartiment 1 en deçà, le compartiment 2 au-delà.
