import { Navbar, Nav, Button, Container } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useState } from 'react';
import UserInfoModal from './UserInfoModal';

interface NavbarComponentProps {
  onShowWelcome?: () => void;
}

export default function NavbarComponent({ onShowWelcome }: NavbarComponentProps) {
  const auth = useAuth();
  const [showUserModal, setShowUserModal] = useState(false);

  return (
    <Navbar bg="light" expand="lg" fixed="top" className="shadow-sm">
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
                <button
                  className="btn btn-link p-0 text-decoration-none me-3"
                  onClick={() => setShowUserModal(true)}
                  style={{ color: 'inherit' }}
                >
                  Bienvenue, {auth.user?.profile.name}
                </button>
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
    </Navbar>
  );
}
