import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import { Provider } from 'react-redux'
import { store } from './store'
import './index.css'
import App from './App'

const oidcConfig = {
  authority: 'https://auth.velutina.ovh/realms/hornet-finder',
  client_id: 'hornet-app',
  redirect_uri: window.location.origin,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email',
  automaticSilentRenew: true,
  // Configuration optimisée pour PWA
  monitorSession: false, // Évite les problèmes en arrière-plan
  checkSessionInterval: 60000, // Vérification moins fréquente
  // Gestion des erreurs
  loadUserInfo: true,
  filterProtocolClaims: true,
  // Callback en cas d'erreur de renouvellement silencieux
  onSigninCallback: () => {
    // Nettoyer l'URL après connexion réussie
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <AuthProvider {...oidcConfig}>
        <App/>
      </AuthProvider>
    </Provider>
  </StrictMode>,
)
