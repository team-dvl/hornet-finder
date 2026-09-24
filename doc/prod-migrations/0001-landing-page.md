status: applied

# Migration prod : page de garde, modules et documentation (`main` → `devel`)

**Procédure à exécuter depuis le worktree `main` (`/home/debian/hornet-finder`), PAS depuis le worktree `devel`.**

## Périmètre

Écart `main` (`09c07e3`) → `devel` (`fe1902e`) : deux commits, **frontend uniquement**.

| Commit | Contenu |
|---|---|
| `62b6c71` | Page de garde sur `/` avec menu de modules ; carte déplacée sur `/nests` ; placeholder `/traps` ; tuile « Mon compte » vers la console Keycloak ; retour sur la page d'origine après login ; suppression du modal de bienvenue |
| `fe1902e` | Fil d'Ariane dans la navbar ; module Documentation (`/docs`, `/docs/:module`) ; page de garde allégée |

Ce qui **ne change pas** : backend, base de données, `docker-compose.*`, nginx, Keycloak (realm, clients, rôles), `.env`, volumes. Aucune migration Django, aucun changement de schéma.

**Impact utilisateurs** :
- `https://velutina.ovh/` affiche désormais le menu, plus la carte. La carte est sur `https://velutina.ovh/nests` (à communiquer si des gens ont mis la carte en favori).
- PWA : `registerType: 'autoUpdate'` — les PWA installées se mettent à jour d'elles-mêmes au prochain lancement ; `start_url` reste `/`.
- Pas de coupure de service : `deploy.sh -b` reconstruit le frontend dans le volume `hornet-finder-frontend-dist` que nginx sert directement. Fenêtre de maintenance inutile.

---

## Conditions préalables

1. **Worktree prod propre** : `git status` dans `/home/debian/hornet-finder` ne doit montrer que le fichier non suivi `POSTGRES18_PROD_MIGRATION.md`. Aucune modification locale non commitée.
2. **Stack prod en marche et déjà sur PostgreSQL 18** (vérifié le 2026-09-21 : `hornet-finder-api-db`, `hornet-finder-keycloak-db` (`postgres:18.6`), `.env` avec `API_DB_VOLUME=hornet-finder-api-db-18`, `KEYCLOAK_DB_VOLUME=hornet-finder-keycloak-db-18`). Si ce n'est pas le cas, faire d'abord `POSTGRES18_PROD_MIGRATION.md` — les deux procédures sont indépendantes mais autant ne pas les mélanger.
3. **Keycloak prod : rien à activer**, mais trois choses à **vérifier** (section 2) parce que le nouveau frontend s'appuie dessus :
   - le client `hornet-app` accepte `https://velutina.ovh/*` comme redirect URI (le login revient maintenant sur `https://velutina.ovh/nests`, plus seulement sur `/`) ;
   - le client interne `account-console` accepte `/realms/hornet-finder/account/*` (c'est ce qui était cassé en dev : le realm dev avait gardé les chemins du realm prod, d'où « Paramètre invalide : redirect_uri ») ;
   - le rôle par défaut `default-roles-hornet-finder` contient `manage-account` et `view-profile` (sinon la console de compte refuse l'utilisateur).
4. Le compte admin Keycloak prod (Admin Console `https://auth.velutina.ovh/admin/master/console`) — uniquement si une vérification de la section 2 échoue.

---

## 1. Snapshot ZFS (facultatif mais gratuit)

Les bases ne sont pas touchées ; le snapshot sert seulement de filet par habitude.

```bash
cd /home/debian/hornet-finder
./zfs-snapshot.sh create --tag pre-landing-page -f
```

## 2. Vérifications Keycloak prod (lecture seule, sans identifiants)

Ces sondes reproduisent ce que fait le navigateur. Chacune doit renvoyer `200` et la **page de login** (`kc-form-login`), jamais `Invalid parameter`.

```bash
# a) Le login de l'application peut revenir sur /nests
curl -s -o /tmp/kc.html -w "%{http_code}\n" \
  "https://auth.velutina.ovh/realms/hornet-finder/protocol/openid-connect/auth?client_id=hornet-app&redirect_uri=https%3A%2F%2Fvelutina.ovh%2Fnests&response_type=code&scope=openid&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256"
grep -o -i "Invalid parameter[^<]*\|kc-form-login" /tmp/kc.html | sort -u

# b) La console de compte peut se connecter elle-même
curl -s -o /tmp/kc.html -w "%{http_code}\n" \
  "https://auth.velutina.ovh/realms/hornet-finder/protocol/openid-connect/auth?client_id=account-console&redirect_uri=https%3A%2F%2Fauth.velutina.ovh%2Frealms%2Fhornet-finder%2Faccount%2F&response_type=code&scope=openid&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256"
grep -o -i "Invalid parameter[^<]*\|kc-form-login" /tmp/kc.html | sort -u
```

État constaté le 2026-09-21 : les deux sondes renvoient `200 kc-form-login` — **prod est déjà correct**. Les rôles par défaut sont à lire dans l'Admin Console (Realm roles → `default-roles-hornet-finder` → Associated roles) ou avec `kcadm` ; l'export `auth/realm-export.json` les liste déjà (`manage-account`, `view-profile`, `offline_access`, `uma_authorization`).

**Si a) échoue** : Admin Console → realm `hornet-finder` → Clients → `hornet-app` → Valid redirect URIs → ajouter `https://velutina.ovh/*`.
**Si b) échoue** : Clients → `account-console` → Home URL `/realms/hornet-finder/account/`, Valid redirect URIs `/realms/hornet-finder/account/*` (idem pour le client `account`). C'est exactement la correction appliquée en dev le 2026-09-20 via l'API Admin.

