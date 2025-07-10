import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css'
import { Container, Alert } from 'react-bootstrap'
import { useState, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import InteractiveMap from './InteractiveMap';
import NavbarComponent from './NavbarComponent';
import WelcomeModal from './WelcomeModal';
import { initIOSViewportFix } from './utils/iosViewportFix';

function App() {
  const auth = useAuth();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Afficher le modal de bienvenue quand l'utilisateur n'est pas authentifié
  useEffect(() => {
    // Initialiser la correction iOS pour le viewport
    initIOSViewportFix();
    
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
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Alert variant="danger">
          Oops... {auth.error.name} caused {auth.error.message}
        </Alert>
      </Container>
    );
  }

  return (
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
  );
}

export default App
