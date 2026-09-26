# Module Statistiques : analyse et proposition

Statut : **proposition**, rien n'est implémenté. Ce document fixe le périmètre,
les définitions des indicateurs, l'architecture et un découpage en phases.

## 1. Ce que les données permettent aujourd'hui

| Source | Champs utiles | Limite pour les statistiques |
|---|---|---|
| `TrapEvent` (`kind='catch'`) | `performed_at`, `species`, `quantity`, `batch`, `trap` | Pas de relevé à zéro possible : le formulaire refuse une capture sans espèce (`TrapEventModal` : « Indiquez au moins une capture ») et la contrainte `trapevent_catch_fields` impose `quantity >= 1`. |
| `TrapEvent` (autres `kind`) | `installation`, `removal`, `inspection`, `cleaning`, `refill`, `repair` | Permettent de reconstituer les périodes d'activité d'un piège et les visites sans capture, **si** les bénévoles les saisissent. |
| `Trap` | `trap_type`, `group`, `visibility`, `latitude/longitude`, `installed_at`, `active` | La position est **l'actuelle** : un piège déplacé emporte tout son historique à la nouvelle position (aucun événement de déplacement n'est journalisé). |
| `Apiary` | `infestation_level` (1 léger, 2 moyen, 3 élevé) | **Valeur courante uniquement**, aucun historique : pas de série temporelle possible. |
| `Nest`, `Hornet` | `created_at`, `destroyed_at`, `archived_at` | Utilisables tels quels (nids signalés/détruits par mois, délai de destruction). |

Conséquence principale : **le nombre de captures seul ne mesure pas la
pression du frelon**, il mesure surtout l'effort de piégeage (nombre de pièges,
fréquence des relevés). Un indicateur comparable dans le temps et l'espace
doit être rapporté à l'effort.

## 2. Définitions des indicateurs de piégeage

### 2.1 Relevé et exposition

- **Relevé** : une visite d'un piège, c'est-à-dire un lot de captures (`batch`)
  ou un événement `inspection`, `cleaning` ou `refill`. Les événements de même
  piège à moins de ~1 h d'intervalle sont fusionnés en un seul relevé.
