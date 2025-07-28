# Solution PWA - Gestion des paramètres OAuth2/OIDC

## Problème résolu

L'application Velutina avait un problème avec les PWA (Progressive Web Apps) où l'URL restait "polluée" avec des paramètres OAuth2 après authentification, causant des dysfonctionnements lors du redémarrage de l'app.

## Solutions mises en place

### 1. Configuration OIDC optimisée (`main.tsx`)

```typescript
const oidcConfig = {
  // Configuration de base
  authority: 'https://auth.velutina.ovh/realms/hornet-finder',
  client_id: 'hornet-app',
  redirect_uri: window.location.origin,
  
  // Optimisations PWA
  automaticSilentRenew: true,
  monitorSession: false, // Évite les problèmes en arrière-plan
  checkSessionInterval: 60000, // Vérification moins fréquente
  
  // Callback de nettoyage
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}
```

### 2. Nettoyage automatique d'URL (`utils/urlCleaner.ts`)

- **Détection automatique** des paramètres OAuth2/OIDC dans l'URL
- **Suppression sélective** des paramètres problématiques
- **Hook React** pour intégration facile dans les composants
- **Gestion des erreurs** et logging pour debug

**Paramètres nettoyés :**
- `code`, `state`, `session_state`, `iss`
- `id_token`, `access_token`, `token_type`
- `error`, `error_description`, `error_uri`

### 3. Monitoring PWA (`utils/pwaAuth.ts`)

- **Détection du mode PWA** (standalone, etc.)
- **Surveillance des erreurs d'authentification**
- **Nettoyage automatique** des tokens expirés
- **Gestion des changements de réseau** et de visibilité

### 4. Gestion d'erreurs améliorée (`App.tsx`)

- **Messages d'erreur user-friendly** en cas de session expirée
- **Bouton de rechargement** automatique pour résoudre les problèmes
- **Nettoyage préventif** en cas d'erreur d'authentification

## Fonctionnement

### Flux normal
1. L'utilisateur se connecte via Keycloak
2. Keycloak redirige avec des paramètres OAuth2 dans l'URL
3. L'app traite l'authentification
4. **Nouveau :** L'URL est automatiquement nettoyée
5. L'utilisateur peut utiliser l'app normalement

### Gestion PWA
1. Détection automatique du mode PWA
2. Monitoring des paramètres "stale" dans l'URL
3. Nettoyage proactif lors des changements de visibilité
4. Gestion des erreurs de réseau

### Avantages
- ✅ **URL propre** après authentification
- ✅ **Redémarrage PWA** sans problème
- ✅ **Gestion automatique** des erreurs
- ✅ **Expérience utilisateur** améliorée
- ✅ **Compatible** avec tous les navigateurs

## Tests

Pour tester la solution :

1. **Mode PWA :** Installer l'app comme PWA et se connecter
2. **Redémarrage :** Fermer et rouvrir l'app PWA
3. **Rotation :** Vérifier que l'URL reste propre
4. **Erreurs :** Tester avec des tokens expirés

## Maintenance

- Les logs sont visibles dans la console développeur
- La configuration peut être ajustée dans `main.tsx`
- Les paramètres à nettoyer sont configurables dans `urlCleaner.ts`
