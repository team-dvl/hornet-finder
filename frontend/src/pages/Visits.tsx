import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Container, Spinner } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { PageHeader, PageLayout } from '../components/layout';
import { ApiariesTabs } from '../components/apiaries';
import { VisitFormModal, VisitListItem, VisitSheet } from '../components/visits';
import { IconButton } from '../components/ui';
import { signInFromCurrentPage } from '../utils/authRedirect';
import { ACTION_ICONS } from '../utils/icons';
import { hiveErrorOf } from '../utils/hivesApi';
import { fetchVisits, type Visit } from '../utils/visitsApi';

/**
 * The journal of the apiaries: the visits the user may see, newest first.
 * `?apiary=<id>` keeps those of one apiary, `?visit=<id>` opens a sheet,
 * `?add=1` (with `apiary`) the form of a new visit.
 */
export default function Visits() {
  const auth = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const apiaryId = Number(searchParams.get('apiary')) || undefined;

  const setParam = useCallback((key: string, value: string | null) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = () => { setPage(1); setVersion((value) => value + 1); };

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    fetchVisits({ ...(apiaryId ? { apiary: apiaryId } : {}), page })
      .then((found) => {
        if (cancelled) return;
        setVisits((current) => (page === 1 || !current ? found.results : [...current, ...found.results]));
        setCount(found.count);
        setError(null);
      })
      .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [auth.isAuthenticated, apiaryId, page, version]);

  // `?visit=<id>` and `?add=1`: one-off requests, dropped once read
  const [sheetId, setSheetId] = useState<string | null>(() => searchParams.get('visit'));
  const [adding, setAdding] = useState(() => Boolean(searchParams.get('add')));
  useEffect(() => {
    if (searchParams.get('visit')) setParam('visit', null);
    if (searchParams.get('add')) setParam('add', null);
  }, [searchParams, setParam]);

  const where = visits?.find((visit) => visit.apiary?.id === apiaryId)?.apiary?.address || `Rucher #${apiaryId}`;

  return (
    <PageLayout>
      <Container className="pb-5">
        <PageHeader
          title="Visites"
          help="Le journal de vos ruchers : ce qui a été fait et vu à chaque visite."
          actions={auth.isAuthenticated && (
            <IconButton variant="primary" icon={ACTION_ICONS.add} label="Ajouter" onClick={() => setAdding(true)} />
          )}
        />

        {!auth.isAuthenticated ? (
          <Alert variant="info">
            {auth.isLoading ? <Spinner animation="border" size="sm" /> : (
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="flex-grow-1">Connectez-vous pour tenir le journal de vos ruchers.</span>
                <Button onClick={() => void signInFromCurrentPage(auth)}>Connexion</Button>
              </div>
            )}
          </Alert>
        ) : (
          <>
            <ApiariesTabs active="visits" />

            {apiaryId && (
              <Button
                variant="outline-secondary"
                className="mb-3 mw-100 d-inline-flex align-items-center gap-2"
                onClick={() => { setParam('apiary', null); reload(); }}
                aria-label={`Retirer le filtre : ${where}`}
              >
                <i className="bi bi-geo-alt flex-shrink-0" aria-hidden="true" />
                <span className="text-truncate">{where}</span>
                <i className="bi bi-x-lg flex-shrink-0" aria-hidden="true" />
              </Button>
            )}

            {error && <Alert variant="danger">{error}</Alert>}
            {!visits && !error && <Spinner animation="border" role="status" />}
            {visits?.length === 0 && (
              <div className="text-center text-muted py-5">
                <i className="bi bi-journal-text hive-icon display-6 d-block" aria-hidden="true" />
                Aucune visite enregistrée.
              </div>
            )}

            <div className="list-group">
              {visits?.map((visit) => (
                <VisitListItem key={visit.id} visit={visit} inApiary={Boolean(apiaryId)} onOpen={(item) => setSheetId(item.id)} />
              ))}
            </div>

            {visits && visits.length < count && (
              <div className="text-center mt-3">
                <Button variant="outline-secondary" disabled={loading}
                  onClick={() => { setLoading(true); setPage((value) => value + 1); }}>
                  {loading ? <Spinner animation="border" size="sm" /> : 'Afficher plus'}
                </Button>
              </div>
            )}
          </>
        )}
      </Container>

      {sheetId && (
        <VisitSheet key={sheetId} visitId={sheetId} onHide={() => setSheetId(null)} onChanged={reload} />
      )}

      {adding && (
        <VisitFormModal
          apiaryId={apiaryId ?? null}
          onHide={() => setAdding(false)}
          onSaved={(saved) => { setAdding(false); reload(); setSheetId(saved.id); }}
        />
      )}
    </PageLayout>
  );
}
