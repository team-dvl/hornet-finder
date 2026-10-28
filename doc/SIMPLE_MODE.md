# Mode simple : proposition pour les piégeurs occasionnels

Statut : **proposition** (aucun code), décisions du développeur en section 9 ; maquettes : `doc/mockups/simple-mode.html`. Objectif de la campagne de piégeage : que l'application devienne l'outil
habituel de **déclaration des captures**. Le public visé est le piégeur occasionnel (rôle `trapper`, rôle par défaut
d'un nouveau compte), qui ouvre l'application quelques minutes par semaine, souvent depuis un téléphone, parfois
devant le piège.

## 1. Constat sur l'interface actuelle

Pour un compte qui n'a que le rôle `trapper`, `visibleModules` (`config/modules.ts`) affiche sur l'accueil :
Carte, Nids, Pièges, Statistiques, Administration, Notifications, Mon compte, soit **7 tuiles pour 3 usages réels**.

| Besoin du piégeur | Où c'est aujourd'hui | Friction |
|---|---|---|
| Relever / entretenir | Pièges → onglet « À relever » (`DueList`), bouton « Relever » ou « Recharger » | Bien placé, mais 2 niveaux avant d'y arriver (accueil → tuile → onglet par défaut) |
| Ajouter un piège | Pièges → onglet « Gérer » → « Ajouter » (position, adresse), ou la carte | Caché derrière l'onglet de gestion ; filtres, tri, étendues (`mine`, `delegated`) inutiles pour qui a 1 à 3 pièges |
| Notifications | Module Notifications : 7 types, dont 4 qui ne le concernent pas toujours | `KINDS` est filtré par `concerns`, mais la page reste un écran de réglages complet |
| Statistiques | Statistiques → 6 tuiles (captures, espèces, types, classement, couverture, pression) | Seules *captures* et *couverture* parlent à un débutant ; les autres exigent de comprendre CPUE, pièges-jours, sélectivité |
| Onboarding | Aucun écran dédié. `PushPromptSheet` demande les notifications après un délai | Rien n'explique le geste de base (installer, relever, ajouter) |

Le tronc commun existe déjà et est de bonne qualité : `DueList`, `TrapEventModal`, `TrapFormModal`, les compteurs
`pending`, les rappels. **Le travail est surtout de l'organisation, pas de nouvelles fonctions.**

## 2. Principes

1. **Une seule question par écran** : « qu'est-ce que je dois faire ? » (accueil), « où sont mes pièges ? » (liste),
   « où en est-on ? » (stats).
2. **Le geste principal en un tap** : l'accueil du mode simple *est* la liste « À relever », pas un menu vers elle.
3. **Réutiliser, ne pas dupliquer** : le mode simple est une *autre enveloppe* (navigation, accueil, réglages) autour
   des mêmes composants et des mêmes routes. Aucun endpoint ni modèle de capture nouveau.
4. **Réversible partout** : un lien « Interface complète » dans le mode simple, et « Interface simplifiée » dans la
   complète. Rien n'est perdu ni masqué côté données ; seules les entrées de navigation changent.
5. **Les URL restent valides** : `/tag/<valeur>`, `/scan`, `/traps/due?trap=<id>` (notifications, QR codes imprimés)
   fonctionnent dans les deux modes.

## 3. Bascule entre les deux interfaces

- **Valeur** : `simple` ou `full`, **par défaut `simple` pour un compte dont l'unique rôle applicatif est `trapper`**,
  `full` dès qu'il porte un autre rôle (`admin`, `beekeeper`, `hunter`). Le choix explicite de la personne l'emporte
  toujours sur le défaut.
- **Où la garder.** Deux options :
  - *`localStorage` (recommandé pour la v1)* : comme `utils/theme.ts` ; aucune migration, aucune note de migration
    prod, aucun audit (réglage d'affichage, pas une action métier). Défaut : le choix ne suit pas la personne d'un
    appareil à l'autre, ce qui est acceptable puisque le défaut par rôle redonne le bon mode sur un appareil neuf.
  - *Champ sur `User`* (comme `notification_prefs`) : suit la personne, mais exige une migration, un endpoint, la
    déclaration dans `audit.tests.CoverageTests` et une note `doc/prod-migrations/`. À envisager si des retours de
    terrain montrent des allers-retours entre appareils.
- **Interrupteur** : une ligne dans le panneau « Apparence » (`ThemeSheet`, déjà dans le menu de la barre) et un lien
  discret en pied d'accueil. Pas de bouton dans la barre : elle doit rester sur une ligne.
- **Conséquence RGPD** : la clé `localStorage` s'ajoute à l'inventaire de l'article 9 de `pages/PrivacyPolicy.tsx` dans
  le même commit (préférence locale stricte, sans bandeau).

## 4. Le mode simple

### 4.1 Navigation : une barre de 3 onglets en bas (téléphone)

Au pouce, au lieu du menu déroulant de la barre du haut. Sur ordinateur, les mêmes 3 entrées dans la barre du haut.

| Onglet | Route | Contenu |
|---|---|---|
| **À faire** (accueil) | `/` | Liste « À relever » (`DueList`) + bouton principal **« Ajouter un piège »** ; pastille rouge = `pending.traps`, déjà calculée |
| **Mes pièges** | `/traps` | Liste des pièges du piégeur, **portée `mine` fixée**, sans filtres ni tri exposés ; tap = fiche, actions « Relever », « Recharger », « Remiser » |
| **Chiffres** | `/stats` | 2 cartes seulement (voir 4.4) |

Réglages (notifications, apparence, aide, compte, bascule d'interface) : **un seul bouton « profil »** en haut à
droite, ouvrant une `BottomSheet`. Ce sont des réglages de début de campagne, pas des actions hebdomadaires.

Non affichés en mode simple (accessibles en passant en interface complète) : Carte, Nids, Ruchers, Administration,
Statistiques détaillées. Le **signalement d'un nid** reste atteignable par un lien « Signaler un nid » dans la
feuille profil : tout rôle peut signaler un nid, et un piégeur est bien placé pour en voir un.

### 4.2 Relever en deux taps

Depuis « À faire » : tap sur **Relever** → `TrapEventModal` en mode `catch`, déjà utilisé. À vérifier en phase 1 :
- le cas le plus fréquent, **« rien dans le piège »**, doit être un seul bouton (le relevé à zéro existe, cf.
  `STATISTICS.md` §5.1) ; c'est le geste qui fait défaut aux statistiques si les gens ne déclarent que les prises ;
- les questions annexes (`BycatchQuestionSheet`, `EmptiedQuestionSheet`) restent, mais dans cet ordre : nombre de
  frelons asiatiques d'abord, espèces accessoires ensuite, repliées par défaut.

C'est le seul endroit où le mode simple demande un vrai travail de conception, car c'est lui qui alimente le reporting.

### 4.3 Ajouter un piège

Bouton principal de l'accueil, ouvrant `TrapFormModal` précédé d'un choix de position en deux options
(« ma position » / « une adresse », déjà dans `AddressSearch` et `position.ts`). Champs en mode simple : **type**
(chips avec photo, les types ayant déjà `photo_thumbnail_url`) et **position**, c'est tout ; le reste (étiquette QR,
photo, délégation, propriétaire) se complète depuis la fiche. L'installation est enregistrée à la création, ce qui
déclenche les rappels sans autre geste.

### 4.4 Statistiques

Le brief retient **couverture** et **captures**. Elles existent déjà (`traps-coverage`, `traps-catches`). En mode simple :
- 2 tuiles, sans les autres statistiques ;
- filtres préréglés : la **saison en cours**, et une bascule « Mes pièges / Tous les pièges visibles » (paramètre
  `mine` déjà géré par `select_traps`) ;
- pas d'IC, de CPUE ni de granularité exposés ; un seul chiffre par carte (captures de frelons asiatiques ; part du
  territoire couverte) et le graphique ou la carte sous le chiffre. Les ordres de grandeur et l'incertitude restent
  visibles dans l'aide, pas dans la page.
- **Point de vigilance** : la couverture d'un piégeur seul est un petit chiffre peu parlant ; la valeur motivante est la
  couverture *de la communauté*. Ce qu'un piégeur sans groupe voit dépend de `select_traps` (« pièges visibles par
  vous ») : à vérifier avec des données réelles avant de fixer le libellé.

