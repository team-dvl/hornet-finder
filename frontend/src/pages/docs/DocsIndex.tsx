import { Container, Row, Col } from 'react-bootstrap';
import { PageHeader, PageLayout } from '../../components/layout';
import { ModuleCard } from '../../components/home';
import { documentedModules } from '../../config/modules';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { DOC_PAGES } from './registry';

/** Documentation entry point: one tile per module the user can open. */
export default function DocsIndex() {
  const { roles } = useUserPermissions();

  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader title="Documentation" />
        <Row className="g-2 g-sm-3">
          {documentedModules(roles).map((module) => (
            <Col key={module.id} xs={6} md={4}>
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
