import { Container, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { PageLayout } from '../components/layout';
import { ModuleCard } from '../components/home';
import { MODULES } from '../config/modules';
import { signInFromCurrentPage } from '../utils/authRedirect';

/** Keycloak account console URL, with a "back to application" link pointing at the landing page. */
function accountConsoleUrl(authority: string, clientId: string): string {
  const referrerUri = encodeURIComponent(`${window.location.origin}/`);
  return `${authority}/account?referrer=${clientId}&referrer_uri=${referrerUri}`;
}

export default function Home() {
  const auth = useAuth();
  const signIn = () => void signInFromCurrentPage(auth);

  return (
    <PageLayout>
      <Container className="py-4">
        {/* Hero */}
        <Row className="text-center mb-4">
          <Col lg={8} className="mx-auto">
            <div style={{ fontSize: '3rem' }}>🐝</div>
            <h1 className="mb-3">Bienvenue sur Velutina</h1>
            <h4 className="text-primary mb-3">
              Plateforme collaborative de surveillance du frelon asiatique
            </h4>
            <p className="lead text-muted">
              Rejoignez la communauté citoyenne dans la lutte
              contre <em><a href="https://fr.wikipedia.org/wiki/Vespa_velutina" target="_blank" rel="noopener">Vespa Velutina</a></em> pour protéger nos pollinisateurs.
            </p>
          </Col>
        </Row>

        {/* Module menu */}
        <Row className="g-3 mb-5 justify-content-center">
          {MODULES.map((module) => {
            if (module.id === 'account') {
              return (
                <Col key={module.id} md={4}>
                  {auth.isAuthenticated ? (
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
                      onClick={signIn}
                    />
                  )}
                </Col>
              );
            }
            return (
              <Col key={module.id} md={4}>
                <ModuleCard
                  title={module.title}
                  description={module.description}
                  icon={module.icon}
                  to={module.path}
                  badge={module.badge}
                />
              </Col>
            );
          })}
        </Row>

        {/* What you can do */}
        <Row className="mb-4">
          <Col md={4} className="text-center mb-3">
            <div style={{ fontSize: '3rem' }}>🔍</div>
            <h6 className="mt-2">Observer</h6>
            <p className="small text-muted">
              Signalez les frelons asiatiques que vous observez
            </p>
          </Col>
          <Col md={4} className="text-center mb-3">
            <div style={{ fontSize: '3rem' }}>🗺️</div>
            <h6 className="mt-2">Cartographier</h6>
            <p className="small text-muted">
              Visualisez les zones d'activité sur une carte interactive
            </p>
          </Col>
          <Col md={4} className="text-center mb-3">
            <div style={{ fontSize: '3rem' }}>⚡</div>
            <h6 className="mt-2">Agir</h6>
            <p className="small text-muted">
              Repérez les nids et informez les apiculteurs locaux pour une destruction rapide
            </p>
          </Col>
        </Row>

        {/* Who can use it */}
        <Row className="mb-4">
          <Col lg={8} className="mx-auto">
            <div className="bg-white border rounded p-3">
              <h6 className="text-primary mb-2">
                <span className="me-2">ℹ️</span>
                Qui peut utiliser cette plateforme ?
              </h6>
              <ul className="mb-0 small">
                <li><strong>Bénévoles :</strong> Signalement d'observations de frelons</li>
                <li><strong>Apiculteurs :</strong> Gestion des ruchers et signalements</li>
                <li><strong>Administrateurs :</strong> Vue d'ensemble et coordination</li>
              </ul>
            </div>
          </Col>
        </Row>

        {/* Contact / sign in */}
        <Row className="text-center mb-5">
          <Col lg={8} className="mx-auto">
            <p className="text-muted small mb-3">
              Cette plateforme nécessite une authentification pour garantir la qualité des données.
              <br />
              Apiculteurs : contactez-nous via <a href="mailto:vedrinsabeille@gmail.com">vedrin.sabeille@gmail.com</a> pour un accès privilégié.
            </p>
            {!auth.isAuthenticated && (
              <Button variant="primary" size="lg" onClick={signIn} className="px-4">
                <span className="me-2">🔐</span>
                Se connecter
              </Button>
            )}
          </Col>
        </Row>

        {/* Footer */}
        <Row className="text-center">
          <Col lg={8} className="mx-auto">
            <div className="d-flex flex-column flex-md-row align-items-center justify-content-center gap-3 mb-3">
              <img
                src="/vsab-logo-transparent.png"
                alt="Logo Vedrin s'abeille"
                style={{ maxWidth: '200px', height: 'auto' }}
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