- **Intervalle d'exposition** d'un relevé : de la visite précédente (ou de
  l'`installation`) jusqu'à ce relevé. Une période entre `removal` et
  `installation` n'est pas exposée.
- **Piège-jour** : unité d'effort. Un piège actif pendant 7 jours = 7 pièges-jours.

Les captures d'un relevé sont attribuées à son intervalle d'exposition. Pour
une granularité (jour, semaine ISO, mois), elles sont **réparties au prorata
des jours** de l'intervalle qui tombent dans chaque case. Exemple : 14 frelons
relevés après 14 jours, à cheval sur deux semaines à 10 j / 4 j, donnent 10 et 4.
C'est exact pour les totaux ; pour une case isolée, l'erreur est de l'ordre de
la variation réelle des captures au sein de l'intervalle, donc importante si la
granularité est plus fine que l'intervalle entre relevés. L'interface
déconseille une granularité plus fine que l'intervalle médian des relevés.

### 2.2 Indicateurs

| Indicateur | Formule | Incertitude affichée |
|---|---|---|
| Captures FA | Σ `quantity` pour `vespa-velutina` | aucune (comptage) |
| **CPUE** (captures par unité d'effort) | captures FA / pièges-jours, affiché par piège et par semaine (×7) | IC 95 % de Poisson exact. Ex. 20 frelons sur 70 pièges-jours : 0,29 /piège/jour, IC 0,17–0,44. En réalité les captures sont surdispersées (agrégation autour des nids) : l'IC de Poisson est une **borne basse** de l'incertitude. |
| **Sélectivité** (ratio FA / toutes espèces) | captures FA / captures toutes espèces | IC 95 % de Wilson. Ex. 12 FA sur 40 insectes : 30 %, IC 18–45 %. Masquée sous ~20 insectes. |
| Niveau d'infestation (ruchers) | répartition des ruchers par niveau 1/2/3 | instantané seulement (voir §5) |
| Pression locale | CPUE par maille de la grille (§4) | nombre de pièges et de pièges-jours de la maille affichés |

Sur le vocabulaire : le ratio FA/toutes espèces mesure la **sélectivité**
d'un piège (le peu de prises accessoires), pas son efficacité. L'efficacité
d'un type de piège est sa **CPUE**. Les deux sont utiles et se lisent ensemble :
un piège très sélectif mais qui ne prend presque rien n'est pas un bon piège.

La sélectivité suppose que les autres espèces sont **comptées de façon
exhaustive**. Si certains bénévoles ne saisissent que les frelons, le ratio est
biaisé vers 100 %. À trancher (§7) : consigne de protocole seule, ou case
« toutes les espèces comptées » par relevé, la sélectivité ne portant alors que
sur ces relevés.

## 3. Catalogue initial

Chaque statistique est une tuile de la liste (`.tile-grid`), puis une page
avec filtres, tableau, graphiques et exports.

| # | Statistique | Lignes du tableau | Filtres propres | Graphiques |
|---|---|---|---|---|
| T1 | Captures de frelons asiatiques | une par case de temps : captures, pièges actifs, pièges-jours, relevés, CPUE | granularité | barres (captures) + courbe (CPUE) ; superposition de l'année précédente |
| T2 | Captures par espèce | une par espèce : captures, part du total ; colonnes par case de temps | granularité, espèces | barres empilées 100 % par case de temps |
| T3 | Comparaison des types de piège | une par type : pièges, pièges-jours, FA, CPUE ± IC, sélectivité ± IC | — | points avec barres d'erreur (CPUE, sélectivité). Pas de barres pleines : la comparaison repose sur les IC. |
| T4 | Pièges les plus actifs | une par piège : adresse, type, relevés, FA, CPUE | tri, top N | barres horizontales |
| T5 | Carte de pression | une par maille : pièges, pièges-jours, FA, CPUE | taille de maille | carte choroplèthe (§4) |
| R1 | Infestation des ruchers | une par niveau : nombre de ruchers | — | barres ; carte des ruchers colorés par niveau |

Plus tard : nids signalés/détruits par mois et délai signalement → destruction,
observations de frelons, activité des bénévoles (relevés par personne : donnée
personnelle, réservée à l'admin et aux administrateurs de groupe).

### Filtres communs

- **Période** : 7 derniers jours, 30 derniers jours, mois en cours, depuis le
  1er janvier, saison (année choisie), dates libres. Option « comparer à la même
  période de l'année précédente », indispensable vu la saisonnalité du frelon
  (piégeage de printemps des fondatrices, pic d'août à octobre).
- **Granularité** : jour, semaine (ISO), mois. Fuseau `Europe/Brussels`.
- **Type de piège**, **groupe** (délégation), **mes pièges seulement**,
  **zone** : rayon autour d'un point (`lat`, `lon`, `radius`, comme
  `GeographicFilterMixin`), ou emprise de la carte pour T5.

Les paramètres vivent dans l'URL (`/stats/traps-catches?period=ytd&granularity=week&trap_type=…`) :
lien partageable, retour arrière cohérent, et même jeu de paramètres pour
l'API et les exports.

## 4. Carte de pression (heatmap)

Une heatmap classique (noyau de densité pondéré par les captures, type
`leaflet.heat`) **dessine surtout la densité des pièges** : une zone avec 20
pièges ressort même si chacun prend peu. Proposition : une **grille
choroplèthe de la CPUE**, calculée côté serveur.

- Maillage PostGIS `ST_SquareGrid` ou `ST_HexagonGrid` (PostGIS ≥ 3.1, l'image
  installe PostGIS 3). Maille par défaut **1 km**, réglable 500 m / 1 km / 2 km :
  du même ordre que le rayon de chasse d'un nid (quelques centaines de mètres
  à 1-2 km), et assez grossière pour ne pas désigner un piège.
- Couleur = CPUE de la maille ; mailles avec moins de ~14 pièges-jours
  hachurées (« données insuffisantes ») plutôt que colorées.
- Réponse GeoJSON limitée à l'emprise demandée (`bbox`).
- Intégration : une couche « Pression (captures/piège/semaine) » dans la
  feuille des couches de la carte, avec un sélecteur de période, et la même
  couche en vue « carte » de la statistique T5. Pas de 4e bouton flottant.
- Confidentialité : les pièges en visibilité `group` d'autres groupes ne sont
  jamais comptés pour un non-admin (§6). Si on décide plus tard de les agréger,
  masquer les mailles de moins de 3 pièges.

Limite connue : un piège déplacé est compté à sa position actuelle pour toute
son histoire (§1). Pour une carte juste sur plusieurs saisons, il faut soit
journaliser les déplacements (événement `relocation` avec l'ancienne position),
soit horodater la position sur chaque relevé.

## 5. Prérequis de données (phase 0)

1. **Relevé sans capture.** Dans la fenêtre de capture, un bouton « Rien
   capturé » enregistre un événement `inspection` (aucun changement de schéma).
   Sans lui, la CPUE est surestimée et la carte ignore les pièges vides.
   L'ordre de grandeur du biais est inconnu tant qu'on ne mesure pas la part
   de visites sans prise ; en fin de saison, elle peut dépasser la moitié.
2. **Historique de l'infestation des ruchers.** Table `ApiaryInfestationReading`
   (`apiary`, `level`, `observed_at`, `observed_by`), alimentée à chaque
   changement de niveau ; `Apiary.infestation_level` reste la dernière valeur.
   Sans elle, R1 reste un instantané.
3. **Déplacement d'un piège journalisé** (événement `relocation` portant
   l'ancienne position), pour T5 sur plusieurs saisons. Moins urgent.
4. Protocole de comptage des autres espèces (§2.2).

## 6. Accès

- Le module est réservé aux personnes connectées :
  `requiredRoles: ['admin', 'volunteer', 'beekeeper']` dans `config/modules.ts`
  (comme l'administration), l'API exige `HasAnyRole` sur ces trois rôles.
- **Les données comptées sont celles que la personne peut lire** : même règle
  que la liste des pièges (`TrapViewSet._readable_queryset` : publics, les
  siens, ceux de ses groupes ; tout pour l'admin). Le même écran donne donc des
  totaux différents selon la personne ; le pied de tableau l'indique (« 142
  pièges pris en compte »).
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
    filters = ('period', 'granularity', 'trap_type', 'group', 'mine', 'zone')
    charts = ({'type': 'bar+line', 'x': 'bucket', 'y': ['catches', 'cpue_week']},)

    def compute(self, request, params) -> Table: ...
```

`Table` = colonnes typées (libellé, unité, format), lignes, totaux, et
métadonnées (période résolue, nombre de pièges, filtres appliqués). Le même
objet alimente le JSON, l'XLSX et le PDF : un seul calcul, trois rendus.

| Endpoint | Rôle |
|---|---|
| `GET /api/stats/` | catalogue filtré par rôle, avec la description des filtres et graphiques de chaque stat |
| `GET /api/stats/<id>/?…` | table JSON |
| `POST /api/stats/<id>/export/` `{format, params}` | lien signé à courte durée pour le fichier (même mécanisme que `tags/sheet/<token>/` : un téléphone doit pouvoir passer l'URL à son lecteur PDF/tableur sans JWT) |
| `GET /api/stats/traps-pressure/grid/?bbox=…` | GeoJSON de la grille (T5) |

Calcul : SQL (ORM + une requête brute pour la répartition au prorata via
`generate_series`), à la volée. Ordre de grandeur, hypothèse haute de 500
pièges × 30 relevés × 3 espèces ≈ 45 000 événements par saison : une agrégation
PostgreSQL prend quelques dizaines de ms. Ni vue matérialisée ni cache au départ ;
à reconsidérer au-delà d'environ 10⁶ événements.

Exports :
- **XLSX** : `openpyxl` (nouvelle dépendance, pur Python). Une feuille
  « Données », une feuille « Paramètres » (période, filtres, date d'export,
  nombre de pièges), et le graphique en graphique Excel natif (`openpyxl.chart`).
- **PDF** : `reportlab`, déjà utilisé pour les planches de QR codes. Tableau +
  graphique via `reportlab.graphics.charts`, ce qui évite `matplotlib`
  (~ plusieurs dizaines de Mo dans l'image).
- **CSV** : gratuit, utile pour tout le reste.
- **Google Sheets** : voir ci-dessous.

### Export vers Google Sheets

| Option | Principe | Pour | Contre |
|---|---|---|---|
| A. Fichier XLSX ouvert dans Sheets | l'utilisateur importe le fichier | rien à développer | manuel, deux étapes sur téléphone |
| B. **Google Identity Services côté navigateur**, scope `drive.file` | le frontend obtient un jeton Google de courte durée, crée la feuille et y écrit la table (API Sheets) | instantané, la feuille appartient à l'utilisateur, le backend ne voit aucun jeton Google ; `drive.file` n'est pas un scope sensible (pas d'audit Google) | projet Google Cloud + client OAuth ; CSP à étendre (`script-src` et `frame-src accounts.google.com`, `connect-src sheets.googleapis.com`) ; fonctionne pour tout compte Google, indépendamment du fournisseur de connexion Keycloak |
| C. `=IMPORTDATA(url)` sur un CSV à lien secret | feuille « vivante », rafraîchie par Google | se met à jour seule | le lien est un secret porteur qui sort des règles d'accès (les pièges « groupe » fuient avec lui) ; révocation et expiration à gérer |

Recommandation : **B**, en phase 3. C seulement si un besoin réel de feuille
auto-actualisée apparaît, avec liens révocables et limités aux pièges publics.

### Frontend

- Module `stats` dans `config/modules.ts` (icône `bi-bar-chart-line`), routes
  `/stats` (catalogue) et `/stats/:statId` (détail), chargées en différé
  (`React.lazy`) pour ne pas alourdir le premier chargement de la PWA.
- Page de détail, en suivant les règles mobiles du projet :
  - filtres dans un `BottomSheet`, filtres actifs résumés en puces sous le
    titre (tap = rouvrir le sheet) ;
  - bascule segmentée **Tableau / Graphique / Carte** (carte pour T5 et R1) ;
  - tableau en liste sur téléphone (modèle `ReferentialTable`), pas de défilement
    horizontal ; pagination au-delà de ~50 lignes ;
  - exports en `IconButton` dans `.sheet-actions` (XLSX, PDF, CSV, Sheets) ;
  - explication de chaque indicateur (CPUE, sélectivité, IC) dans un `HelpTip`.
- Graphiques : **Chart.js** (`react-chartjs-2`), importé à la carte. Ordre de
  grandeur ~ 50-70 kB gzip, contre ~ 100 kB+ pour Recharts et ~ 150-300 kB pour
  ECharts. Couvre barres, courbes, empilés et barres d'erreur (plugin).
  Canvas : fluide sur téléphone, mais tester le rendu à 320 px et le contraste
  en mode sombre.
- Carte T5 : `GeoJSON` de react-leaflet sur la grille renvoyée par l'API, pas
  de nouvelle dépendance.

## 8. Découpage proposé

| Phase | Contenu | Taille estimée |
|---|---|---|
| 0 | « Rien capturé » ; historique d'infestation des ruchers (migration + note `doc/prod-migrations` si reprise de l'existant) | petite |
| 1 | Backend registre + T1, T3 en JSON ; frontend catalogue, page détail, filtres, tableau ; export CSV/XLSX | moyenne |
| 2 | Graphiques (Chart.js) ; PDF ; T2, T4, R1 ; comparaison à l'année précédente | moyenne |
| 3 | Carte de pression (T5) dans la statistique et dans les couches de la carte ; export Google Sheets (option B) | moyenne |
| 4 | Restrictions par statistique, stats nids/observations, journalisation des déplacements | à définir |

## 9. Questions ouvertes

1. Relevé sans capture : bouton « Rien capturé » (→ `inspection`) suffisant, ou
   un vrai lot de capture à zéro (lever la contrainte `quantity >= 1`) ?
2. Autres espèces : consigne seule, ou case « toutes les espèces comptées » ?
3. Les statistiques d'un non-admin portent-elles sur les pièges qu'il peut lire
   (proposé), ou sur l'ensemble agrégé et anonymisé (plus représentatif, mais
   règles d'agrégation minimale à définir) ?
4. Définition de la « saison » : année civile, ou bornes fixes (p. ex.
   printemps 1er février – 31 mai, été-automne 1er juin – 30 novembre) ?
5. Faut-il une granularité géographique administrative (commune) ? Il faudrait
   alors les limites communales (Statbel/IGN) en base, ce que la grille évite.
