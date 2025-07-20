import { Navbar, Nav, Button, Container } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useState } from 'react';
import UserInfoModal from '../modals/UserInfoModal';
import CompassCapture from '../map/CompassCapture';

interface NavbarComponentProps {
  onShowWelcome?: () => void;
}

export default function NavbarComponent({ onShowWelcome }: NavbarComponentProps) {
  const auth = useAuth();
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCompassTest, setShowCompassTest] = useState(false);

  // Gestionnaire pour le test de boussole
  const handleCompassTest = () => {
    setShowCompassTest(true);
  };

  const handleCompassTestCapture = (direction: number) => {
    console.log('🎯 Direction capturée (test):', direction);
    setShowCompassTest(false);
    // Ne fait rien d'autre - c'est juste un test
  };

  const handleCompassTestClose = () => {
    setShowCompassTest(false);
  };

  return (
    <Navbar 
      variant="light"
      expand="lg" 
      fixed="top" 
      className="shadow-sm navbar-transparent"
      onMouseEnter={(e) => e.currentTarget.classList.add('navbar-opaque')}
      onMouseLeave={(e) => e.currentTarget.classList.remove('navbar-opaque')}
      onFocus={(e) => e.currentTarget.classList.add('navbar-opaque')}
      onBlur={(e) => e.currentTarget.classList.remove('navbar-opaque')}
    >
      <Container>
        <Navbar.Brand href="#" className="d-flex align-items-center">
          <span className="fw-bold">Velutina</span>
        </Navbar.Brand>
        
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <span className="navbar-text text-muted fst-italic">
              Luttons ensemble contre le frelon asiatique !
            </span>
          </Nav>
          
          <Nav>
            {!auth.isAuthenticated && (
              <div className="d-flex gap-2">
                {onShowWelcome && (
                  <Button 
                    variant="outline-info" 
                    size="sm"
                    onClick={onShowWelcome}
                    className="me-2"
                  >
                    <span className="me-1">ℹ️</span>
                    À propos
                  </Button>
                )}
                <Button 
                  variant="outline-warning" 
                  size="sm"
                  onClick={handleCompassTest}
                  className="me-2"
                  title="Tester la capture de direction par boussole"
                >
                  🎯 Test
                </Button>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => void auth.signinRedirect()}
                >
                  Connexion
                </Button>
              </div>
            )}
            {auth.isAuthenticated && (
              <div className="d-flex align-items-center">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => setShowUserModal(true)}
                  className="me-3"
                >
                  Bienvenue, {auth.user?.profile.name}
                </Button>
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  onClick={() => void auth.signoutRedirect(
                    { post_logout_redirect_uri: window.location.origin }
                  )}
                >
                  Déconnexion
                </Button>
              </div>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
      
      <UserInfoModal 
        show={showUserModal} 
        onHide={() => setShowUserModal(false)} 
      />
      
      {/* Dialogue de test de boussole */}
      <CompassCapture 
        show={showCompassTest} 
        onHide={handleCompassTestClose} 
        onCapture={handleCompassTestCapture}
      />
    </Navbar>
  );
}
