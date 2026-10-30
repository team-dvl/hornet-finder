import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Container, Form, InputGroup, Spinner } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { PageHeader, PageLayout } from '../components/layout';
import { ApiariesTabs } from '../components/apiaries';
import { HiveFormModal, HiveListItem, HiveSheet } from '../components/hives';
import { IconButton } from '../components/ui';
import { signInFromCurrentPage } from '../utils/authRedirect';
import { ACTION_ICONS } from '../utils/icons';
import {
  apiaryLabel, fetchHive, fetchHives, hiveErrorOf, type Hive, type HiveQuery, type HiveStatus,
} from '../utils/hivesApi';

const STATUSES: { value: '' | HiveStatus | 'all'; label: string }[] = [
  { value: '', label: 'En service et remisées' },
  { value: 'active', label: 'En service' },
  { value: 'stored', label: 'Remisées' },
  { value: 'retired', label: 'Réformées' },
  { value: 'all', label: 'Toutes' },
];

/**
 * The hives the user keeps, owns, or sees through an association or an
 * apiary, wherever they stand. The filters live in the address:
 * `?apiary=<id>` keeps the hives of one apiary, `?hive=<id>` opens a sheet,
 * `?add=1` (with `apiary`) the form of a new hive.
 */
export default function Hives() {
  const auth = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const apiaryId = Number(searchParams.get('apiary')) || undefined;
  const statusParam = searchParams.get('status') ?? '';
  const status = STATUSES.some((option) => option.value === statusParam) ? statusParam : '';
  const q = searchParams.get('q') ?? '';
  const query = useMemo<HiveQuery>(() => ({
    ...(apiaryId ? { apiary: apiaryId } : {}),
    ...(status ? { status: status as HiveQuery['status'] } : {}),
    ...(q ? { q } : {}),
  }), [apiaryId, status, q]);

  const setParam = useCallback((key: string, value: string | null) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const [hives, setHives] = useState<Hive[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((value) => value + 1);
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    fetchHives(JSON.parse(queryKey) as HiveQuery)
      .then((found) => { if (!cancelled) { setHives(found); setError(null); } })
      .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); });
    return () => { cancelled = true; };
  }, [auth.isAuthenticated, queryKey, version]);

  // Typed text is sent once the user pauses, not on every key
  const [search, setSearch] = useState(q);
  useEffect(() => {
    if (search === q) return;
    const timer = window.setTimeout(() => setParam('q', search.trim() || null), 350);
    return () => window.clearTimeout(timer);
  }, [search, q, setParam]);

  // --- Dialogs (one at a time) -----------------------------------------------
  const [sheetHive, setSheetHive] = useState<Hive | null>(null);
  // `?add=1`: the page is opened to add a hive (from the sheet of an apiary)
  const [adding, setAdding] = useState(() => Boolean(searchParams.get('add')));
  const [linkError, setLinkError] = useState<string | null>(null);

  // `?hive=<id>` and `?add=1`: one-off requests, dropped once handled
  const requestedHive = searchParams.get('hive');
  const requestedAdd = searchParams.get('add');
  useEffect(() => {
    if (requestedAdd) setParam('add', null);
  }, [requestedAdd, setParam]);
  useEffect(() => {
    if (!auth.isAuthenticated || !requestedHive) return;
    let cancelled = false;
    fetchHive(requestedHive)
      .then((found) => { if (!cancelled) setSheetHive(found); })
      .catch((fetchError) => { if (!cancelled) setLinkError(hiveErrorOf(fetchError)); })
      .finally(() => { if (!cancelled) setParam('hive', null); });
    return () => { cancelled = true; };
  }, [auth.isAuthenticated, requestedHive, setParam]);

  // The apiary the list is narrowed to, as its hives describe it
  const apiaryName = useMemo(() => {
    const found = hives?.find((hive) => hive.apiary?.id === apiaryId)?.apiary;
    return found ? apiaryLabel(found) : `Rucher #${apiaryId}`;
  }, [hives, apiaryId]);

  const filtered = Boolean(q || status || apiaryId);

  return (
    <PageLayout>
      <Container className="pb-5">
        <PageHeader
          title="Ruches"
          help="Vos ruches et celles de vos associations, où qu'elles soient."
          actions={auth.isAuthenticated && (
            <IconButton variant="primary" icon={ACTION_ICONS.add} label="Ajouter" onClick={() => setAdding(true)} />
          )}
        />

        {!auth.isAuthenticated ? (
          <Alert variant="info">
            {auth.isLoading ? <Spinner animation="border" size="sm" /> : (
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="flex-grow-1">Connectez-vous pour gérer vos ruches.</span>
                <Button onClick={() => void signInFromCurrentPage(auth)}>Connexion</Button>
              </div>
            )}
          </Alert>
        ) : (
          <>
            <ApiariesTabs active="hives" />

            <div className="manager-list-toolbar mb-3">
              <InputGroup className="mb-2">
                <InputGroup.Text><i className="bi bi-search" aria-hidden="true" /></InputGroup.Text>
                <Form.Control
                  type="search"
                  placeholder="Nom ou n°"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Rechercher une ruche"
                />
              </InputGroup>
              <Form.Select
                value={status}
                onChange={(event) => setParam('status', event.target.value || null)}
                aria-label="Ruches affichées"
              >
                {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Form.Select>
              {apiaryId && (
                <Button
                  variant="outline-secondary"
                  className="mt-2 mw-100 d-inline-flex align-items-center gap-2"
                  onClick={() => setParam('apiary', null)}
                  aria-label={`Retirer le filtre : ${apiaryName}`}
                >
                  <i className="bi bi-geo-alt flex-shrink-0" aria-hidden="true" />
                  <span className="text-truncate">{apiaryName}</span>
                  <i className="bi bi-x-lg flex-shrink-0" aria-hidden="true" />
                </Button>
              )}
            </div>

            {linkError && <Alert variant="danger" dismissible onClose={() => setLinkError(null)}>{linkError}</Alert>}
            {error && <Alert variant="danger">{error}</Alert>}
            {!hives && !error && <Spinner animation="border" role="status" />}

            {hives?.length === 0 && (
              <div className="text-center text-muted py-5">
                <i className="bi bi-hexagon-half hive-icon display-6 d-block" aria-hidden="true" />
                {filtered ? 'Aucune ruche ne correspond à ces critères.' : "Vous n'avez pas encore de ruche."}
              </div>
            )}

            <div className="list-group">
              {hives?.map((hive) => (
                <HiveListItem key={hive.id} hive={hive} inApiary={Boolean(apiaryId)} onOpen={setSheetHive} />
              ))}
            </div>
          </>
        )}
      </Container>

      {sheetHive && (
        <HiveSheet
          key={sheetHive.id}
          hive={sheetHive}
          onHide={() => setSheetHive(null)}
          onChanged={reload}
        />
      )}

      {adding && (
        <HiveFormModal
          apiaryId={apiaryId ?? null}
          onHide={() => setAdding(false)}
          onSaved={(saved) => { reload(); setSheetHive(saved); }}
        />
      )}
    </PageLayout>
  );
}
