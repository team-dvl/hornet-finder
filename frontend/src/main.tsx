import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from 'react-oidc-context'
import { WebStorageStateStore } from 'oidc-client-ts'
import { Provider } from 'react-redux'
import { store } from './store'
import './index.css'
import App from './App'

// Détection automatique de l'environnement
const isDevelopment = window.location.hostname === 'dev.velutina.ovh' || 
                      window.location.hostname === 'localhost' ||
                      import.meta.env.DEV;

// Configuration OIDC selon l'environnement
const getOidcConfig = () => {
  const baseConfig = {
    authority: import.meta.env.VITE_KEYCLOAK_URL?.replace(/\/$/, '') + '/realms/hornet-finder' || 
               'https://auth.velutina.ovh/realms/hornet-finder',
    client_id: 'hornet-app',
    redirect_uri: window.location.origin,
    post_logout_redirect_uri: window.location.origin,
    response_type: 'code',
    scope: 'openid profile email',
    loadUserInfo: true,
    filterProtocolClaims: true,
    // Stockage persistant pour éviter la perte de session sur mobile
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    // Durée de vie plus longue des tokens
    accessTokenExpiringNotificationTime: 120, // 2 minutes avant expiration
    // Gestion des événements de cycle de vie
    onSigninCallback: () => {
      // Nettoyer l'URL après connexion réussie
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  if (isDevelopment) {
    // Configuration pour le développement
    return {
      ...baseConfig,
      client_id: 'hornet-app-dev',
      automaticSilentRenew: true, // Activé aussi en dev pour tester
      monitorSession: true, // Activer pour debug
      checkSessionInterval: 30000, // Vérification plus fréquente
      // Stocker aussi en localStorage en dev
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      // Configuration de renouvellement optimisée pour dev
      silentRequestTimeoutInSeconds: 20,
      accessTokenExpiringNotificationTime: 300, // 5 minutes en dev pour tester
    };
  } else {
    // Configuration pour la production - optimisée mobile
    return {
      ...baseConfig,
      automaticSilentRenew: true,
      monitorSession: false, // Évite les problèmes en arrière-plan
      checkSessionInterval: 60000, // Vérification moins fréquente
      // Configuration mobile optimisée
      silentRequestTimeoutInSeconds: 30, // Timeout plus long pour mobile
      accessTokenExpiringNotificationTime: 600, // 10 minutes avant expiration
      // Gestion des erreurs de renouvellement
      automaticSilentRenewIntervalInSeconds: 300, // Essayer de renouveler toutes les 5 minutes si échec
    };
  }
};

const oidcConfig = getOidcConfig();

// Debug : afficher la configuration utilisée
console.log('🔐 OIDC Configuration:', {
  environment: isDevelopment ? 'development' : 'production',
  hostname: window.location.hostname,
  authority: oidcConfig.authority,
  automaticSilentRenew: oidcConfig.automaticSilentRenew,
  monitorSession: oidcConfig.monitorSession
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Provider store={store}>
        <AuthProvider {...oidcConfig}>
          <App/>
        </AuthProvider>
      </Provider>
    </BrowserRouter>
  </StrictMode>,
)
