import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, ButtonGroup, Container, Spinner } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { PageHeader, PageLayout } from '../components/layout';
import { ApiariesTabs } from '../components/apiaries';
import { VisitFormModal, VisitListItem, VisitSheet } from '../components/visits';
import { IconButton } from '../components/ui';
import { usePendingCounts } from '../hooks/usePendingCounts';
import { signInFromCurrentPage } from '../utils/authRedirect';
import { refreshPending } from '../utils/pending';
import { ACTION_ICONS } from '../utils/icons';
import { apiaryLabel, hiveErrorOf } from '../utils/hivesApi';
import { fetchVisits, type Visit } from '../utils/visitsApi';

// FullCalendar stays out of the page until the calendar is shown
const VisitCalendar = lazy(() => import('../components/visits/VisitCalendar'));

/**
 * The visits of the apiaries, in two views: those to come (« À venir », the
 * planned ones, soonest first, late ones on top) and the journal (those that
 * took place, newest first, `?view=journal`). `?apiary=<id>` keeps those of
 * one apiary, `?visit=<id>` opens a sheet, `?add=1` (with `apiary`) the form
 * of a new visit, `?plan=1` that of a planned one.
 */
export default function Visits() {
  const auth = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const apiaryId = Number(searchParams.get('apiary')) || undefined;
  const requestedView = searchParams.get('view');
  const view: 'agenda' | 'calendar' | 'journal' = requestedView === 'journal' || requestedView === 'calendar'
    ? requestedView : 'agenda';
  const waiting = usePendingCounts().apiaries ?? 0;

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
  const reload = () => { setPage(1); setVersion((value) => value + 1); refreshPending(); };

  useEffect(() => {
    if (!auth.isAuthenticated || view === 'calendar') return;
    let cancelled = false;
    fetchVisits({ ...(apiaryId ? { apiary: apiaryId } : {}), status: view === 'agenda' ? 'planned' : 'done', page })
      .then((found) => {
        if (cancelled) return;
        setVisits((current) => (page === 1 || !current ? found.results : [...current, ...found.results]));
        setCount(found.count);
        setError(null);
      })
      .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [auth.isAuthenticated, apiaryId, view, page, version]);

  // `?visit=<id>` and `?add=1`: one-off requests, dropped once read
  const [sheetId, setSheetId] = useState<string | null>(() => searchParams.get('visit'));
  const [adding, setAdding] = useState<'record' | 'plan' | null>(() => (
    searchParams.get('add') ? 'record' : searchParams.get('plan') ? 'plan' : null));
  // The day tapped in the calendar: 9 h that day
  const [addingAt, setAddingAt] = useState<string | undefined>(undefined);
  useEffect(() => {
    for (const key of ['visit', 'add', 'plan']) {
      if (searchParams.get(key)) setParam(key, null);
    }
  }, [searchParams, setParam]);

  const showView = (next: 'agenda' | 'calendar' | 'journal') => {
    if (next === view) return;
    setVisits(null);
    setPage(1);
    setParam('view', next === 'agenda' ? null : next);
  };

  const shown = visits?.find((visit) => visit.apiary?.id === apiaryId)?.apiary;
  const where = shown ? apiaryLabel(shown) : `Rucher #${apiaryId}`;

  return (
    <PageLayout>
      <Container className="pb-5">
        <PageHeader
          title="Visites"
          help="Les visites prévues de vos ruchers, et le journal de ce qui a été fait et vu à chaque visite."
          actions={auth.isAuthenticated && (view !== 'journal'
            ? <IconButton variant="primary" icon="calendar-plus" label="Prévoir" onClick={() => setAdding('plan')} />
            : <IconButton variant="primary" icon={ACTION_ICONS.add} label="Ajouter" onClick={() => setAdding('record')} />
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

            <ButtonGroup className="d-flex mb-3 visit-view-switch" role="tablist" aria-label="Visites">
              <Button variant={view === 'agenda' ? 'secondary' : 'outline-secondary'} role="tab"
                aria-selected={view === 'agenda'} onClick={() => showView('agenda')}>
                À venir
                {waiting > 0 && <Badge pill bg="danger" className="ms-1" aria-label={`${waiting} à faire`}>{waiting}</Badge>}
              </Button>
              <Button variant={view === 'calendar' ? 'secondary' : 'outline-secondary'} role="tab"
                aria-selected={view === 'calendar'} onClick={() => showView('calendar')}>
                Calendrier
              </Button>
              <Button variant={view === 'journal' ? 'secondary' : 'outline-secondary'} role="tab"
                aria-selected={view === 'journal'} onClick={() => showView('journal')}>
                Journal
              </Button>
            </ButtonGroup>

            {view === 'calendar' && (
              <Suspense fallback={<Spinner animation="border" role="status" />}>
                <VisitCalendar
                  apiaryId={apiaryId}
                  version={version}
                  onOpen={(id) => setSheetId(id)}
                  onDay={(day, past) => { setAddingAt(`${day}T09:00`); setAdding(past ? 'record' : 'plan'); }}
                />
              </Suspense>
            )}

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

            {view !== 'calendar' && (
              <>
            {error && <Alert variant="danger">{error}</Alert>}
            {!visits && !error && <Spinner animation="border" role="status" />}
            {visits?.length === 0 && (
              <div className="text-center text-muted py-5">
                <i className={`bi ${view === 'agenda' ? 'bi-calendar-event' : 'bi-journal-text'} hive-icon display-6 d-block`} aria-hidden="true" />
                {view === 'agenda' ? 'Aucune visite prévue.' : 'Aucune visite enregistrée.'}
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
          </>
        )}
      </Container>

      {sheetId && (
        <VisitSheet key={sheetId} visitId={sheetId} onHide={() => setSheetId(null)} onChanged={reload} />
      )}

      {adding && (
        <VisitFormModal
          apiaryId={apiaryId ?? null}
          mode={adding}
          startAt={addingAt}
          onHide={() => { setAdding(null); setAddingAt(undefined); }}
          onSaved={(saved) => { setAdding(null); setAddingAt(undefined); reload(); setSheetId(saved.id); }}
        />
      )}
    </PageLayout>
  );
}
