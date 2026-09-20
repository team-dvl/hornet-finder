import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css'
import { Container, Alert } from 'react-bootstrap'
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context';
import { Home, Nests, Traps, PrivacyPolicy, DataDeletion } from './pages';
import { initIOSViewportFix } from './utils/iosViewportFix';
import { useUrlCleaner } from './utils/urlCleaner';
import { setupPWAAuthMonitoring, setupTokenMonitoring, syncAuthStateWithServiceWorker } from './utils/pwaAuth';
import { useMobileSessionPersistence } from './hooks/useMobileSessionPersistence';

// Import conditionnel pour les tests en développement
if (import.meta.env.DEV) {
  import('./utils/authTester');
}

function App() {
  const auth = useAuth();

  // Nettoyer automatiquement l'URL après authentification (pour PWA)
  useUrlCleaner(auth.isAuthenticated);
  
  // Gestion de la persistance de session mobile
  useMobileSessionPersistence();

  // Initialisation unique (viewport iOS, monitoring PWA / tokens, service worker)
  useEffect(() => {
    // Initialiser la correction iOS pour le viewport
    initIOSViewportFix();
    
    // Initialiser le monitoring PWA pour l'authentification
    setupPWAAuthMonitoring();
    
    // Initialiser le monitoring avancé des tokens
    setupTokenMonitoring();
    
    // Synchroniser l'état avec le service worker
    syncAuthStateWithServiceWorker();
  }, []);

  // Synchroniser l'état d'authentification avec le service worker
  useEffect(() => {
    if (!auth.isLoading) {
      syncAuthStateWithServiceWorker();
    }
  }, [auth.isAuthenticated, auth.user, auth.isLoading]);

  switch (auth.activeNavigator) {
    case "signinSilent":
      return (
        <Container className="d-flex justify-content-center align-items-center vh-100">
          <Alert variant="info">Signing you in...</Alert>
        </Container>
      );
    case "signoutRedirect":
      return (
        <Container className="d-flex justify-content-center align-items-center vh-100">
          <Alert variant="info">Signing you out...</Alert>
        </Container>
      );
  }

  if (auth.isLoading) {
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Alert variant="info">Loading...</Alert>
      </Container>
    );
  }

  if (auth.error) {
    // Si erreur d'authentification (ex: token expiré), nettoyer et rediriger
    console.warn('Erreur d\'authentification:', auth.error);
    
    // Nettoyer l'URL si elle contient des paramètres OAuth invalides
    if (window.location.search.includes('code=') || window.location.search.includes('state=')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Alert variant="warning" className="text-center">
          <h5>Session expirée</h5>
          <p>Votre session a expiré. Veuillez recharger la page pour vous reconnecter.</p>
          <button 
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Recharger la page
          </button>
        </Alert>
      </Container>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/nests" element={<Nests />} />
      <Route path="/traps" element={<Traps />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/data-deletion" element={<DataDeletion />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App
