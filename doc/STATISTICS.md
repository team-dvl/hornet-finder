# Module Statistiques : analyse et proposition

Statut : **proposition**. Seule la phase 0 (§5.1 à §5.3) est implémentée. Ce document fixe le périmètre,
les définitions des indicateurs, l'architecture et un découpage en phases.

## 1. Ce que les données permettent aujourd'hui

| Source | Champs utiles | Limite pour les statistiques |
|---|---|---|
| `TrapEvent` (`kind='catch'`) | `performed_at`, `species`, `quantity`, `batch`, `trap` | Pas de relevé à zéro possible : le formulaire refuse une capture vide (`TrapEventModal` : « Indiquez au moins une capture ») et la contrainte `trapevent_catch_fields` impose `quantity >= 1`. Rien ne dit non plus si les autres espèces ont été comptées. |
| `TrapEvent` (autres `kind`) | `installation`, `removal`, `cleaning`, `inspection`, `refill`, `repair` | Délimitent les périodes d'activité d'un piège (installation, retrait) et les vidages (nettoyage). |
| `Trap` | `trap_type`, `group`, `visibility`, `latitude/longitude`, `installed_at`, `active` | La position est **l'actuelle** : un piège déplacé emporte tout son historique à la nouvelle position (aucun déplacement n'est journalisé). |
| `Nest`, `Hornet` | `created_at`, `destroyed_at`, `archived_at` | Utilisables tels quels, plus tard (nids signalés/détruits par mois). |
| `Apiary` | `infestation_level` | Hors périmètre : niveau indicatif, souvent non renseigné (§5.3). |

Conséquence principale : **le nombre de captures seul ne mesure pas la
pression du frelon**, il mesure surtout l'effort de piégeage (nombre de pièges,
fréquence des relevés). Un indicateur comparable dans le temps et l'espace
doit être rapporté à l'effort.

## 2. Définitions des indicateurs de piégeage

### 2.1 Relevé et exposition

- **Relevé** : une visite où le contenu de la zone de capture est compté **et
  retiré**, c'est-à-dire les événements `catch` d'un même lot (`batch`), y
  compris un relevé **à zéro** (§5.1). Compter sans retirer ferait compter les
  mêmes insectes au relevé suivant : c'est une consigne, rappelée dans le
  dialogue.
