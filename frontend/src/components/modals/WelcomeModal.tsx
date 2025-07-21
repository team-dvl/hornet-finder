import { Modal, Button, Container, Row, Col } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';

interface WelcomeModalProps {
  show: boolean;
  onHide: () => void;
}

export default function WelcomeModal({ show, onHide }: WelcomeModalProps) {
  const auth = useAuth();

  const handleLogin = () => {
    auth.signinRedirect();
  };

  return (
    <Modal 
      show={show} 
      onHide={onHide} 
      size="lg" 
      centered
      backdrop="static"
      keyboard={false}
    >
      <Modal.Header className="bg-primary text-white text-center">
        <Modal.Title className="w-100 text-center">
          <span style={{ fontSize: '2rem' }}>🐝</span>
          <br />
          Bienvenue sur Velutina
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="p-4">
        <Container>
          <Row className="text-center mb-4">
            <Col>
              <h4 className="text-primary mb-3">
                Plateforme collaborative de surveillance du frelon asiatique
              </h4>
              <p className="lead text-muted">
                Rejoignez la communauté citoyenne dans la lutte 
                contre <em><a href="https://fr.wikipedia.org/wiki/Vespa_velutina" target='_blank'>Vespa Velutina</a></em> pour protéger nos pollinisateurs.
              </p>
            </Col>
          </Row>

          <Row className="mb-4">
            <Col md={4} className="text-center mb-3">
              <div style={{ fontSize: '3rem', color: '#ffc107' }}>🔍</div>
              <h6 className="mt-2">Observer</h6>
              <p className="small text-muted">
                Signalez les frelons asiatiques que vous observez
              </p>
            </Col>
            <Col md={4} className="text-center mb-3">
              <div style={{ fontSize: '3rem', color: '#28a745' }}>🗺️</div>
              <h6 className="mt-2">Cartographier</h6>
              <p className="small text-muted">
                Visualisez les zones d'activité sur une carte interactive
              </p>
            </Col>
            <Col md={4} className="text-center mb-3">
              <div style={{ fontSize: '3rem', color: '#dc3545' }}>⚡</div>
              <h6 className="mt-2">Agir</h6>
              <p className="small text-muted">
                Repérez les nids et informez les apiculteurs locaux pour une destruction rapide
              </p>
            </Col>
          </Row>

          <Row className="mb-4">
            <Col>
              <div className="bg-light p-3 rounded">
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

          <Row className="text-center">
            <Col>
              <p className="text-muted small mb-3">
                Cette plateforme nécessite une authentification pour garantir la qualité des données.
                <br />
                Apiculteurs: Contactez-nous via <a href="mailto:vedrinsabeille@gmail.com">vedrin.sabeille@gmail.com</a> pour un accès privilégié.
              </p>
              <div className="d-grid gap-2 d-md-flex justify-content-md-center">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleLogin}
                  className="px-4 me-md-2"
                >
                  <span className="me-2">🔐</span>
                  Se connecter
                </Button>
                <Button
                  variant="outline-secondary"
                  size="lg"
                  onClick={onHide}
                  className="px-4"
                >
                  Parcourir en mode lecture
                </Button>
              </div>
            </Col>
          </Row>
        </Container>
      </Modal.Body>
      
      <Modal.Footer className="bg-light text-center justify-content-center">
        <div className="d-flex align-items-center justify-content-center">
          <img 
            src="/vsab-logo-transparent.png" 
            alt="Logo Vedrin s'abeille" 
            style={{ width: '40%', height: 'auto', marginRight: '12px' }}
          />
          <small className="text-muted">
            Une initiative de <b>Vedrin s'abeille</b> pour la protection de la biodiversité locale
          </small>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
