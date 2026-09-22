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
        </Row>
      </Container>
    </PageLayout>
  );
}
