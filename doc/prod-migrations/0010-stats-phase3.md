status: pending

# Statistiques phase 3 : graphiques, PDF, lien d'export par email (`main` → `devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
| Commit | Changement |
|---|---|
| `feat: charts of the statistics…`, `feat: statistics of the species…` | Graphiques des statistiques, pages « Espèces » et « Classement » (frontend) |
| `feat: PDF export…` | Export PDF des tableaux (backend, `reportlab` déjà présent) |
| `feat: send a statistics export link by email` | Table `hornet_statexportjob` (migration `0020_stat_export_job`, appliquée au démarrage du conteneur API par `docker-entrypoint.sh`), envoi d'un lien d'export par email |

Emails : **rien de plus à configurer**. L'API envoie par le serveur SMTP que la note 0006 (invitations aux groupes) met en place : `ssl0.ovh.net:465` dans `docker-compose.prod.yml`, `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` dans `.env`, dans la mise en page des emails Keycloak comme les invitations. L'option « Envoyer un lien par email » n'est proposée que si `EMAIL_HOST` est défini, ce qui est toujours le cas en prod une fois la note 0006 appliquée.

Volume : au plus 5 liens par personne et par heure, sur le même compte OVH que Keycloak et les invitations (de l'ordre de 200 emails par heure et par compte selon les sources publiques d'OVH, non vérifié dans le contrat).

Ce qui **ne change pas** : `.env`, nginx, volumes, réglages du realm Keycloak.

**Impact utilisateurs** : quelques secondes de coupure pendant la recréation de l'API.

## Prérequis
- Notes 0001 à 0009 appliquées (0006 : les emails de l'API partent, `sendtestemail` réussi).
- Stack prod en marche.

## Étapes
1. Snapshot : `./zfs-snapshot.sh create --tag pre-stats-phase3 -f` (nouvelle table).
2. `git merge --ff-only devel`
3. `./deploy.sh -b` (reconstruit le frontend ; l'API est recréée et applique `0020`).

## Vérification
- `./status.sh` ; `./deploy.sh` affiche la migration `0020_stat_export_job` appliquée.
- Statistiques → Captures FA → Graphique : barres et courbe affichées.
- Exporter → PDF : le fichier s'ouvre dans le visualiseur du navigateur.
- Exporter → « Envoyer un lien par email » → message « Lien envoyé à x•••@… », l'email arrive, le lien ouvre la page de téléchargement. En cas d'échec, l'app affiche « L'email n'a pas pu être envoyé » et `./logs.sh api` donne l'erreur SMTP.

## Rollback
`git reset --hard <sha de main avant la fusion>` sur `main`, puis `./deploy.sh -b`. La table `hornet_statexportjob` peut rester (ignorée par l'ancien code) ; pour la retirer, restaurer le snapshot `pre-stats-phase3`.
