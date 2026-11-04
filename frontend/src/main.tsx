import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from 'react-oidc-context'
import { Provider } from 'react-redux'
import { store } from './store'
import './index.css'
import App from './App'
import { userManager } from './utils/oidc'
import { ErrorBoundary } from './components/common'
import { RootErrorFallback } from './components/layout'
import { applyPlatformLook } from './utils/pwa'
import { initTheme } from './utils/theme'
import { initAppUpdate } from './utils/appUpdate'
import 'bootstrap-icons/font/bootstrap-icons.css';

// Nettoyer l'URL après connexion réussie
const onSigninCallback = () => {
  window.history.replaceState({}, document.title, window.location.pathname);
};

// Native-looking switches (iOS or Material), see App.css
applyPlatformLook();
initTheme();
// Service worker registration, update checks on resume, reload at a safe moment
initAppUpdate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={<RootErrorFallback />}>
    <BrowserRouter>
      <Provider store={store}>
        <AuthProvider userManager={userManager} onSigninCallback={onSigninCallback}>
          <App/>
        </AuthProvider>
      </Provider>
    </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
