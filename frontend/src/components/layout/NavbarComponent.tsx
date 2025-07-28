import { Navbar, Nav, Button, Container, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../../store/hooks';
import { 
  selectGeolocationLoading,
  selectApiariesLoading, 
  selectNestsLoading,
  selectHornetsLoading 
} from '../../store/store';
import UserInfoModal from '../modals/UserInfoModal';
import TokenStatusBadge from '../debug/TokenStatusBadge';


interface NavbarComponentProps {
  onShowWelcome?: () => void;
}

export default function NavbarComponent({ onShowWelcome }: NavbarComponentProps) {
  const auth = useAuth();
  const [showUserModal, setShowUserModal] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const navbarRef = useRef<HTMLDivElement>(null);

  // Gestion de la contraction automatique sur clic extérieur (mobile)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!expanded) return;
      if (navbarRef.current && !navbarRef.current.contains(event.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [expanded]);

  // États de chargement des données
  const isGeolocationLoading = useAppSelector(selectGeolocationLoading);
  const isApiariesLoading = useAppSelector(selectApiariesLoading);
  const isNestsLoading = useAppSelector(selectNestsLoading);
  const isHornetsLoading = useAppSelector(selectHornetsLoading);
  
  // Afficher le spinner si au moins une des données est en cours de chargement
  const isDataLoading = isGeolocationLoading || isApiariesLoading || isNestsLoading || isHornetsLoading;

  return (
    <Navbar
      ref={navbarRef}
      variant="light"
      expand="lg"
      fixed="top"
      className="shadow-sm navbar-transparent"
      expanded={expanded}
      onToggle={setExpanded}
      onBlur={() => (document.activeElement && !document.activeElement.closest('.navbar')) && document.querySelector('.navbar')?.classList.remove('show')}
      onMouseEnter={(e) => e.currentTarget.classList.add('navbar-opaque')}
      onMouseLeave={(e) => e.currentTarget.classList.remove('navbar-opaque')}
      onFocus={(e) => e.currentTarget.classList.add('navbar-opaque')}
    >
      <Container>
        <Navbar.Brand href="#" className="d-flex align-items-center">
            <span className="fw-bold">
            Velutina{import.meta.env.DEV && ' DEV'}
            </span>
          {isDataLoading && (
            <Spinner 
              animation="border" 
              size="sm" 
              className="ms-2" 
              role="status"
              aria-label="Chargement des données..."
            />
          )}
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
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => setShowUserModal(true)}
                  className="me-3"
                >
                  Bienvenue, {auth.user?.profile.name}
                </Button>
                {/* Badge de diagnostic des tokens - uniquement en développement */}
                {import.meta.env.DEV && <TokenStatusBadge />}
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  onClick={() => void auth.signoutRedirect(
                    { post_logout_redirect_uri: window.location.origin }
                  )}
                  className="ms-2"
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
