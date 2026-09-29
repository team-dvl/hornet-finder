import { useEffect, useRef } from 'react';
import { Container, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { PageHeader, PageLayout } from '../components/layout';
import { PendingInvitations } from '../components/home';
import { signInFromCurrentPage } from '../utils/authRedirect';

/**
 * Target of the link in the invitation emails: signs the visitor in first
 * (Keycloak, then back here), so the invitation is always there to answer.
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

  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader title="Invitations" help="Vos invitations à rejoindre un groupe d'apiculteurs." />
        {signedIn ? (
          <PendingInvitations
            emptyMessage={<p className="text-muted">Aucune invitation en attente pour ce compte.</p>}
          />
        ) : (
          <div className="d-flex align-items-center gap-2 text-muted">
            <Spinner animation="border" size="sm" role="status" />
            Connexion…
          </div>
        )}
      </Container>
    </PageLayout>
  );
}
