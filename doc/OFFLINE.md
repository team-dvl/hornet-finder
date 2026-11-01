# Terrain sans réseau : mode « semi-offline »

Objectif : sur le terrain, l'application ne bloque jamais l'utilisateur. Une saisie est acquise tout de suite sur le téléphone, puis envoyée au serveur dès que possible, sans conflit à régler plus tard dans la grande majorité des cas.

Ce document fait l'analyse (état de départ : v1.6.0) et fixe le découpage en phases. La phase 0 est faite ; les suivantes sont à venir.

## 1. Constat

### D'où viennent les secondes d'attente

Un relevé de piège (`addTrapCatch`), avant la phase 0 :

1. renouvellement du jeton s'il expire bientôt (rare : il vit 1 h) ;
2. `POST /api/traps/<id>/catches/` en multipart, photos comprises (environ 200 à 500 ko chacune, redimensionnées à 1600 px) ;
3. puis `GET /api/traps/<id>/` pour relire le piège et son journal (`fetchTrapDetail`).

Le dialogue attend la fin de tout (`.unwrap()`) avant de se fermer. Avec un signal faible (aller-retour de 0,3 à 1 s, envoi de 0,5 à 2 Mbit/s), on obtient de l'ordre de 1 à 3 s sans photo, plus 1 à 8 s par photo. Ce sont des estimations : rien n'a été mesuré sur le terrain.

Le délai d'expiration d'axios (10 s pour tous les appels) coupait les envois les plus lourds. Exemple : 1,5 Mo à 0,5 Mbit/s demandent environ 25 s.

### Deux problèmes distincts

- **(a) Le réseau est lent.** Une interface optimiste suffit : afficher la saisie comme faite, confirmer ensuite.
- **(b) Il n'y a pas de réseau, ou l'application est fermée avant la fin de l'envoi.** iOS tue souvent une PWA passée en arrière-plan. Un état gardé seulement en mémoire (Redux) est alors perdu. Il faut une **file d'envoi persistante**.

### Lecture

Les données vivent seulement en mémoire. Le service worker ne met en cache ni `/api/` ni les tuiles OSM. Une application lancée sans réseau montre donc une carte vide.

## 2. Le modèle de données est favorable

Les données de terrain sont des **journaux**, et l'état affiché en est **déduit par le serveur** :

- **Pièges** : un relevé ajoute des `TrapEvent`. `Trap.recompute_catches()` relit tout le journal trié par `performed_at`. Il en déduit les prises de chaque relevé (ce que le piège contient, moins ce qui y restait), `hornet_catch_count` et `contents`.
- **Nids** : une vérification ou une destruction ajoute un `NestEvent`. `Nest.recompute_status()` parcourt le journal trié par `performed_at, id`.

Conséquence : des ajouts qui arrivent en retard, ou dans le désordre, donnent le **même résultat** qu'à l'heure. La condition est que `performed_at` soit l'heure de la saisie sur le téléphone, et non celle de la réception. Pour ces opérations, il n'y a pas de conflit à arbitrer.

## 3. Risques selon le type d'opération

| Type | Exemples | Risque quand l'envoi est différé | Parade |
|---|---|---|---|
| **A. Ajout au journal** | relevé, entretien, pose et retrait de piège, vérification et destruction de nid, signalement de frelon, ajout de photos | **doublon** si un envoi est rejoué | clé d'idempotence choisie par le client (`client_key`, phase 0) |
| **A'. Ajout soumis à l'état** | destruction d'un nid qu'un autre chasseur a entre-temps déclaré détruit | refus (403) à la synchronisation | le fait est acquis : le présenter comme « déjà fait », pas comme une erreur |
| **B. Modification de champs** (PATCH) | champs d'un piège, d'un nid ou d'un rucher, couleurs d'un frelon, déplacement d'un piège | la dernière écriture gagne, sans rien dire ; hors ligne, la fenêtre passe de quelques secondes à quelques heures | envoyer la version de départ (`updated_at` ou un compteur) ; 409 seulement si **le même champ** a changé entre-temps |
| **C. Création** | nouveau piège, nouveau nid, nouveau rucher | identifiants entiers donnés par le serveur, alors que des ajouts peuvent suivre sur l'objet avant qu'il existe | identifiant temporaire dans la file, remplacé à la confirmation ; colonne `client_key` unique contre les doublons |
| **D. Administration** | suppression, archivage, transfert, délégation, partage, groupes, invitations, étiquettes, réglages | transitions sous contrôle de droits et de verrous : les différer crée de vrais conflits | **en ligne uniquement** (bouton inactif « nécessite le réseau ») |