### 4.5 Notifications

Même page, même API (`fetchPreferences` / `savePreference`, `utils/pushApi.ts`), **vue réduite** en mode simple : l'interrupteur « Cet appareil », puis
les seuls types qui le concernent : *rappels de relevé*, *rappels d'attractif*, *messages de mon groupe*. Les messages de
plateforme sont conservés (consignes de campagne), les types de nids n'apparaissent pas (ils sont déjà masqués par
`concerns` quand ils ne s'appliquent pas).

Le mode simple doit rendre l'activation **visible plutôt qu'optionnelle** : la `PushPromptSheet` actuelle attend un
délai et propose « Ne plus demander ». Dans l'onboarding (4.6), l'activation devient l'étape 2, avec un état clair
(« Rappels activés sur ce téléphone »). Rappel important : sur iPhone elle n'est possible que depuis l'application
**ajoutée à l'écran d'accueil** (`doc/NOTIFICATIONS.md`), d'où l'étape 1.

### 4.6 Onboarding (très simple)

Une `BottomSheet` de 3 étapes à la première connexion du mode simple, rejouable depuis la feuille profil, sans écran
dédié, jamais bloquante (fermeture possible à tout moment, comme les autres feuilles) :
1. **Installer** l'application (`InstallSheet` existe) ;
2. **Activer les rappels** (`usePush().enable()`) ;
3. **Mon premier piège** : « Ajouter un piège » (4.3) ou « Je n'en ai pas encore ».

