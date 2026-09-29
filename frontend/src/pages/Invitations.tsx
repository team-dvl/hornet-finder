import { useEffect, useRef } from 'react';
import { Container, Spinner } from 'react-bootstrap';
import { Navigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { PageLayout } from '../components/layout';
import { signInFromCurrentPage } from '../utils/authRedirect';

/**
 * Target of the link in the invitation emails: signs the visitor in first
 * (Keycloak, then back here), then hands over to the landing page, whose
 * banner offers the pending invitations.
 */
export default function Invitations() {
  const auth = useAuth();
  const signedIn = auth.isAuthenticated && Boolean(auth.user);
  // Not while a sign-in is under way or has just failed: App shows those states
  const mustSignIn = !auth.isLoading && !signedIn && !auth.activeNavigator && !auth.error;
  const redirecting = useRef(false);

  useEffect(() => {
    if (!mustSignIn || redirecting.current) return;
    redirecting.current = true;
    void signInFromCurrentPage(auth);
  }, [mustSignIn, auth]);

  if (signedIn) return <Navigate to="/" replace />;

  return (
    <PageLayout>
      <Container className="py-4">
        <div className="d-flex align-items-center gap-2 text-muted">
          <Spinner animation="border" size="sm" role="status" />
          Connexion…
        </div>
      </Container>
    </PageLayout>
  );
}