### Effets d'un envoi différé (bénins, mais visibles)

- **Valeurs déduites** (prises d'un relevé, statut d'un nid, compteurs) : elles restent provisoires jusqu'à la confirmation. L'application peut refaire le calcul localement, ou montrer la valeur saisie.
- **Pastilles** (`/api/pending`) et **rappels** : un piège relevé hors ligne peut recevoir le rappel « à relever » du planificateur (passage toutes les 10 minutes), tant que le relevé n'est pas arrivé.
- **Alertes de nids** (`nest_alerts`) : elles partent à la synchronisation. Un nid signalé hors ligne alerte donc les ruchers voisins avec ce retard.
- **Doublons de signalement** : deux personnes peuvent signaler hors ligne le même nid. C'est déjà possible aujourd'hui, mais plus probable quand la coupure dure.
- **Journal d'audit** : il date l'enregistrement (heure du serveur) ; l'événement garde son `performed_at`. L'écart entre les deux montre le différé.

### Session

Durées Keycloak en prod (`auth/realm-export.json`) :

| Paramètre | Valeur |
|---|---|
| Jeton d'accès | 1 h |
| Inactivité de session | 3 jours |
| Durée maximale de session | 7 jours |

Une coupure de quelques heures n'expose donc à rien. Au-delà de 3 jours sans réseau, ou après une déconnexion, la file d'envoi doit **survivre à la déconnexion** et rester **liée au GUID de son auteur**. On n'envoie jamais la file de A avec la session de B.

## 4. Architecture retenue

### File d'envoi (phase 1)

La file est stockée dans **IndexedDB** (petite surcouche `idb`). `localStorage` ne convient pas : environ 5 Mo au plus, et pas de fichiers, donc pas de photos.

Chaque entrée contient :

```
{ id (= client_key), userGuid, op, objectRef (réel ou temporaire), payload, blobs,
  createdAt, attempts, state, lastError }
```

**Fonctionnement**

- **Mise en file** : la saisie est appliquée au store Redux, marquée « en attente » (pastille sur l'objet), et le dialogue se ferme tout de suite.
- **Envoi** : premier entré, premier sorti, par objet. Un seul processus d'envoi à la fois, même avec deux onglets (`navigator.locks`).
- **Déclencheurs** : mise en file, retour du réseau (`utils/reachability.ts`), retour au premier plan, lancement de l'application.
- **Confirmation** : la réponse du serveur remplace l'état local (c'est le rôle de `include=trap` et de la réponse « nid » de la phase 0).
- **Refus définitif** (4xx sauf 401, 408 et 429) : la saisie est retirée de l'état local et placée dans une liste « à revoir », avec le motif.
- **Échec réseau ou 5xx** : la saisie reste en file, et l'envoi est retenté avec un délai croissant.
- **Indicateur** dans `ReachabilityBanner` : « 3 saisies en attente ».
- **Photos** : elles partent après la saisie (texte, quelques ko), qui est confirmée vite.

**Écartés**

| Option | Raison |
|---|---|
| Background Sync | iOS ne le connaît pas |
| Plugin `BackgroundSync` de Workbox | il rejoue depuis le service worker, qui n'a pas les jetons (choix d'architecture du projet) : les envois partiraient avec un jeton expiré |
| redux-offline | n'est plus maintenu |
| TanStack Query | réécriture des 66 thunks |

Une file maison, limitée à une dizaine d'opérations de terrain, coûte moins cher.

### Lecture hors ligne (phase 2)

- Copie locale (IndexedDB) des derniers objets chargés et des référentiels : espèces, types de pièges.
- Cache des **tuiles déjà vues** (environ 20 à 50 ko chacune). La politique d'utilisation des tuiles OSM interdit d'en télécharger à l'avance en masse.

## 5. Phases

| Phase | Contenu | État |
|---|---|---|
| 0 | idempotence des ajouts au journal, un aller-retour en moins, heure de la saisie, délai adapté aux photos | **faite** |
| 1 | file persistante et interface optimiste pour les ajouts au journal (type A) | à faire |
| 2 | lecture hors ligne : objets, référentiels, tuiles vues | à faire |
| 3 | créations (C) et modifications (B) hors ligne : identifiants temporaires, version de départ, 409 par champ | à faire |