L'état « onboarding vu » suit la même règle de stockage que la bascule (section 3).

## 5. Architecture envisagée

- `utils/uiMode.ts` : lecture/écriture de la préférence + défaut par rôle, sur le modèle de `utils/theme.ts` (store
  minimal avec `subscribe`, utilisable par un hook `useUiMode()`).
- `config/modules.ts` : un champ `simple?: boolean` par module, ou une liste `SIMPLE_NAV` ; `visibleModules(roles, mode)`
  filtre. Le fil d'Ariane et le menu l'utilisent déjà via `visibleModules`.
- `components/layout/SimpleTabBar.tsx` (téléphone) et un rendu équivalent dans `NavbarComponent` ; montée par
  `PageLayout` selon le mode. `env(safe-area-inset-bottom)` et la place du bouton « + » de la carte sont à régler en
  même temps (règle « Map » du CLAUDE.md).
- `pages/Home.tsx` : en mode simple, rend l'écran « À faire » (réutilise `DueList`, qui vit aujourd'hui dans
  `Traps.tsx` avec son chargement `fetchDue` : à extraire dans un hook `useDue()` partagé).
- `pages/Notifications.tsx` : `KIND_INFO` filtré par le mode ; aucun changement d'API.
- `pages/stats/StatsIndex.tsx` : liste filtrée par le mode ; `StatDetail` ouvre avec des filtres préréglés
  (`period`, `mine`) via les paramètres d'adresse existants.
- `help/` : une section « Interface simplifiée » dans `TrapsDoc.tsx` (+ ancre dans `anchors.ts`), pas de nouvelle
  documentation.
- Backend : **rien** en v1. Pas de note de migration prod.

## 6. Découpage proposé

