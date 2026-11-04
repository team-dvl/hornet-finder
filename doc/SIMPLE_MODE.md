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

### 4.1 Navigation : une barre de 3 onglets et un bouton « Scanner » en bas (téléphone)

Au pouce, au lieu du menu déroulant de la barre du haut. Sur ordinateur, les mêmes 3 entrées dans la barre du haut.

| Onglet | Route | Contenu |
|---|---|---|
| **À faire** (accueil) | `/` | Liste « À relever » (`DueList`) + bouton principal **« Ajouter un piège »** ; pastille rouge = `pending.traps`, déjà calculée |
| **Mes pièges** | `/traps` | Liste des pièges du piégeur, **portée `mine` fixée**, sans filtres ni tri exposés ; tap = fiche, actions « Relever », « Recharger », « Remiser » |
| **Scanner** (bouton central, en relief) | `/scan` | Ouvre la caméra sur tout écran ; voir 4.7 |
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
3. **Mon premier piège** : « Scanner le QR Code collé sur mon piège » (4.7) en premier choix, puis « Ajouter un piège » (4.3)
   ou « Je n'en ai pas encore ».

L'état « onboarding vu » suit la même règle de stockage que la bascule (section 3).

### 4.7 QR Codes : scanner en un geste

**Ce qui existe déjà** (lecture du code, rien n'est à inventer côté étiquette) : QR Codes signés (HMAC, valeur de 44
caractères, `hornet/tags.py`), scanner intégré `TagScannerModal`, routes `/scan` et `/tag/<valeur>`, raccourci
« Scanner » de l'icône de l'appli installée (`vite.config.ts`), `TagAssociateModal` (étiquette vierge → **un piège
existant**), contrôle serveur de chaque valeur avec journal des refus. Scanner une étiquette déjà posée ouvre la fiche du
piège.

**Ce qui manque pour le besoin** :
1. une étiquette vierge ne permet pas de **créer** le piège : il faut d'abord le placer sur la carte, puis l'associer ;
2. le scanner est à deux gestes au mieux (liste des pièges → « Scanner », ou carte → « + » → « Scanner ») et absent du
   mode simple ;
3. une étiquette posée ouvre la fiche, pas le relevé.

