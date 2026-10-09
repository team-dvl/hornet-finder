status: pending

# Fond de carte satellite : CSP nginx (`devel`)

**À exécuter depuis le worktree prod, après `./deploy.sh`.**

## Périmètre
La carte propose un fond satellite (Esri World Imagery). Les tuiles viennent de `https://server.arcgisonline.com`, ajouté à `img-src` dans `nginx/include/security-headers.conf` (et `-dev`). Sans rechargement de nginx, le navigateur bloque les tuiles et le fond reste gris.

Ce qui **ne change pas** : `.env`, volumes, base de données, Keycloak.

## Étapes
1. `./deploy.sh` (recrée le frontend ; si nginx n'est pas redémarré, `docker compose restart nginx`).
2. Vérifier : `curl -sI https://velutina.ovh/ | grep -i content-security-policy` contient `server.arcgisonline.com`.
3. Ouvrir la carte, bouton « Couches », choisir « Satellite » : les tuiles s'affichent.

## Retour arrière
Revenir au commit précédent et `./deploy.sh` ; le choix mémorisé (`localStorage`) retombe sur le plan.
