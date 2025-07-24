import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css'
import { Container, Alert } from 'react-bootstrap'
import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom'
import { useAuth } from 'react-oidc-context';
import { InteractiveMap } from './components/map';
import { NavbarComponent } from './components/layout';
import { WelcomeModal } from './components/modals';
import { PrivacyPolicy, DataDeletion } from './pages';
import { initIOSViewportFix } from './utils/iosViewportFix';
import { useUrlCleaner } from './utils/urlCleaner';
import { setupPWAAuthMonitoring } from './utils/pwaAuth';
import { useMobileSessionPersistence } from './hooks/useMobileSessionPersistence';

function App() {
  const auth = useAuth();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Nettoyer automatiquement l'URL après authentification (pour PWA)
  useUrlCleaner(auth.isAuthenticated);
  
  // Gestion de la persistance de session mobile
  useMobileSessionPersistence();

  // Afficher le modal de bienvenue quand l'utilisateur n'est pas authentifié
  useEffect(() => {
    // Initialiser la correction iOS pour le viewport
    initIOSViewportFix();
    
    // Initialiser le monitoring PWA pour l'authentification
    setupPWAAuthMonitoring();
    
    if (!auth.isLoading && !auth.isAuthenticated && !auth.activeNavigator) {
      // Vérifier si l'utilisateur a déjà choisi de continuer sans connexion
      const hasDeclinedLogin = localStorage.getItem('hornet-finder-declined-login');
      if (!hasDeclinedLogin) {
        setShowWelcomeModal(true);
      }
    } else {
      setShowWelcomeModal(false);
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.activeNavigator]);

  const handleCloseWelcomeModal = () => {
    setShowWelcomeModal(false);
    // Sauvegarder le choix de l'utilisateur pour ne pas réafficher le modal
    localStorage.setItem('hornet-finder-declined-login', 'true');
  };

  const handleShowWelcomeModal = () => {
    setShowWelcomeModal(true);
  };

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
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/data-deletion" element={<DataDeletion />} />
      <Route path="/" element={
        <>
          <NavbarComponent onShowWelcome={handleShowWelcomeModal} />
          <div className="map-fullscreen">
            <InteractiveMap />
          </div>
          
          <WelcomeModal 
            show={showWelcomeModal}
            onHide={handleCloseWelcomeModal}
          />
        </>
      } />
    </Routes>
  );
}

export default App
