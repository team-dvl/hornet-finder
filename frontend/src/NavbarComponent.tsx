import { Navbar, Nav, Button, Container } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useState } from 'react';
import UserInfoModal from './UserInfoModal';

export default function NavbarComponent() {
  const auth = useAuth();
  const [showUserModal, setShowUserModal] = useState(false);

  return (
    <Navbar bg="light" expand="lg" sticky="top" className="shadow-sm">
      <Container>
        <Navbar.Brand href="#" className="d-flex align-items-center">
          <span className="fw-bold">Hornet Nest Finder</span>
        </Navbar.Brand>
        
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <span className="navbar-text text-muted fst-italic">
              Find and report hornet nests in your area!
            </span>
          </Nav>
          
          <Nav>
            {!auth.isAuthenticated && (
              <Button 
                variant="primary" 
                size="sm"
                onClick={() => void auth.signinRedirect()}
              >
                Log in
              </Button>
            )}
            {auth.isAuthenticated && (
              <div className="d-flex align-items-center">
                <button
                  className="btn btn-link p-0 text-decoration-none me-3"
                  onClick={() => setShowUserModal(true)}
                  style={{ color: 'inherit' }}
                >
                  Welcome, {auth.user?.profile.name}
                </button>
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  onClick={() => void auth.signoutRedirect(
                    { post_logout_redirect_uri: window.location.origin }
                  )}
                >
                  Log out
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
