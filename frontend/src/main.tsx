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
