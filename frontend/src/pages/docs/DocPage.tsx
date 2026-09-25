import { Container } from 'react-bootstrap';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PageLayout } from '../../components/layout';
import { findModule } from '../../config/modules';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { DOC_PAGES } from './registry';

/** Documentation of one module (`/docs/:moduleId`). */
export default function DocPage() {
  const { moduleId = '' } = useParams();
  const { roles } = useUserPermissions();
  const module = findModule(moduleId);
  // A module the user has no access to must not even be named here
  const allowed = module
    && (!module.requiredRoles || module.requiredRoles.some((role) => roles.includes(role)));
  if (!allowed) {
    return <Navigate to="/docs" replace />;
  }

  const Doc = DOC_PAGES[module.id];

  return (
    <PageLayout>
      <Container className="py-4">
        <div className="col-lg-8 mx-auto">
          <h2 className="h3 mb-4 d-none d-sm-block">
            <i className={`bi ${module.icon} text-primary me-2`} aria-hidden="true" />
            {module.title}
          </h2>
          {Doc ? (
            <Doc />
          ) : (
            <p className="lead text-muted">Documentation à venir.</p>
          )}
          <div className="mt-5">
            <Link to="/docs" className="btn btn-outline-secondary">
              ← Toute la documentation
            </Link>
          </div>
        </div>
      </Container>
    </PageLayout>
  );
}
