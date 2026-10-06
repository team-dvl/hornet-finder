import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from 'react-oidc-context'
import { Provider } from 'react-redux'
import { store } from './store'
import './index.css'
import App from './App'
import { userManager } from './utils/oidc'
import 'bootstrap-icons/font/bootstrap-icons.css';

// Nettoyer l'URL après connexion réussie
const onSigninCallback = () => {
  window.history.replaceState({}, document.title, window.location.pathname);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Provider store={store}>
        <AuthProvider userManager={userManager} onSigninCallback={onSigninCallback}>
          <App/>
        </AuthProvider>
      </Provider>
    </BrowserRouter>
  </StrictMode>,
)
