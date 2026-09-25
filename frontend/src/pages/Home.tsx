import { Container } from 'react-bootstrap';
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
      {/* Vedrin s'abeille logo, fixed behind the content */}
      <img src="/vsab-logo-transparent.png" alt="" aria-hidden="true" className="home-backdrop" />

      <Container className="pt-2 pb-4 position-relative">
        <div className="d-flex align-items-center justify-content-center gap-3 mb-3">
          <img src={APP_ICON} alt="" width={56} height={56} className="flex-shrink-0" />
          <div>
            <h1 className="h3 mb-0">Velutina</h1>
            <div className="text-primary">Gestion du frelon asiatique</div>
          </div>
        </div>

        <div className="tile-grid">
          {modules.map((module) => (
            module.id === 'account' ? (
              auth.isAuthenticated ? (
                <ModuleCard
                  key={module.id}
                  title={module.title}
                  description={module.description}
                  icon={module.icon}
                  href={accountConsoleUrl(auth.settings.authority, auth.settings.client_id)}
                />
              ) : (
                <ModuleCard
                  key={module.id}
                  title="Se connecter"
                  description="Connectez-vous pour signaler et gérer vos données."
                  icon="bi-box-arrow-in-right"
                  onClick={() => void signInFromCurrentPage(auth)}
                />
              )
            ) : (
              <ModuleCard
                key={module.id}
                title={module.title}
                description={module.description}
                icon={module.icon}
                to={module.path}
                badge={module.badge}
              />
            )
          ))}
        </div>

        <footer className="text-center small mt-3">
          <div className="text-muted mb-1">
            Une initiative de <b>Vedrin s'abeille</b> pour la protection de la biodiversité locale
          </div>
          <Link to="/privacy-policy" className="text-muted me-3">Politique de confidentialité</Link>
          <Link to="/data-deletion" className="text-muted">Suppression des données</Link>
        </footer>
      </Container>
    </PageLayout>
  );
}