| Phase | Contenu | Valeur pour la campagne |
|---|---|---|
| 1 | `uiMode` + bascule + accueil « À faire » + barre à 3 onglets + feuille profil | L'essentiel du gain de simplicité |
| 2 | Relevé à zéro en un tap, ajout de piège à 2 champs | Alimente directement le reporting des captures |
| 3 | Statistiques simplifiées (2 cartes, saison, « mes pièges ») + notifications réduites | Retour d'information au piégeur |
| 4 | Onboarding en 3 étapes | Adoption, à caler sur la date de lancement |

Chaque phase est livrable seule. Hors code, à chaque phase : entrée `[Unreleased]` du `CHANGELOG.md`, vérification par
`./ui-shots.sh` sur WebKit **et** Chromium (le mode simple doit entrer dans les étapes de `ui-shots.sh`, qui parcourt
aujourd'hui l'interface complète), à 320 px aussi pour la barre du bas, et contrôle en thèmes clair et sombre.

## 7. Questions ouvertes (à trancher avant la phase 1)

1. **Qui bascule par défaut ?** Proposition : uniquement les comptes `trapper` seul. Un apiculteur qui piège aurait
   alors l'interface complète d'office ; à confirmer.
2. **Stockage de la préférence** : `localStorage` (v1) ou champ sur `User` (section 3).
3. **Nids** : le piégeur simple doit-il pouvoir signaler un nid depuis le mode simple (proposé : oui, via la feuille
   profil) ?
4. **Visibilité des statistiques** pour un piégeur sans groupe : voir 4.4, à mesurer sur les données de la saison passée.
5. **Rappels** : les délais viennent des types de piège (`reading_interval_days`, `refill_interval_days`). Si des types
   utilisés par les occasionnels n'en ont pas, leurs utilisateurs n'auront aucun rappel, quel que soit le mode : à
   vérifier dans *Administration → Types de pièges* avant la campagne.

## 8. Ce que cette proposition ne prétend pas

Aucune mesure d'usage n'a été faite : le constat de la section 1 vient de la lecture du code, pas d'observations de
piégeurs. Les gains attendus (moins de taps, meilleure adoption) sont des hypothèses ; un test avec 3 à 5 piégeurs
occasionnels sur la phase 1 donnera un ordre de grandeur plus fiable que n'importe quelle estimation ici.

## 9. Décisions du développeur (réponses à la section 7)

1. **Défaut** : mode simple exclusivement pour les comptes `trapper` seul ; tout autre compte démarre en interface complète.
2. **Stockage** : champ sur `User` (suit la personne d'un appareil à l'autre). Conséquences, qui remplacent le « rien côté
   backend » de la section 5 :
   - migration (`User.ui_mode`, valeurs `simple` / `full`, vide = défaut par rôle) et endpoint de lecture/écriture, sur le
     modèle de `notification_prefs` ;
   - `audit.tests.CoverageTests` : l'endpoint est à déclarer (skill `audited-endpoint`) ou à justifier comme réglage
     d'affichage non métier ;
   - note `doc/prod-migrations/NNNN-simple-mode.md` (skill `prod-migration-note`) : la migration Django passe par
     `./deploy.sh`, la note rappelle seulement de vérifier qu'elle s'est appliquée ;
   - côté page : le mode est lu au démarrage avec le profil ; pour éviter un flash de la mauvaise interface, le dernier mode
     connu est recopié en `localStorage` (cache, à inscrire à l'article 9 de la politique de confidentialité).
   - « Onboarding vu » suit le même chemin (second champ ou clé dans le même JSON).
3. **Signaler un nid** : oui, depuis le profil (maquette H).
4. **Pas d'historique** (saison de lancement) : les statistiques sont vides au début. Maquette F : état vide qui dit ce qui va
   apparaître. Le seuil « au moins 3 personnes » pour les chiffres de la communauté est une **proposition de la maquette**,
   non tranchée : il évite d'exposer les relevés d'une seule personne ; à valider.
5. **Délais de rappel** : supposés définis pour les types de piège proposés. À contrôler une fois avant la campagne, pas à
   concevoir.

Maquettes : `doc/mockups/simple-mode.html` (10 écrans, clair et sombre selon le système).
