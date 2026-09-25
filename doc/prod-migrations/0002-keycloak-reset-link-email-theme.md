status: applied (2026-09-25)

# Lien « mot de passe oublié », thèmes e-mail et compte Velutina (`main` 9cfe9f6 → `devel`)

**À exécuter depuis le worktree prod (`/home/debian/hornet-finder`).**

## Périmètre
| Commit | Changement |
|---|---|
| `15a0272` | Thème de login `velutina` : lien de réinitialisation sur l'écran de l'identifiant (`login-username.ftl`) et sur l'écran passkey (`webauthn-authenticate.ftl`, libellé « Clé d'accès perdue ou mot de passe oublié ? » traduit dans toutes les langues Keycloak) |
| (ce commit) | Nouveau thème e-mail `velutina` (`auth/themes/velutina/email/`) : gabarit HTML commun à tous les e-mails Keycloak, avec le logo VSAB, sur une carte blanche et un fond vert. `emailTheme` passe à `velutina` dans `auth/realm-export.json` |
| (ce commit) | Nouveau thème de compte `velutina` (`auth/themes/velutina/account/`, hérité de `keycloak.v3`) : console « Mon compte » avec le logo VSAB, un en-tête blanc souligné du liseré aux couleurs du logo, une barre latérale claire et un fond vert. `accountTheme` passe à `velutina` dans `auth/realm-export.json` |

Les thèmes sont intégrés à l'image Keycloak : `./deploy.sh` les déploie. En revanche, l'import du realm ne modifie pas un realm existant. Il faut donc **sélectionner les thèmes e-mail et compte à la main** sur le realm prod.

Ce qui **ne change pas** : backend, base de données, frontend, nginx, `.env`, volumes.

**Impact utilisateurs** : Keycloak redémarre (quelques secondes pendant lesquelles la connexion est impossible). Les e-mails Keycloak (réinitialisation, vérification d'adresse…) et la console « Mon compte » prennent le nouveau style.

## Prérequis
- Worktree prod propre, stack en marche.
- Realm `hornet-finder` : **Realm settings → Login → Forgot password** activé. Sinon, aucun des deux liens ne s'affiche. Lecture : `GET /admin/realms/hornet-finder` → `resetPasswordAllowed`.
- SMTP prod fonctionnel (Realm settings → Email → « Test connection »).

## Étapes
1. `git merge --ff-only devel`
2. `./deploy.sh -s auth` (reconstruit l'image Keycloak avec les thèmes)
3. **Keycloak (écriture, à confirmer avec l'utilisateur)** : Realm settings → Themes → **Account theme** = `velutina` et **Email theme** = `velutina`, puis Save. Équivalent Admin API (compte `flow-admin`) :
   ```sh
   curl -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
     -d '{"accountTheme":"velutina","emailTheme":"velutina"}' https://auth.velutina.ovh/admin/realms/hornet-finder
   ```
4. Si `resetPasswordAllowed` est à `false` : activer **Forgot password** (Realm settings → Login), avec confirmation.

## Vérification
- `https://velutina.ovh` → connexion : le lien « Mot de passe oublié ? » apparaît sous le champ identifiant.
- Pour un compte qui n'a qu'une passkey : l'écran « Se connecter avec une clé d'accès » affiche « Clé d'accès perdue ou mot de passe oublié ? ».
- Page d'accueil de l'app → « Mon compte » : la console affiche le logo VSAB et le style Velutina (onglet « Velutina »).
- Realm settings → Email → « Test connection » : l'e-mail reçu porte le logo VSAB. Le logo est servi par `https://auth.velutina.ovh/resources/<version>/email/velutina/img/vsab-logo.png`.

## Retour arrière
- Thèmes : remettre **Account theme** et **Email theme** à vide (thèmes Keycloak par défaut).
- Liens de login : `git revert` des commits puis `./deploy.sh -s auth`.
