import { Container, Row, Col } from 'react-bootstrap';
import { PageLayout } from '../../components/layout';
import { ModuleCard } from '../../components/home';
import { DOCUMENTED_MODULES } from '../../config/modules';
import { DOC_PAGES } from './registry';

/** Documentation entry point: one tile per module. */
export default function DocsIndex() {
  return (
    <PageLayout>
      <Container className="py-4">
        <h2 className="mb-4 text-center">Documentation</h2>
        <Row className="g-3 justify-content-center">
          {DOCUMENTED_MODULES.map((module) => (
            <Col key={module.id} md={4}>
              <ModuleCard
                title={module.title}
                description={module.description}
                icon={module.icon}
                to={`/docs/${module.id}`}
                badge={DOC_PAGES[module.id] ? undefined : 'À venir'}
              />
            </Col>
          ))}
        </Row>
      </Container>
    </PageLayout>
  );
}