Remarques, sans action requise :
- La tuile « Mon compte » ouvre `https://auth.velutina.ovh/realms/hornet-finder/account?referrer=hornet-app&referrer_uri=https://velutina.ovh/`. Keycloak valide `referrer_uri` contre les redirect URIs de `hornet-app` (`https://velutina.ovh/*` : OK) et affiche un lien « Retour à l'application ».
- Dans la console, l'utilisateur peut modifier son profil (`editUsernameAllowed` est activé), son mot de passe, ses sessions et ses comptes liés (Google/Facebook). Le backend identifie les utilisateurs par le claim `sub` (UUID), un changement de nom d'utilisateur ou d'e-mail est donc sans effet sur les données.
- L'action requise `delete_account` est **désactivée** (en prod comme en dev) : l'onglet « Supprimer le compte » n'apparaît pas dans la console. La page `/data-deletion` de l'application reste le point d'entrée pour cela. À activer seulement si on veut l'auto-suppression (Authentication → Required actions → Delete Account → Enabled).

## 3. Mettre `main` à niveau

Les deux worktrees partagent le même dépôt, aucun `fetch` n'est nécessaire.

```bash
cd /home/debian/hornet-finder
git status                      # seul POSTGRES18_PROD_MIGRATION.md doit apparaître (non suivi)
git log --oneline -1            # 09c07e3 attendu
git merge --ff-only devel       # -> fe1902e
git log --oneline -3
```

Si `--ff-only` refuse, c'est que `main` a avancé depuis : ne pas forcer, comparer avec `git log devel..main` avant de décider d'un vrai merge.

## 4. Reconstruire et déployer le frontend

```bash
cd /home/debian/hornet-finder
./deploy.sh -b
./status.sh
```

`-b` reconstruit l'image `hornet-finder-frontend-build`, exécute `tsc -b && vite build` et copie le résultat dans le volume `hornet-finder-frontend-dist` monté en lecture seule par nginx ; le reste de la stack est relancé sans changement. Le build prend une à deux minutes ; `status.sh` doit se terminer avec le code 0.

## 5. Vérifications post-déploiement

Depuis le shell (le fallback SPA nginx `try_files … /index.html` doit servir toutes les routes) :

```bash
for p in / /nests /traps /docs /docs/nests /docs/traps /inconnu; do
  printf "%-12s -> " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "https://velutina.ovh$p"
done
curl -s https://velutina.ovh/ | grep -o 'index-[A-Za-z0-9_-]*\.js'   # hash différent de l'ancien build
```

Dans un navigateur (idéalement une fenêtre privée + votre PWA installée) :

1. `https://velutina.ovh/` : page de garde claire, 4 tuiles (Nids, Pièges, Documentation, Se connecter/Mon compte), pied VSAB + liens Politique de confidentialité / Suppression des données.
2. Tuile « Recherche des nids » → `/nests` : la carte est identique à avant, fil d'Ariane `Velutina › Nids`, clic sur « Velutina » → retour au menu.
3. `/traps` : « Bientôt disponible » ; `/docs` : tuiles Nids + Pièges (« À venir ») ; `/docs/nests` : la doc (ancien contenu du modal de bienvenue), fil `Velutina › Documentation › Nids`.
4. Non connecté sur `/nests` → « Connexion » → Keycloak → **retour sur `/nests`** avec URL propre (pas de `code=`/`state=`).
5. Connecté sur `/` → tuile « Mon compte » → console Keycloak (même onglet) → lien « Retour à l'application » → `/`.
6. « Déconnexion » depuis `/nests` → atterrit sur `/`.
7. Rechargement forcé (F5) sur `/nests` et `/docs/nests` : la page se recharge sans 404.
8. PWA installée : la fermer, la rouvrir — elle démarre sur la page de garde (le service worker s'est mis à jour).

## Rollback

Aucune donnée n'a changé : revenir à l'ancien frontend suffit.

```bash
cd /home/debian/hornet-finder
git reset --hard 09c07e3        # main revient à l'état d'avant le merge
./deploy.sh -b
```

Le snapshot ZFS de l'étape 1 n'a pas besoin d'être restauré ; le supprimer plus tard avec `./zfs-snapshot.sh clean`.
