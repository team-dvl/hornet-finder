import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { PageLayout } from '../components/layout';

/** Placeholder for the trap management module (not implemented yet). */
export default function Traps() {
  return (
    <PageLayout>
      <Container className="py-5 text-center">
        <i className="bi bi-bullseye fs-1 text-primary" aria-hidden="true" />
        <h2 className="mt-3">Gestion des pièges</h2>
        <p className="lead text-muted">Bientôt disponible</p>
        <Link to="/" className="btn btn-outline-secondary mt-3">
          ← Retour à l'accueil
        </Link>
      </Container>
    </PageLayout>
  );
}