Les phases 1 et 2 couvrent l'essentiel du travail de terrain, et sans conflit par construction.

Pour les modifications (phase 3), les conflits devraient rester rares :

- un piège appartient à son propriétaire, ou au groupe à qui il est délégué ;
- un nid est suivi par une personne et vérifié par les coordinateurs ;
- deux modifications du **même champ** du **même objet** pendant la **même coupure** sont donc peu probables. Le cas réaliste est celui de deux chasseurs sur le même nid, réglé par la règle A'.

## 6. Phase 0 : ce qui est en place

### `client_key` : un ajout rejoué est enregistré une fois

Trois points d'entrée acceptent un champ `client_key` (UUID) :

| Point d'entrée | Ce que devient la clé |
|---|---|
| `POST /api/traps/<id>/catches/` (un relevé) | le `batch` du relevé |
| `POST /api/traps/<id>/events/` (une intervention seule) | `TrapEvent.client_key` (unique) |
| `POST /api/nests/<id>/events/` (vérification, destruction, réactivation) | `NestEvent.client_key` (unique) |

Règles (`backend/hornet/idempotency.py`) :

- **Clé déjà enregistrée, même objet et même auteur** : rien n'est enregistré. La réponse est **200** avec ce qui a été enregistré la première fois, au lieu de 201. Une seconde tentative qui dirait autre chose ne change rien : la première fait foi, et l'utilisateur corrige dans le journal.
- **Clé déjà prise par quelqu'un d'autre, ou sur un autre objet** : **409**, rien n'est enregistré.
- **Clé mal formée** : 400.
- **Sans clé** : comportement d'avant, chaque requête est un nouvel ajout.
- **Ordre des contrôles** : la clé est cherchée **avant** la validation et les droits qui dépendent de l'état. Un rejeu ne doit pas être refusé pour un état que sa propre première tentative a créé : un nid que sa destruction a clos (un second « Neutraliser » sans clé est refusé).
- **Deux tentatives simultanées** : elles sont sérialisées par un verrou sur la ligne du piège ou du nid (`select_for_update`), et la clé est cherchée à nouveau sous ce verrou.
- **Exposition** : la clé est renvoyée dans `client_key` de chaque événement, pour que la file de la phase 1 reconnaisse ses saisies.
- **Journal d'audit** : un rejeu n'écrit rien et n'est donc pas audité.

Côté client (`frontend/src/utils/clientKey.ts`) :

- `TrapEventModal`, `NestEventModal` et la confirmation de pose ou de retrait (`pages/Traps.tsx`) créent une clé **à l'ouverture** et la renvoient à chaque tentative.
- Avant la phase 0, un « Enregistrer » répété après une expiration du délai enregistrait le relevé deux fois.

### Un aller-retour de moins

Avec `?include=trap`, les deux points d'entrée du journal d'un piège répondent `{"events" | "event": ..., "trap": <fiche du piège>}`. La fiche est celle de `GET /api/traps/<id>/` : statut, compteurs, journal.

Le client n'appelle donc plus `fetchTrapDetail` après un relevé, ce qui fait un aller-retour de moins, soit environ 0,3 à 1 s avec un signal faible. Sans le paramètre, les réponses sont inchangées (`smoke-traps.sh`, autres clients). La vérification d'un nid répondait déjà avec le nid.

### Heure de la saisie

- **Vérification d'un nid** : le client envoie `performed_at`, l'heure du clic sur le téléphone. Auparavant, le serveur prenait l'heure de réception. Le serveur refuse une date de plus de 5 minutes dans le futur, ce qui couvre la dérive d'horloge habituelle d'un téléphone (NTP, de l'ordre de la seconde).
- **Pièges et destructions** : `performed_at` était déjà fixé par le client.

### Délai adapté aux photos

Les ajouts au journal qui peuvent porter des photos (pièges et nids) ont 60 s au lieu de 10 (`UPLOAD_TIMEOUT_MS`). Les autres appels gardent 10 s.

### Restes, pour la phase 1

- **Signalements de frelons** (`createHornet`) et **créations de nids** : ils n'ont pas encore de clé.
- **Heure du signalement** : `Hornet.created_at` est l'heure de réception. Un signalement mis en file aurait la mauvaise date, il faudra une heure fournie par le client.
- **Ajouts de photos à un nid ou un piège existant** : pas de clé.
- **Réactivation d'un nid** (administrateurs, en ligne) : pas de clé.
