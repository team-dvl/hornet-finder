status: applied (2026-09-25)

# Aperçu des photos avant envoi, refonte mobile (`main` 4630f30 → `devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
| Commit | Changement |
|---|---|
| refonte mobile (`feat:`/`fix:` depuis `8fdfcd8`) | Interface téléphone : dialogues plein écran, barre de navigation sur une ligne, carte à trois boutons et regroupement des marqueurs, QR Codes liés à un objet, etc. Frontend seul, plus une nouvelle dépendance npm (`leaflet.markercluster`) installée par la construction du frontend. Thème Keycloak « Mon compte » : en-tête sur une ligne sur téléphone |
| (ce commit) | La Content-Security-Policy (`nginx/include/security-headers.conf`) autorise les images `blob:` |

Ce qui change dans **nginx** : `img-src` accepte `blob:`. L'app affiche la photo choisie ou prise (capture, piège, intervention, photo de profil) par une URL `blob:` locale avant l'envoi ; sans cette source, le navigateur bloque l'aperçu : la photo n'apparaissait qu'une fois enregistrée, servie par l'API.

`./deploy.sh` seul **ne suffit pas** pour nginx : son conteneur (image officielle, rien à construire) n'est recréé que si sa définition compose change, et un fichier monté un par un reste lié à son ancienne version après le `git merge`. Il faut recréer le conteneur (`./deploy.sh -s nginx`).

Ce qui **ne change pas** : backend, base de données, `.env`, volumes, réglages du realm Keycloak (seule l'image Keycloak est reconstruite pour le thème).

**Impact utilisateurs** : quelques secondes de coupure pendant la recréation de nginx et le redémarrage de Keycloak.

## Prérequis
- Notes 0001 à 0004 appliquées.
- Stack prod en marche.

## Étapes
1. `git merge --ff-only devel`
2. `./deploy.sh -b` (reconstruit le frontend, avec `leaflet.markercluster`, et l'image Keycloak avec le thème)
3. `./deploy.sh -s nginx` (recrée nginx, qui relit `security-headers.conf`)

## Vérification
- `./status.sh`
- `curl -skI https://velutina.ovh/ | grep -io "img-src[^;]*"` contient `blob:`.
- Sur un téléphone : fiche d'un piège → Capture → icône appareil photo d'une espèce : la photo apparaît aussitôt dans la carte de l'espèce, avant « Enregistrer ».
- « Mon compte » sur téléphone : logo, menu ⋮ et avatar sur une seule ligne.

## Rollback
`git reset --hard 4630f30` sur `main`, puis `./deploy.sh -b` et `./deploy.sh -s nginx`.
