# Audit trail

Statut : backend **implémenté** (`backend/audit/`) ; module d'administration
frontend en maquette (`doc/mockups/audit-trail.html`), à valider avant
implémentation.

Le journal d'audit enregistre les actions « business » faites sur les entités
de la plateforme : qui a fait quoi, quand, sur quel objet, et ce qui a changé.
Il est réservé aux **administrateurs de plateforme** (rôle `admin`), en lecture
seule.

## Décisions

| Sujet | Décision |
|---|---|
| Accès | Admins de plateforme uniquement. Pas d'accès pour les admins d'association |
| Conservation | 1 an, `AUDIT_RETENTION_DAYS` (`.env`, 365 par défaut) |
| Compte supprimé | Le GUID est gardé ; une réinscription donne un nouveau GUID |
| Noms | Jamais stockés : résolus dans Keycloak à la lecture (cache 10 min) |
| Exports statistiques | Demande (acteur connu) **et** téléchargements (sans acteur, rattachés à la demande) |
| Rattrapage | Uniquement les faits datés des données existantes, rien d'inventé |
| Adresse IP | Non enregistrée (elle reste dans les logs nginx) |
| Lectures | Non auditées, sauf les exports (statistiques, journal d'audit) |

## Modèle

Une table `audit_auditevent`, une ligne par action :

| Champ | Contenu |
|---|---|
| `occurred_at` | Moment de l'action (heure du serveur) |
| `actor` | GUID Keycloak, sans clé étrangère ; vide si inconnu ou sans connexion |
| `actor_roles` | Rôles détenus à ce moment (agissait-il comme admin ?) |
| `source` | `api`, `system` (expiration d'invitation), `backfill` (reconstitué) |
| `action` | `<domaine>.<verbe>`, catalogue dans `audit/actions.py` |
| `target_type`, `target_id` | L'objet visé (`trap`, `42`), aussi un groupe Keycloak ou une statistique |
| `refs` | Tous les objets concernés (`trap:42`, `group:/beekeepers/x`, `user:<guid>`, `visit:<batch>`, `export:<empreinte>`), index GIN |
| `changes` | Modification : `{champ: [avant, après]}` ; suppression : l'objet tel qu'il était ; création et autres : ce qui décrit l'action |
| `request_id` | Commun aux événements d'une même requête |

`refs` répond à « tout ce qui touche au piège 42 » (son journal, ses QR codes,
sa délégation) ou « à l'association X » en une requête.

## Garanties

- **Atomicité** : l'événement est écrit dans la transaction de la modification
  (`audit.record`, ou `audit.track` autour d'une mise à jour, qui relit l'objet
  en base avant et après pour le diff). Une action refusée ou en erreur
  n'enregistre rien ; une mise à jour sans changement non plus.
- **Keycloak** (membres, administrateurs de groupe) n'est pas transactionnel :
  l'événement est écrit après le succès de l'appel.
- **Append-only** : un trigger PostgreSQL refuse tout `UPDATE`, et tout
  `DELETE` hors de la purge de rétention (qui pose `SET LOCAL audit.purge`). Il
  protège des bugs et des erreurs de manipulation, pas d'un détenteur du rôle
  propriétaire de la base.
- **Complétude** : `audit.tests.CoverageTests` parcourt le routeur DRF et les
  vues hors routeur. Un nouvel endpoint qui écrit fait échouer les tests tant
  qu'il n'est pas déclaré dans `AUDITED` (avec son action) ou `NOT_AUDITED`
  (avec la raison).
- **Purge** : au plus une fois par jour et par processus, après une écriture
  (pas de cron) ; `manage.py audit_purge` la lance à la main.

## Actions enregistrées

| Domaine | Actions |
|---|---|
| `hornet` | `reported`, `updated`, `deleted`, `archived`, `unarchived`, `bulk_archived` |
| `nest` | `reported`, `updated`, `destroyed`, `reactivated`, `deleted`, `photo_added`, `photo_removed`, `archived`, `unarchived`, `bulk_archived` |
| `apiary` | `created`, `updated`, `deleted`, `photo_set`, `photo_removed`, `shared`, `share_changed`, `unshared`, `owner_changed` |
| `trap` | `created`, `updated`, `deleted`, `photo_set`, `photo_removed`, `delegated`, `undelegated`, `owner_changed`, `event_recorded`, `visit_recorded`, `visit_deleted`, `event_corrected`, `event_deleted`, `journal_photo_removed` |
| `tag` | `batch_generated`, `associated` (avec le tag remplacé), `revoked` |
| `trap_type`, `species` | `created`, `updated`, `deleted` ; `species.reordered` |
| `group` | `member_removed`, `admin_named`, `admin_dismissed` |
| `invitation` | `sent` (avec `notified`), `reminded`, `cancelled`, `accepted`, `declined`, `expired` (système, daté de la fin de validité) |
| `stats` | `export_link`, `export_emailed`, `export_downloaded` |
| `audit` | `exported` (export CSV du journal) |

Hors périmètre : lectures, tentatives refusées (dans les logs), photo de profil,
effets techniques (recalcul des captures), synchronisation de `group_paths`,
commandes de gestion (`sync_group_names`, `fetch_species_photos`).

Une visite de piège (plusieurs espèces et actions) est **un** événement. Un
archivage par période est **un** événement qui référence chaque objet archivé.
Les téléchargements d'un export sont reliés à sa demande par
`export:<16 premiers caractères du SHA-256 du jeton>` : le jeton lui-même, qui
ouvre le fichier, n'est jamais gardé, ni l'adresse email.

## API

Voir `backend/README.md`, section *Audit trail* : `GET /api/audit/events/`
(filtres `since`, `until`, `actor`, `action`, `domain`, `ref`, `source`, `q`,
pagination par curseur), `…/{id}/`, `…/catalogue/`, `…/actors/?q=`,
`…/export/` (CSV).

## Rattrapage des données existantes

La migration `audit/0002_backfill` reconstitue, une seule fois, les
événements des 365 derniers jours (au-delà, ils seraient purgés aussitôt), avec
`source = backfill` et, dans `changes.from`, la colonne qui les date. Elle
passe au démarrage du conteneur, avant que l'API ne serve : ni trou ni doublon
avec les événements réels.

| Reconstitué | Source |
|---|---|
| Frelons, nids, ruchers signalés ou créés | `created_at`, `created_by` |
| Archivages (frelons, nids), sans acteur | `archived_at` |
| Photos de nid ajoutées après le signalement | `NestPhoto.created_at`, `uploaded_by` |
| Pièges créés, par le créateur d'origine | `Trap.created_at` et l'installation écrite dans la même requête |
| Entrées du journal ; visites (regroupées par `batch`) | `TrapEvent.created_at`, `performed_by` |
| QR codes générés (par lot), associés, révoqués | `generated_*`, `associated_*`, `revoked_*` |
| Invitations : envoi, réponse, annulation (sans acteur), expiration, dernier rappel (sans acteur) | `GroupInvitation` |
| Exports statistiques envoyés par email encore en base | `StatExportJob` |

Non reconstitué, faute de trace datée : modifications de champs, suppressions,
changements de propriétaire, partages, délégations, destructions de nids
(`destroyed_at` est une date métier saisie, pas celle de l'action),
référentiels, membres de groupes, téléchargements passés.

## Pour ajouter un endpoint qui écrit

1. Ajouter le code d'action dans `audit/actions.py` (et son libellé dans le
   frontend).
2. Dans la vue, dans la transaction de la modification :
   `audit.record(request, 'x.verbe', obj, changes=…, refs=…)`, ou
   `with audit.track(request, 'x.updated', obj): …` pour une mise à jour.
3. Déclarer l'endpoint dans `AUDITED` (`audit/tests.py`) et tester l'événement.
