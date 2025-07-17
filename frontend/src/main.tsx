import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
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
      automaticSilentRenew: false, // Désactiver en dev pour éviter les interruptions
      monitorSession: true, // Activer pour debug
      checkSessionInterval: 30000, // Vérification plus fréquente
    };
  } else {
    // Configuration pour la production
    return {
      ...baseConfig,
      automaticSilentRenew: true,
      monitorSession: false, // Évite les problèmes en arrière-plan
      checkSessionInterval: 60000, // Vérification moins fréquente
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
    <Provider store={store}>
      <AuthProvider {...oidcConfig}>
        <App/>
      </AuthProvider>
    </Provider>
  </StrictMode>,
)
