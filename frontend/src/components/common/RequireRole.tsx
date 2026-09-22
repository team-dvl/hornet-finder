import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Container, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useUserPermissions } from '../../hooks/useUserPermissions';

interface RequireRoleProps {
  /** Realm roles allowed through; holding any one of them is enough */
  roles: string[];
  children: ReactNode;
}

/**
 * Route guard: sends users without the required role back to the landing page.
 * The backend enforces the same rules, this only avoids showing a screen that
 * would answer 403 to everything.
 */
export default function RequireRole({ roles, children }: RequireRoleProps) {
  const auth = useAuth();
  const { roles: userRoles } = useUserPermissions();

  if (auth.isLoading) {
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" role="status" />
      </Container>
    );
  }

  if (!roles.some((role) => userRoles.includes(role))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
