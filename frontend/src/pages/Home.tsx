import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { PageLayout } from '../components/layout';
import { ModuleCard } from '../components/home';
import { visibleModules } from '../config/modules';
import { accountConsoleUrl, signInFromCurrentPage } from '../utils/authRedirect';
import { useUserPermissions } from '../hooks/useUserPermissions';

/** App icon, the dev one (purple outline) on the dev server, as for the installed PWA. */
const APP_ICON = import.meta.env.DEV ? '/icons/pwa-dev-192x192.png' : '/icons/pwa-192x192.png';

/** Landing page: title and the module menu. Descriptive content lives in the documentation module. */
export default function Home() {
  const auth = useAuth();
  const { roles } = useUserPermissions();
  const modules = visibleModules(roles);

  return (
    <PageLayout>
      <Container className="py-4">
        <div className="d-flex align-items-center justify-content-center gap-3 mb-3 mb-sm-4">
          <img src={APP_ICON} alt="" width={56} height={56} className="flex-shrink-0" />
          <div>
            <h1 className="h3 mb-0">Velutina</h1>
            <div className="text-primary small">Surveillance collaborative du frelon asiatique</div>
          </div>
        </div>

        <Row className="g-2 g-sm-3 mb-5 justify-content-center">
          {modules.map((module) => (
            <Col key={module.id} xs={6} lg={3}>
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
