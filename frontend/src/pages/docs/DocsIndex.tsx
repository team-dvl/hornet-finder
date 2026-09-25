import { Container } from 'react-bootstrap';
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
        <div className="tile-grid">
          {documentedModules(roles).map((module) => (
              <ModuleCard
                key={module.id}
                title={module.title}
                description={module.description}
                icon={module.icon}
                to={`/docs/${module.id}`}
                badge={DOC_PAGES[module.id] ? undefined : 'À venir'}
              />
          ))}
        </div>
      </Container>
    </PageLayout>
  );
}