- Les autres actions d'une visite (nettoyage, recharge, réparation) sont
  enregistrées dans le même lot que le relevé (§5.1), mais ne délimitent rien :
  un nettoyage ne vide pas forcément la zone de capture (p. ex. le bac inférieur
  d'un JadeProbe, séparé de la zone de prise).
- **Intervalle d'exposition** d'un relevé : depuis le relevé précédent ou
  l'`installation`, jusqu'à ce relevé. Une période entre `removal` et
  `installation` n'est pas exposée.
- **Piège-jour** : unité d'effort. Un piège actif pendant 7 jours = 7 pièges-jours.

Les captures d'un relevé sont attribuées à son intervalle d'exposition. Pour
une granularité (jour, semaine ISO, mois) ou une borne de saison, elles sont
**réparties au prorata des jours** de l'intervalle qui tombent de chaque côté.
Exemple : 14 frelons relevés le 22 juin après 14 jours (du 9 au 22 juin), soit
7 jours jusqu'au 15 juin et 7 jours à partir du 16, comptent pour 7 dans le
printemps et 7 dans l'été.
C'est exact pour les totaux ; pour une case isolée, l'erreur est de l'ordre de
la variation réelle des captures au sein de l'intervalle, donc importante si la
granularité est plus fine que l'intervalle entre relevés. L'interface
déconseille une granularité plus fine que l'intervalle médian des relevés.

Les données antérieures à la mise en service du relevé à zéro (§5.1) n'ont pas
de zéros : la CPUE calculée dessus est surestimée. Les statistiques affichent
un avertissement quand la période demandée déborde avant cette date.

### 2.2 Indicateurs

| Indicateur | Formule | Incertitude affichée |
|---|---|---|
| Captures FA | Σ `quantity` pour `vespa-velutina` | aucune (comptage) |
| **CPUE** (captures par unité d'effort) | captures FA / pièges-jours, affichée par piège et par semaine (×7) | IC 95 % de Poisson exact. Ex. 20 frelons sur 70 pièges-jours : 0,29 /piège/jour, IC 0,17–0,44. Les captures sont surdispersées (agrégation autour des nids) : l'IC de Poisson est une **borne basse** de l'incertitude. |
| **Sélectivité** (ratio FA / toutes espèces) | captures FA / captures toutes espèces, **sur les seuls relevés où les autres espèces ont été comptées** (§5.2) | IC 95 % de Wilson. Ex. 12 FA sur 40 insectes : 30 %, IC 18–45 %. Masquée sous ~20 insectes. |
| **Couverture** | part de la zone à moins de *r* mètres d'un piège actif pendant la période (§4) | *r* est une hypothèse de travail, affichée à côté du résultat |
| **Pression locale** | CPUE lissée dans l'espace (§4) | effort local affiché ; zones à trop faible effort masquées |

Sur le vocabulaire : le ratio FA/toutes espèces mesure la **sélectivité**
d'un piège (le peu de prises accessoires), pas son efficacité. L'efficacité
d'un type de piège est sa **CPUE**. Les deux se lisent ensemble : un piège très
sélectif mais qui ne prend presque rien n'est pas un bon piège.

## 3. Catalogue initial

Chaque statistique est une tuile de la liste (`.tile-grid`), puis une page
avec filtres, tableau, graphiques et exports.

| # | Statistique | Lignes du tableau | Filtres propres | Graphiques |
|---|---|---|---|---|
| T1 | Captures de frelons asiatiques | une par case de temps : captures, pièges actifs, pièges-jours, relevés, CPUE | granularité | barres (captures) + courbe (CPUE) ; superposition de la même saison de l'année précédente |
| T2 | Captures par espèce | une par espèce : captures, part du total ; colonnes par case de temps | granularité, espèces | barres empilées 100 % par case de temps |
| T3 | Comparaison des types de piège | une par type : pièges, pièges-jours, FA, CPUE ± IC, sélectivité ± IC | — | points avec barres d'erreur (CPUE, sélectivité). Pas de barres pleines : la comparaison repose sur les IC. |
| T4 | Pièges les plus actifs | une par piège : adresse, type, relevés, FA, CPUE | tri, top N | barres horizontales |
| T5 | Couverture du territoire | zone : surface, surface couverte, %, pièges actifs, densité (pièges/km²) | rayon *r*, taille de maille | carte des mailles couvertes / non couvertes (§4) |
| T6 | Carte de pression | une par maille non vide : pièges-jours, FA, CPUE lissée | taille de maille, lissage | carte de chaleur normalisée par l'effort (§4) |

Pas de statistique sur l'infestation des ruchers (§5.3). Plus tard : nids
signalés/détruits par mois, observations de frelons, activité des bénévoles
(relevés par personne : donnée personnelle, réservée à l'admin et aux
administrateurs de groupe). Pas de regroupement par commune à ce stade.

### Filtres communs

- **Période** : 7 derniers jours, 30 derniers jours, mois en cours, **saison**
  (année au choix), **année**, dates libres. Option « comparer à la même période
  de l'année précédente », indispensable vu la saisonnalité.
- **Année** : l'année du cycle de vie du frelon, assimilée à l'année civile
  (1er janvier – 31 décembre) ; l'année en cours s'arrête à aujourd'hui, ce qui
  remplace le préréglage « depuis le 1er janvier ».
- **Saisons** (bornes incluses, fuseau `Europe/Brussels`) :

  | Saison | Début | Fin | Objet |
  |---|---|---|---|
  | Printemps | 1er février | 15 juin | surtout des fondatrices (gynes) |
  | Été | 16 juin | 30 septembre | |
  | Été-automne-hiver | 16 juin | 31 décembre | |

  Le printemps et l'été se suivent sans se chevaucher. L'été-automne-hiver
  englobe l'été (même début, par cohérence) : c'est un autre préréglage, pas une
  saison de plus à additionner. Janvier n'est dans aucune saison.
- **Vocabulaire** : l'interface parle de « frelons » (FA, frelon asiatique),
  quelle que soit la saison. Les prises de printemps sont très probablement des
  fondatrices, celles des autres saisons un mélange de castes que le relevé ne
  distingue pas : aucun écran ne parle de gynes.
- **Granularité** : jour, semaine (ISO), mois.
- **Type de piège**, **groupe** (délégation, limité aux groupes de la personne),
  **mes pièges seulement**, **zone** : cercle autour d'un point (`lat`, `lon`,
  `radius`, comme `GeographicFilterMixin`), ou emprise de la carte pour T5 et T6.

Les paramètres vivent dans l'URL (`/stats/traps-catches?season=spring&year=2026&granularity=week&trap_type=…`) :
lien partageable, retour arrière cohérent, et même jeu de paramètres pour
l'API et les exports.

## 4. Couverture et carte de pression (piégeage de printemps)

Le but est de voir, au printemps, **quelle part du territoire est couverte par
des pièges** et où les frelons sont pris. Il faut pour cela une résolution de
l'ordre de la centaine de mètres, pas du kilomètre : maille de **250 m** pour
commencer (1 600 mailles pour une emprise de 10 × 10 km).

### 4.1 Couverture (T5)

- Chaque piège actif pendant la période couvre un disque de rayon *r*.
  Couverture = surface de l'union des disques ∩ zone / surface de la zone
  (PostGIS : `ST_Buffer` en projection métrique, `ST_Union`, `ST_Area`).
- *r* est un paramètre (100 / 250 / 500 m, défaut **250 m**). Le rayon
  d'attraction réel d'un piège appâté n'est pas bien établi et dépend de l'appât
  et du vent : *r* est une **hypothèse de travail**, rappelée sur la page et dans
  les exports, pas une mesure.
- Zone = le filtre de zone (cercle) ; sans filtre, l'emprise de la carte.
  Sans limites communales, c'est le seul dénominateur disponible.
- Affichage : grille de mailles carrées de 250 m (`ST_SquareGrid`, PostGIS ≥
  3.1 ; l'image installe PostGIS 3) ; une maille est couverte si son centre est
  à moins de *r* d'un piège. Avec *r* = 250 m et des mailles de 250 m, le dessin
  en escalier s'écarte du disque d'environ une demi-maille (~125 m) sur son
  pourtour : le pourcentage affiché vient du calcul exact sur les disques, la
  grille ne sert qu'au dessin. Une maille plus fine (100 m) pourra être proposée
  si le rendu est trop grossier.

### 4.2 Carte de pression (T6)

Une heatmap classique (noyau de densité pondéré par les captures, type
`leaflet.heat`) **dessine surtout la densité des pièges** : une zone avec 20
pièges ressort même si chacun prend peu. Proposition : une **CPUE lissée**,
rapport de deux densités à noyau calculées au centre de chaque maille :

  pression(x) = Σ w(d) · captures FA / Σ w(d) · pièges-jours,

où w est un noyau gaussien de largeur *h* (défaut 250 m, réglable) et d la
distance maille–piège. Là où Σ w · pièges-jours est trop faible (moins de
l'équivalent de ~7 pièges-jours), la maille reste transparente : pas de
couleur sans effort de piégeage. Une maille isolée affiche au survol ses
pièges-jours et ses captures, pour que la couleur ne se lise pas sans son
effectif.

Ordres de grandeur du rendu : une emprise de 10 × 10 km fait 1 600 mailles de
250 m (10 000 à 100 m) ; seules les mailles couvertes (T5) ou à effort suffisant
(T6) sont renvoyées, en GeoJSON limité à l'emprise (`bbox`). Au-delà d'environ
20 000 mailles, l'API refuse et la carte invite à zoomer ou à grossir la maille.

Intégration : une couche « Couverture » et une couche « Pression » dans la
feuille des couches de la carte, avec un sélecteur de période (saison de
printemps par défaut), et les mêmes couches en vue « carte » de T5 et T6. Pas
de 4e bouton flottant.

### 4.3 Limites

- Un piège déplacé est compté à sa position actuelle pour toute son histoire
  (§1). Pour des cartes justes sur plusieurs saisons, journaliser les
  déplacements (événement `relocation` portant l'ancienne position).
- À 250 m, une maille désigne pratiquement un piège : voir §6 pour la
  confidentialité.

## 5. Prérequis de données (phase 0)

### 5.1 Relevé, y compris à zéro, et visite

- L'action « Capture » devient **« Relevé »** (libellé, journal). En base, le
  `kind` reste `catch` : pas de migration des données, seul le libellé change.
- Le dialogue de relevé est celui de **la visite** : on compte, puis on coche
  les autres actions faites sur place (nettoyage, recharge, réparation ; p. ex.
  pour une harpe : compter, retirer les insectes du bac, changer la batterie).
  Chaque action reste un événement du journal (même `performed_at`, même
  `batch` que le relevé), enregistré dans la même requête ; le journal affiche
  la visite en une seule entrée, supprimée d'un bloc. Le dialogue d'une action
  seule (sans relevé) reste disponible.
- La carte du frelon asiatique démarre à **0** (aujourd'hui à 1 : une saisie
  distraite enregistre un frelon) et est **toujours enregistrée**, même à 0 :
  un relevé sans prise produit un événement `vespa-velutina`, `quantity = 0`.
  La contrainte passe à `quantity >= 0` ; le serializer n'accepte 0 que pour le
  frelon asiatique, les autres espèces à 0 restant simplement non enregistrées.
- Le journal affiche « Relevé : aucune capture ». `hornet_catch_count` n'est
  pas affecté (somme inchangée).

### 5.2 Autres espèces comptées

Proposition : pas de case à cocher permanente (facile à ignorer, et un clic de
plus à chaque relevé), mais une **question au moment d'enregistrer, seulement
quand le relevé ne contient que le frelon asiatique** (y compris à 0), c'est-à-
dire exactement le cas où l'oubli biaise la sélectivité.

- Un `BottomSheet` remplace le dialogue de relevé (une seule fenêtre à la fois) :
  « Et les autres insectes ? », avec l'explication dans un `HelpTip` (la part
  des autres espèces mesure la sélectivité du piège, qui sert à comparer les
  modèles et à limiter l'impact sur les autres insectes).
- Trois choix : **Aucun autre insecte** (enregistre, comptage complet) ;
  **Présents, non comptés** (enregistre, comptage incomplet) ; **Les compter**
  (revient au relevé).
- Stockage : `TrapEvent.bycatch_counted` (booléen nullable), identique sur tous
  les événements d'un lot. `true` quand d'autres espèces sont saisies ou « Aucun
  autre insecte » ; `false` pour « Présents, non comptés » ; `NULL` pour les
  relevés antérieurs (inconnu). La sélectivité ne porte que sur `true`.
- Limite : quand d'autres espèces sont saisies, on suppose qu'elles l'ont été
  toutes ; un comptage partiel reste indétectable.

### 5.3 Niveau d'infestation des ruchers (hors module)

Indicatif et souvent non renseigné : `Apiary.infestation_level` devient
**nullable**, avec un choix « Non évalué » dans `InfestationLevelInput` (valeur
par défaut d'un nouveau rucher, placé après les trois niveaux pour passer à la
ligne sur un téléphone étroit), un marqueur gris sur la carte, pas de badge
dans les listes et un filtre « Infestation non évaluée » dans le gestionnaire. Les ruchers existants gardent leur valeur (impossible de
distinguer une valeur choisie d'une valeur imposée par l'ancien formulaire).
Aucune statistique dessus.

### 5.4 Plus tard

Journalisation des déplacements de pièges (§4.3).

## 6. Accès et confidentialité

- Le module est réservé aux personnes connectées :
  `requiredRoles: ['admin', 'volunteer', 'beekeeper']` dans `config/modules.ts`
  (comme l'administration) ; l'API exige `HasAnyRole` sur ces trois rôles.
- Un piège est souvent posé au rucher : sa position révèle celle du rucher, que
  le module ruchers réserve aux apiculteurs. D'où deux régimes, selon que le
  résultat est **localisé** ou non :

  | Résultat | Pièges comptés pour un non-admin |
  |---|---|
  | Totaux sans localisation (T1, T2, T3, sans filtre de zone) | **tous** les pièges, y compris les pièges « groupe » des autres |
  | Tout ce qui localise : filtre de zone, T4 (adresses), T5, T6, couches de la carte | seulement les pièges **lisibles** par la personne (publics, les siens, ceux de ses groupes), comme la liste des pièges (`TrapViewSet._readable_queryset`) |

  Le second régime ne montre rien que la carte des pièges ne montre déjà. Il
  exclut donc aussi les pièges des autres dont le type est lié au rucher
  (`TrapType.apiary_bound`, p. ex. la harpe électrique) : `_readable_queryset`
  ne les rend jamais publics.
- Le filtre de zone bascule dans le régime restreint parce qu'un total global
  sur un petit cercle révélerait l'existence d'un piège privé (il suffit de
  comparer un total avec et sans le cercle). Pour la même raison, le filtre
  groupe ne propose que les groupes de la personne.
- Le pied de chaque tableau et de chaque carte indique le périmètre (« tous
  les pièges : 142 » ou « pièges visibles par vous : 87 ») : deux écrans peuvent
  donc donner des totaux différents, et cela doit se voir.
- L'admin voit tout, partout.
- Chaque statistique déclare ses rôles requis (`required_roles`) dans un
  registre côté serveur ; le catalogue renvoyé au frontend est filtré. Les
  restrictions futures se font là, pas dans le frontend seul.

## 7. Architecture

### Backend

Nouvelle app Django `stats` (ou paquet `hornet/stats/`), organisée en registre :

```python
class Statistic:
    id = 'traps-catches'
    title = 'Captures de frelons asiatiques'
    required_roles = ('admin', 'volunteer', 'beekeeper')
    localized = False  # True: only traps readable by the requester (see §6)
    filters = ('period', 'granularity', 'trap_type', 'group', 'mine', 'zone')
    charts = ({'type': 'bar+line', 'x': 'bucket', 'y': ['catches', 'cpue_week']},)

    def compute(self, request, params) -> Table: ...
```

`Table` = colonnes typées (libellé, unité, format), lignes, totaux, et
métadonnées (période résolue, périmètre de pièges, filtres appliqués). Le même
objet alimente le JSON, l'XLSX et le PDF : un seul calcul, trois rendus.

| Endpoint | Rôle |
|---|---|
| `GET /api/stats/` | catalogue filtré par rôle, avec la description des filtres et graphiques de chaque stat |
| `GET /api/stats/<id>/?…` | table JSON |
| `POST /api/stats/<id>/export/` `{format, params}` | lien signé à courte durée pour le fichier (même mécanisme que `tags/sheet/<token>/` : un téléphone doit pouvoir passer l'URL à son lecteur PDF/tableur sans JWT) |
| `GET /api/stats/traps-coverage/grid/?bbox=…` | GeoJSON des mailles couvertes (T5) |
| `GET /api/stats/traps-pressure/grid/?bbox=…` | GeoJSON des mailles de pression (T6) |

Calcul : SQL (ORM + requêtes brutes pour la répartition au prorata via
`generate_series` et pour la grille), à la volée. Ordre de grandeur, hypothèse
haute de 500 pièges × 30 relevés × 3 espèces ≈ 45 000 événements par saison :
une agrégation PostgreSQL prend quelques dizaines de ms. La grille de pression
est le calcul le plus lourd (mailles × pièges à moins de ~3 *h*) : quelques
millions de paires au pire pour 10 000 mailles, soit de l'ordre de la
centaine de ms à la seconde, à mesurer. Ni vue matérialisée ni cache au départ.

Exports :
- **XLSX** : `openpyxl` (nouvelle dépendance, pur Python). Une feuille
  « Données », une feuille « Paramètres » (période, filtres, périmètre, *r*,
  date d'export), et le graphique en graphique Excel natif (`openpyxl.chart`).
- **PDF** : `reportlab`, déjà utilisé pour les planches de QR codes. Tableau +
  graphique via `reportlab.graphics.charts`, ce qui évite `matplotlib`
  (plusieurs dizaines de Mo dans l'image).
- **CSV** : gratuit, utile pour tout le reste.
- **Lien par email** : voir ci-dessous.

### Envoi d'un lien par email

Depuis le panneau d'export, « Envoyer un lien par email » enregistre une
**demande d'export** et envoie à la personne connectée un email contenant un
lien. Ce lien ouvre une page qui produit la donnée à la demande, en Excel, PDF
ou CSV. Usage visé : relancer l'export plus tard sur un ordinateur, sans se
reconnecter.

Déroulement :
1. `POST /api/stats/<id>/email-link/` `{params}` (JWT). Le serveur résout la
   période en dates absolues (« 30 derniers jours » devient « du 28 août au
   27 septembre ») pour que le lien donne les mêmes bornes qu'à l'écran, crée
   un `StatExportJob` et envoie l'email. Réponse `202` avec l'échéance et
   l'adresse masquée (« e•••@gmail.com »), que l'interface affiche.
2. L'email (expéditeur `DEFAULT_FROM_EMAIL`, en dev capté par Mailpit) nomme
   la statistique, la période, les filtres et l'heure d'échéance, et porte un
   lien `https://<hôte>/export/<token>`.
3. `GET /export/<token>` (page du frontend, sans connexion) appelle
   `GET /api/stats/exports/<token>/` : description de l'export et échéance,
   **sans rien calculer**. Les antivirus de messagerie ouvrent souvent les
   liens d'un email avant la personne ; ils ne doivent ni consommer le lien ni
   déclencher le calcul.
4. Un bouton par format appelle `GET /api/stats/exports/<token>/<format>/`, qui
   calcule la table et renvoie le fichier.

`StatExportJob` : `id`, `token_hash` (SHA-256 du jeton, le jeton lui-même
n'est jamais stocké), `user` (FK), `statistic`, `params` (JSON, période
résolue), `scope` (JSON : rôles et chemins de groupes du JWT au moment de la
demande), `created_at`, `expires_at`, `downloads`.

Règles :
- **Jeton** : 32 octets aléatoires (`secrets.token_urlsafe(32)`, 256 bits),
  unique par demande. Valable **1 heure au plus** à compter de la demande,
  refusé ensuite (`410`). Utilisable plusieurs fois dans l'heure, dans la
  limite de 10 téléchargements, pour qu'un aperçu de messagerie ou un second
  format ne le brûle pas.
- **Droits** : le calcul se fait avec le périmètre figé dans `scope`, jamais
  avec les droits de celui qui ouvre le lien (il n'est pas connecté). Un lien
  transféré donne donc, pendant l'heure, exactement ce que le demandeur
  voyait : le lien est un secret au porteur, ce que dit l'email.
- **Adresse** : lue dans le claim `email` du JWT au moment de la demande,
  utilisée pour l'envoi puis oubliée, jamais stockée (l'application ne garde
  aucune adresse). Sans claim `email`, l'option est masquée.
- **Données** : calculées à l'ouverture du lien, pas à la demande ; la date de
  calcul figure dans la feuille « Paramètres » et en pied du PDF. Les bornes
  de période étant figées, seuls des relevés saisis entre-temps peuvent
  changer les chiffres.
- **Abus** : au plus 5 demandes par personne et par heure (`429` au-delà).
  Les demandes expirées sont purgées à chaque nouvelle demande ; pas de tâche
  planifiée à ajouter.
- **Pas de file d'attente** : aux volumes du §7 (quelques dizaines de ms pour
  une table, moins d'une seconde pour un XLSX ou un PDF), le « job » est une
  demande enregistrée exécutée à l'ouverture du lien. Une file (Celery ou
  équivalent) ne se justifierait que pour des exports de plusieurs dizaines de
  secondes.

### Frontend

- Module `stats` dans `config/modules.ts` (icône `bi-bar-chart-line`), routes
  `/stats` (catalogue) et `/stats/:statId` (détail), chargées en différé
  (`React.lazy`) pour ne pas alourdir le premier chargement de la PWA.
- Page de détail, en suivant les règles mobiles du projet :
  - filtres dans un `BottomSheet`, filtres actifs résumés en puces sous le
    titre (tap = rouvrir le sheet) ;
  - bascule segmentée **Tableau / Graphique / Carte** (carte pour T5 et T6) ;
  - tableau en liste sur téléphone (modèle `ReferentialTable`), pas de défilement
    horizontal ; pagination au-delà de ~50 lignes ;
  - un `IconButton` « Exporter » qui ouvre un `BottomSheet` : Excel, PDF, CSV
    (téléchargement immédiat) et « Envoyer un lien par email » ;
  - explication de chaque indicateur (CPUE, sélectivité, couverture, IC) dans
    un `HelpTip`.
- Graphiques : **Chart.js** (`react-chartjs-2`), importé à la carte. Ordre de
  grandeur ~ 50-70 kB gzip, contre ~ 100 kB+ pour Recharts et ~ 150-300 kB pour
  ECharts. Couvre barres, courbes, empilés et barres d'erreur (plugin).
- Cartes T5/T6 : `GeoJSON` de react-leaflet sur la grille renvoyée par l'API,
  pas de nouvelle dépendance.

## 8. Découpage proposé

| Phase | Contenu | Taille estimée |
|---|---|---|
| 0 | Relevé (renommage, zéro, question sur les autres espèces, `bycatch_counted`) et visite (actions cochées dans le même dialogue) | fait |
| 0 bis | Infestation des ruchers nullable (hors module) | fait |
| 1 | Backend registre + T1, T3 en JSON, double régime d'accès ; frontend catalogue, page détail, filtres (dont saisons), tableau ; export CSV/XLSX | moyenne |
| 2 | Couverture (T5) et pression (T6), en statistique et en couches de la carte | moyenne |
| 3 | Graphiques (Chart.js) ; PDF ; T2, T4 ; comparaison à l'année précédente ; envoi d'un lien d'export par email | moyenne |
| 4 | Restrictions par statistique, stats nids/observations, journalisation des déplacements | à définir |

La couverture passe en phase 2 (avant les graphiques) pour être prête pour la
saison de printemps, qui commence le 1er février.

## 9. Décisions et questions ouvertes

Décidé :
- l'été et l'été-automne-hiver commencent le 16 juin ;
- un nettoyage ne vide pas forcément la zone de capture : seuls les relevés
  délimitent l'exposition, les actions d'une visite se cochent dans le dialogue
  du relevé ;
- maille de 250 m pour commencer ;
- double régime d'accès (§6).

Ouvert :
1. Rayon de couverture *r* par défaut (250 m proposé) : y a-t-il une valeur de
   référence utilisée par les associations (p. ex. une densité recommandée de
   pièges par km² au printemps) ? À surface égale, une densité de *n*
   pièges/km² correspond à un rayon de ~ 1000 / √(π·*n*) m, soit ~ 560 m pour
   1 piège/km² et ~ 250 m pour 5 pièges/km².
