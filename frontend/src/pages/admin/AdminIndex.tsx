import { Container, Row, Col } from 'react-bootstrap';
import { PageLayout } from '../../components/layout';
import { ModuleCard } from '../../components/home';

/** Administration home: the referentials an admin maintains. */
export default function AdminIndex() {
  return (
    <PageLayout>
      <Container className="py-4">
        <h2 className="mb-1">Administration</h2>
        <p className="text-muted">Référentiels et paramètres de la plateforme.</p>

        <Row className="g-3 mt-2">
          <Col sm={6} lg={4}>
            <ModuleCard
              title="Types de pièges"
              description="Ajoutez, illustrez ou retirez les modèles de pièges proposés aux utilisateurs."
              icon="bi-bullseye"
              to="/admin/trap-types"
            />
          </Col>
          <Col sm={6} lg={4}>
            <ModuleCard
              title="Espèces"
              description="Tenez à jour les espèces proposées lors d'un constat de capture, et leur photo."
              icon="bi-bug"
              to="/admin/species"
            />
          </Col>
          <Col sm={6} lg={4}>
            <ModuleCard
              title="QR Codes"
              description="Suivez les QR Codes des pièges, leurs clés de signature, et révoquez ceux qui sont perdus ou compromis."
              icon="bi-qr-code"
              to="/admin/tags"
            />
          </Col>
          {import.meta.env.DEV && (
            <Col sm={6} lg={4}>
              <ModuleCard
                title="Internal mail server"
                description="Consultez tous les emails envoyés par l'environnement de développement (catch-all, rien n'est relayé)."
                icon="bi-envelope"
                href="/mail/"
                badge="DEV"
              />
            </Col>
          )}
        </Row>
      </Container>
    </PageLayout>
  );
}
