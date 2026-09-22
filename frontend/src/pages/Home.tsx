import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { PageLayout } from '../components/layout';
import { ModuleCard } from '../components/home';
import { visibleModules } from '../config/modules';
import { signInFromCurrentPage } from '../utils/authRedirect';
import { useUserPermissions } from '../hooks/useUserPermissions';

/** Keycloak account console URL, with a "back to application" link pointing at the landing page. */
function accountConsoleUrl(authority: string, clientId: string): string {
  const referrerUri = encodeURIComponent(`${window.location.origin}/`);
  return `${authority}/account?referrer=${clientId}&referrer_uri=${referrerUri}`;
}

/** Landing page: title and the module menu. Descriptive content lives in the documentation module. */
export default function Home() {
  const auth = useAuth();
  const { roles } = useUserPermissions();
  const modules = visibleModules(roles);

  return (
    <PageLayout>
      <Container className="py-4">
        <Row className="text-center mb-4">
          <Col>
            <div style={{ fontSize: '3rem' }}>🐝</div>
            <h1 className="mb-2">Bienvenue sur Velutina</h1>
            <h5 className="text-primary fw-normal">
              Plateforme collaborative de surveillance du frelon asiatique
            </h5>
          </Col>
        </Row>

        <Row className="g-3 mb-5 justify-content-center">
          {modules.map((module) => (
            <Col key={module.id} sm={6} lg={3}>
              {module.id === 'account' ? (
                auth.isAuthenticated ? (
                  <ModuleCard
                    title={module.title}
                    description={module.description}
                    icon={module.icon}
                    href={accountConsoleUrl(auth.settings.authority, auth.settings.client_id)}
                  />
                ) : (
                  <ModuleCard
                    title="Se connecter"
                    description="Connectez-vous pour signaler et gérer vos données."
                    icon="bi-box-arrow-in-right"
                    onClick={() => void signInFromCurrentPage(auth)}
                  />
                )
              ) : (
                <ModuleCard
                  title={module.title}
                  description={module.description}
                  icon={module.icon}
                  to={module.path}
                  badge={module.badge}
                />
              )}
            </Col>
          ))}
        </Row>

        <Row className="text-center">
          <Col lg={8} className="mx-auto">
            <div className="d-flex flex-column flex-md-row align-items-center justify-content-center gap-3 mb-3">
              <img
                src="/vsab-logo-transparent.png"
                alt="Logo Vedrin s'abeille"
                style={{ maxWidth: '160px', height: 'auto' }}
              />
              <small className="text-muted">
                Une initiative de <b>Vedrin s'abeille</b> pour la protection de la biodiversité locale
              </small>
            </div>
            <small>
              <Link to="/privacy-policy" className="text-muted me-3">Politique de confidentialité</Link>
              <Link to="/data-deletion" className="text-muted">Suppression des données</Link>
            </small>
          </Col>
        </Row>
      </Container>
    </PageLayout>
  );
}
