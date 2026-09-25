import { Navbar, Nav, Button, Container, Spinner, Breadcrumb } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectGeolocationLoading,
  selectApiariesLoading,
  selectNestsLoading,
  selectHornetsLoading,
  fetchAvatar,
} from '../../store/store';
import UserInfoModal from '../modals/UserInfoModal';
import { signInFromCurrentPage } from '../../utils/authRedirect';
import { getBreadcrumbs } from '../../utils/breadcrumbs';
import { visibleModules } from '../../config/modules';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { UserAvatar } from '../common';
import { useAvatarUrl } from '../../hooks/useAvatarUrl';

const SITE_NAME = `Velutina${import.meta.env.DEV ? ' DEV' : ''}`;

/**
 * Top bar, always on one line so that the menu button never moves: on a phone
 * the breadcrumb shrinks to a back link and the current level; the menu lists
 * the modules, the profile and the sign-out.
 */
export default function NavbarComponent() {
  const auth = useAuth();
  const location = useLocation();
  const crumbs = getBreadcrumbs(location.pathname);
  const { roles } = useUserPermissions();
  const modules = visibleModules(roles).filter((module) => module.path);
  const [showUserModal, setShowUserModal] = useState(false);
  const avatarUrl = useAvatarUrl();
  const dispatch = useAppDispatch();
  const userId = auth.user?.profile.sub;
  const accessToken = auth.user?.access_token;

  // Effective photo, once per signed-in user (and once the API has the token)
  useEffect(() => {
    if (userId && accessToken) void dispatch(fetchAvatar());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- not on every token refresh
  }, [userId, dispatch]);
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

  const current = crumbs[crumbs.length - 1];
  const parentPath = crumbs.length > 1 ? crumbs[crumbs.length - 2].path : '/';
  const close = () => setExpanded(false);

  return (
    <Navbar
      ref={navbarRef}
      variant="light"
      expand="lg"
      fixed="top"
      className={`shadow-sm navbar-transparent ${expanded ? 'navbar-opaque' : ''}`}
      expanded={expanded}
      onToggle={setExpanded}
    >
      <Container>
        <div className="navbar-title">
          {/* Phone: back to the parent level, and the current level only */}
          <div className="d-flex d-sm-none align-items-center min-w-0">
            {current ? (
              <>
                <Link to={parentPath} className="navbar-back" aria-label="Retour" title="Retour">
                  <i className="bi bi-chevron-left" aria-hidden="true" />
                </Link>
                <span className="fw-semibold text-truncate">{current.label}</span>
              </>
            ) : (
              <span className="fw-bold text-truncate">{SITE_NAME}</span>
            )}
          </div>

          {/* Wider screens: the whole trail, from the site name */}
          <Breadcrumb className="navbar-breadcrumb d-none d-sm-block min-w-0" listProps={{ className: 'mb-0' }}>
            <Breadcrumb.Item
              linkAs={Link}
              linkProps={{ to: '/' }}
              active={crumbs.length === 0}
              className="fw-bold"
            >
              {SITE_NAME}
            </Breadcrumb.Item>
            {crumbs.map((crumb, index) => (
              <Breadcrumb.Item
                key={crumb.path}
                linkAs={Link}
                linkProps={{ to: crumb.path }}
                active={index === crumbs.length - 1}
              >
                {crumb.label}
              </Breadcrumb.Item>
            ))}
          </Breadcrumb>

          {isDataLoading && (
            <Spinner
              animation="border"
              size="sm"
              className="ms-2 flex-shrink-0"
              role="status"
              aria-label="Chargement des données..."
            />
          )}
        </div>

        <Navbar.Toggle aria-controls="basic-navbar-nav" aria-label="Menu" className="flex-shrink-0" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {modules.map((module) => (
              <Nav.Link key={module.id} as={NavLink} to={module.path!} onClick={close} className="navbar-module-link">
                <i className={`bi ${module.icon} me-2 d-lg-none`} aria-hidden="true" />
                {module.shortTitle}
              </Nav.Link>
            ))}
          </Nav>

          <Nav className="align-items-lg-center navbar-account">
            {!auth.isAuthenticated && (
              <Button
                variant="primary"
                onClick={() => {
                  close();
                  void signInFromCurrentPage(auth);
                }}
              >
                <i className="bi bi-box-arrow-in-right me-2" aria-hidden="true" />
                Connexion
              </Button>
            )}
            {auth.isAuthenticated && (
              <div className="d-flex align-items-center gap-2">
                <Button
                  variant="link"
                  onClick={() => {
                    close();
                    setShowUserModal(true);
                  }}
                  className="navbar-profile text-body text-decoration-none"
                  aria-label="Mon profil"
                  title="Mon profil"
                >
                  <UserAvatar url={avatarUrl} size={28} />
                  <span className="text-truncate d-lg-none d-xl-inline">{auth.user?.profile.name}</span>
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={() => void auth.signoutRedirect(
                    { post_logout_redirect_uri: window.location.origin }
                  )}
                  className="icon-button ms-auto"
                  aria-label="Déconnexion"
                  title="Déconnexion"
                >
                  <i className="bi bi-box-arrow-right" aria-hidden="true" />
                  <span className="ms-2 d-lg-none">Déconnexion</span>
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
