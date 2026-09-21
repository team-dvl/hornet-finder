import { Row, Col } from 'react-bootstrap';

/** User documentation of the nest-finding module. */
export default function NestsDoc() {
  return (
    <>
      <p className="lead text-muted">
        Rejoignez la communauté citoyenne dans la lutte
        contre <em><a href="https://fr.wikipedia.org/wiki/Vespa_velutina" target="_blank" rel="noopener">Vespa Velutina</a></em> pour protéger nos pollinisateurs.
      </p>

      <Row className="my-4">
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

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">ℹ️</span>
          Qui peut utiliser ce module ?
        </h5>
        <ul className="mb-0">
          <li><strong>Bénévoles :</strong> Signalement d'observations de frelons</li>
          <li><strong>Apiculteurs :</strong> Gestion des ruchers et signalements</li>
          <li><strong>Administrateurs :</strong> Vue d'ensemble et coordination</li>
        </ul>
      </section>

      <section>
        <h5 className="text-primary">Accès</h5>
        <p className="mb-0">
          La consultation de la carte est libre ; le signalement nécessite une authentification
          pour garantir la qualité des données.
          <br />
          Apiculteurs : contactez-nous via <a href="mailto:vedrinsabeille@gmail.com">vedrin.sabeille@gmail.com</a> pour un accès privilégié.
        </p>
      </section>
    </>
  );
}