**Vocabulaire et format.** L'application utilise des **QR Codes** (2D), pas des codes-barres linéaires. Je recommande de
ne pas changer. Ordre de grandeur : un Code 128 de 44 caractères fait environ 520 modules (barres élémentaires), marges
comprises ~540 ; sur une étiquette de 50 mm cela donne ≈ 0,09 mm par module, bien en deçà de ce qu'une caméra de
téléphone lit de façon fiable en extérieur (de l'ordre de 0,2 mm ou plus, selon distance, lumière et appareil : marge
d'un facteur 2). Le QR Code actuel porte l'adresse complète (69 octets en prod, `https://velutina.ovh/tag/` + 44) au niveau de
correction Q : version 6, soit 41 modules de côté plus 2 de marge de chaque côté ; imprimé sur 36 mm (`tag_pdf.py`),
≈ 0,8 mm par module, environ quatre fois le seuil ci-dessus. Il a de plus l'avantage de porter une adresse, donc d'ouvrir l'appli quand on le scanne avec l'appareil photo
du système (Android, appli installée). Un lecteur de codes-barres matériel n'est pas visé.

**Accès rapide : un tap, depuis n'importe quel écran.**
- Mode simple : bouton central de la barre du bas (maquette K), toujours visible, hors des listes comme dedans. Il
  remplace le passage par la liste des pièges. Conséquence de mise en page : le bouton dépasse de ~18 px au-dessus de la
  barre, le bouton « Ajouter un piège » des listes monte d'autant (maquette A).
- Interface complète : un bouton-icône « Scanner » dans la barre du haut, à gauche du bouton de menu (téléphone,
  `pointer: coarse`). Règle de la barre : une seule ligne, le bouton de menu ne bouge pas ; la place est à mesurer à
  320 px de large avec le fil d'Ariane et la bannière d'accessibilité.
- Raccourci de l'icône de l'appli installée : existe (`/scan`) ; à signaler à l'onboarding. À ma connaissance, iOS ne
  prend pas en charge les raccourcis du manifeste : à vérifier sur appareil, c'est pourquoi le bouton de l'appli compte.
- Hors appli, l'appareil photo du système ouvre `/tag/<valeur>` ; sur iPhone l'appli installée ne capte pas ce lien
  (documenté dans `TagScannerModal`), d'où le scanner intégré.

**Que fait un scan** (le serveur décide, le client route) :

| QR Code lu | Mode simple | Interface complète |
|---|---|---|
| Étiquette **vierge** | Feuille « Nouveau QR Code » (L) : « C'est un nouveau piège » ou « Il est sur un de mes pièges » | Même choix dans `TagAssociateModal` |
| Posée sur un de **mes** pièges | **Relevé directement** (N), fiche à un tap | Fiche du piège (inchangé) |
| Piège que je ne peux pas lire | Message existant (O) | Idem |
| Faux, inconnu, révoqué, pas Velutina | Messages existants (O), puis retour au scanner pour enchaîner une tournée | Idem |

**Étiquette vierge → nouveau piège** (L puis M). C'est le formulaire de 4.3, avec trois différences : l'étiquette est déjà
acquise (bandeau), **« Ma position » est préchoisie** (la personne est devant le piège) et la **précision du GPS** est
affichée en mètres (`coords.accuracy`). Ordres de grandeur indicatifs d'un smartphone : quelques mètres (≈ 3 à 10 m) en
extérieur dégagé, 15 à 50 m ou davantage sous couvert végétal ou contre des bâtiments ; l'appareil et la minute comptent.
**Proposition de seuils, à valider** : jusqu'à 25 m « correcte » ; de 25 à 100 m un avertissement avec le choix d'attendre
ou de passer à l'adresse ; au-delà de 100 m, « ma position » seule n'est plus acceptée.

**Étiquette vierge → piège existant** : la liste existante, limitée à **mes** pièges et triée par « sans QR Code » d'abord.
Un piège qui a déjà un QR Code reste proposé, avec la confirmation « remplacer » actuelle (l'ancien est révoqué).

**Backend** (seul ajout, pour que « nouveau piège + étiquette » soit atomique) : `POST /api/traps/` accepte un champ
optionnel `tag` (la valeur scannée). Dans la transaction déjà ouverte par `TrapViewSet.create`, mêmes contrôles que
`TagViewSet._checked_tag` (signature, présence, étiquette libre, non révoquée ; la fonction est à extraire pour être
partagée, avec son journal des refus), association, et `audit.record(…, 'tag.associated', …)` à côté de `trap.created`.
Si l'étiquette vient d'être prise (409 `already_associated`), **aucun piège n'est créé**. Pas de nouvel endpoint :
`audit.tests.CoverageTests` ne bouge pas (l'action `tag.associated` existe). Tests à écrire : étiquette libre,
déjà posée, révoquée, falsifiée, et absence de piège créé en cas de refus.

**Limites à connaître.**
- Résoudre une étiquette et créer un piège exigent le serveur : sans réseau, le message « Impossible de joindre le
  serveur » existant s'affiche et rien n'est enregistré. Il n'y a pas de file d'attente hors ligne dans cette proposition.
  Si une part notable des pièges est en zone sans réseau, c'est un frein direct à l'adoption ; je ne peux pas la chiffrer
  d'ici, elle se mesure pendant le test de la phase 1 (section 8).
- **Distribution des étiquettes physiques.** Aujourd'hui, une étiquette vierge peut être posée par quiconque la scanne
  (`retrieve` ne regarde pas qui l'a générée) et un `trapper` peut générer et imprimer ses planches (`/admin/tags`,
  48 étiquettes au plus par lot), mais cette page n'est pas dans le mode simple. Comment les étiquettes parviennent-elles
  aux piégeurs occasionnels ? Voir la question 6 de la section 9.
- Caméra : l'image n'est ni enregistrée ni envoyée (décodage local par `qr-scanner`) ; l'autorisation est demandée par le
  navigateur, en HTTPS uniquement. Rien à ajouter à l'article 9 de la politique de confidentialité.

### 4.8 Imprimer un QR Code tout de suite

**Ce qui existe** : planche A4 de 4 × 6 étiquettes de 45 mm (QR Code de 36 mm, traits de coupe ; `hornet/tag_pdf.py`),
générée par lots de 1 à 48 étiquettes vierges (`POST /tags/batch/`), réimpression des codes en service, et un bouton PDF
(`SheetPdfButton`) qui gère déjà l'appli installée sur iPhone (feuille de partage, d'où « Imprimer »). Tout cela vit dans
`/admin/tags`, ouvert aux `trapper` mais absent du mode simple, et une étiquette imprimée seule occupe la case 1 : une
planche adhésive entamée est perdue.

**Quatre besoins, chacun au plus près du geste :**

| Besoin | Entrée | Effet |
|---|---|---|
| Un piège **sans** QR Code (créé par 4.3, ou avant les étiquettes) | Fiche du piège → « QR Code » (maquette P) | **Imprimer un QR Code pour ce piège** : le code naît **déjà associé** (légende « Piège #12 »), aucun scan à faire ensuite (Q) |
| Étiquette **abîmée** | Fiche du piège → « QR Code » (R) | **Réimprimer le même code** : rien ne change côté serveur |
| Étiquette **perdue ou volée** | Idem (R) | **Remplacer** : nouveau code associé, l'ancien révoqué (confirmation, flux `replace` existant) |
| En avoir **d'avance** pour le terrain | Profil → « Imprimer des étiquettes vierges » (S, H) | Lot de 1, 4, 12 ou 24 ; liste des vierges déjà imprimées, à réimprimer |

Après « Ajouter un piège » (4.3) sans étiquette, l'écran de confirmation propose « Imprimer son QR Code » en action
secondaire : c'est l'entrée P, sans détour.

**Case de départ** (Q, S) : une grille 4 × 6 où l'on touche la première case libre de la planche ; les étiquettes
suivent dans l'ordre de lecture. Le dernier choix est retenu sur l'appareil (préférence locale, donc une clé
`localStorage` de plus à l'article 9 de la politique de confidentialité). Cases de 44 px au moins : la grille fait
~190 × 285 px.

**Deux temps, sur iPhone surtout.** Créer et associer le code est une écriture : premier tap. Le PDF ne peut s'ouvrir, ou
la feuille de partage s'afficher, que pendant le geste de l'utilisateur, et Safari perd ce geste après une requête
réseau : d'où un second tap « Imprimer » sur un lien déjà préparé, comme le fait `SheetPdfButton` aujourd'hui. Fusionner
les deux en un tap n'est fiable que dans un navigateur de bureau.

**Ce qu'on peut dire de l'impression elle-même** (hors de notre contrôle, à signaler dans l'aide, pas à l'écran) :
- **Taille réelle (100 %)** : « Ajuster à la page » réduit le PDF de quelques pour cent (de l'ordre de 3 à 6 % selon les
  marges de l'imprimante). Le QR Code reste lisible (≈ 0,75 mm par module au lieu de 0,8), mais les étiquettes ne
  tombent plus dans les cases d'une planche adhésive.
- **Tenue à l'extérieur** : un papier ordinaire sous la pluie se dégrade en jours ou semaines ; une étiquette adhésive
  vinyle, ou du papier sous adhésif transparent, tient une saison. Ce sont des ordres de grandeur, non mesurés ici.
- **Sans imprimante** : le PDF se partage (courriel, messagerie) depuis la même feuille de partage, à imprimer ailleurs.
  Le piège reste relevable sans étiquette, depuis « À faire » et « Mes pièges ».

**Backend :**
- `POST /api/traps/<id>/tag/` (`{"replace": bool}`) : génère une étiquette avec la clé active et l'associe au piège dans
  la même transaction ; même règle de remplacement que `associate` (`trap_has_tag` sans `replace`, révocation de
  l'ancienne avec). Droit : `can_edit_trap`. Réponse : l'étiquette (`_tag_payload`), que le client passe à `sheet`.
  Audit : la paire existante `tag.batch_generated` (nombre 1) + `tag.associated`, dans la transaction ; c'est un nouvel
  endpoint d'écriture, à déclarer dans `audit.tests.CoverageTests` (skill `audited-endpoint`).
- `POST /tags/sheet/` et `render_sheet` : paramètre `skip` (0 à 23, cases laissées vides en tête de la première page).
  Lecture seule, pas d'audit.
- Aucune migration, aucune note de migration prod.

Hors périmètre : un format « une étiquette par page » pour imprimante d'étiquettes. Il se fait en peu de lignes dans
`tag_pdf.py` (page de 45 × 45 mm) si une association en a l'usage ; je ne l'ajoute pas sans ce besoin.

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
- QR Codes (4.7) : `SimpleTabBar` monte le bouton `/scan` ; `NavbarComponent` un bouton-icône sur téléphone ;
  `TagScannerModal` passe de `Traps.tsx` à un hôte global (le scan doit marcher depuis tout écran, aujourd'hui seule la page
  des pièges le monte) ; `TagAssociateModal` gagne la branche « nouveau piège » ; `TrapFormModal` accepte une valeur `tag`
  et sa précision GPS ; le relevé direct réutilise `TrapEventModal`.
- Impression (4.8) : une feuille « QR Code » dans la fiche du piège et un écran « Étiquettes vierges » réutilisant
  `SheetPdfButton` ; un composant de grille « case de départ » partagé avec `/admin/tags`.
- Backend : champ `tag` de `POST /api/traps/` (4.7), `POST /api/traps/<id>/tag/` et paramètre `skip` de la planche (4.8),
  champ `User.ui_mode` (section 9). Pas d'autre ajout.

## 6. Découpage proposé

| Phase | Contenu | Valeur pour la campagne |
|---|---|---|
| 1 | `uiMode` + bascule + accueil « À faire » + barre à 3 onglets **et bouton Scanner (hôte global du scanner, bouton de la barre du haut en interface complète)** + feuille profil | L'essentiel du gain de simplicité |
| 2 | Relevé à zéro en un tap, ajout de piège à 2 champs, **QR Code : étiquette vierge → nouveau piège, scan → relevé direct** (backend `tag`), **impression d'un QR Code depuis la fiche et étiquettes vierges depuis le profil** (4.8) | Alimente directement le reporting des captures |
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
6. **QR Codes** (section 4.7, demandé après coup) : scanner accessible en un tap ; étiquette vierge → nouveau piège ou piège
   existant. **À trancher : la distribution des étiquettes physiques.** Les options (non exclusives) : (a) l'administrateur
   imprime des planches et les remet (les étiquettes ne sont liées à personne tant qu'elles sont vierges) ; (b) un lien
   « Imprimer mes étiquettes » dans la feuille profil pour les piégeurs qui ont une imprimante (la page `/admin/tags` leur est
   déjà ouverte) ; (c) autre canal (association, point de retrait). Je ne sais pas laquelle s'applique à votre campagne.
   L'option (b) est désormais maquettée (4.8, S) ; elle n'exclut pas (a).
   Seuils de précision GPS de 4.7 : à valider.

7. **Impression rapide** (section 4.8) : imprimer un QR Code au besoin, depuis la fiche du piège ou le profil.

Maquettes : `doc/mockups/simple-mode.html` (19 écrans, clair et sombre selon le système ; K à O : scan, P à S : impression).
