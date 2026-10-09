import { useEffect } from 'react';
import { Button, Container } from 'react-bootstrap';
import PageLayout from './PageLayout';
import { useReachability } from '../../hooks/useReachability';
import { probe } from '../../utils/reachability';

/** Reloading also gets a lazy chunk again: React keeps the failure of a chunk that could not be fetched. */
const reload = () => window.location.reload();

function ReloadButton() {
  return (
    <Button variant="primary" className="icon-button" onClick={reload}>
      <i className="bi bi-arrow-clockwise me-2" aria-hidden="true" />
      Recharger
    </Button>
  );
}

/**
 * Screen of a page that failed while rendering, under the navbar so that the
 * user can go elsewhere. Asks whether the server is reachable: if not, that is
 * the likely cause (the banner under the navbar says so) and only the advice
 * is left to give.
 */
export function PageErrorFallback() {
  const { unreachable } = useReachability();

  useEffect(() => {
    void probe();
  }, []);

  return (
    <PageLayout>
      <Container className="d-flex flex-column align-items-center justify-content-center text-center gap-3 py-5">
        <h1 className="h5 mb-0">Cette page n’a pas pu s’afficher</h1>
        <p className="mb-0">
          {unreachable
            ? 'Veuillez réessayer plus tard.'
            : 'Le serveur a peut-être répondu de façon inattendue. Veuillez réessayer, plus tard si cela persiste.'}
        </p>
        <ReloadButton />
      </Container>
    </PageLayout>
  );
}

/**
 * Last resort, around the whole app: the navbar needs the router and the
 * session, which may be what failed, so this screen relies on neither.
 */
export function RootErrorFallback() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center gap-3 p-4 vh-100">
      <h1 className="h5 mb-0">Une erreur est survenue</h1>
      <p className="mb-0">Veuillez recharger l’application, plus tard si cela persiste.</p>
      <ReloadButton />
    </div>
  );
}
