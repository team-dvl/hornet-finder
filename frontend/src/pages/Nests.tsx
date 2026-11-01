import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, ButtonGroup, Container, Form, Spinner } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { PageHeader, PageLayout } from '../components/layout';
import { mapUrl } from '../components/map/viewModes';
import {
  ChipChoice, NestActionsSheet, NestEventModal, NestListItem, NestOwnerModal, ReportNestSheet,
} from '../components/nests';
import AddNestPopup from '../components/popups/AddNestPopup';
import NestInfoPopup from '../components/popups/NestInfoPopup';
import { HelpTip } from '../components/common';
import { IconButton } from '../components/ui';
import { useUserPermissions } from '../hooks/useUserPermissions';
import { useAppDispatch } from '../store/hooks';
import { fetchNestDetail, type Nest, type NestStatus } from '../store/store';
import { signInFromCurrentPage } from '../utils/authRedirect';
import { ACTION_ICONS, OBJECT_ICONS } from '../utils/icons';
import {
  fetchManagedNests, fetchNestTodo, type ManagedNestsQuery, type NestOrdering, type NestScope, type NestTodo,
} from '../utils/nestsApi';
import { isOpenStatus } from '../utils/nestStatus';
import { refreshPending } from '../utils/pending';

const TODO_PATH = '/nests';
const LIST_PATH = '/nests/list';

const STATUS_FILTERS: { value: NestStatus | 'open'; label: string }[] = [
  { value: 'open', label: 'En cours' },
  { value: 'destroyed', label: 'Neutralisés' },
  { value: 'rejected', label: 'Écartés' },
  { value: 'abandoned', label: 'Abandonnés' },
];
const ORDERINGS: { value: NestOrdering; label: string }[] = [
  { value: '-created_at', label: 'Plus récents' },
  { value: 'created_at', label: 'Plus anciens' },
  { value: '-last_event_at', label: 'Dernière action' },
];

/** Sections of "À traiter", in this order; `mine` keeps the open nests only there */
const TODO_SECTIONS: { key: keyof NestTodo; title: string }[] = [
  { key: 'to_verify', title: 'À vérifier' },
  { key: 'confirmed', title: 'Confirmés, à neutraliser' },
  { key: 'near_apiaries', title: 'Près de mes ruchers' },
  { key: 'mine', title: 'Mes signalements en cours' },
];

type EventDialog = { nest: Nest & { id: number }; kind: 'visit' | 'destruction' };

/**
 * Nests module, for the season under way. Those who see every nest (hunters,
 * beekeepers, admins) land on "À traiter" — what waits for them: nests to
 * verify or to destroy (coordinators), nests near their apiaries, their own
 * reports still open — and find every nest of the season in "Nids". Someone
 * who only reports (a trapper) sees their reports and how they stand. The
 * map opens from the header, or on one nest with "Voir sur la carte".
 *
 * `?nest=<id>` (a notification) opens the sheet of that nest.
 */
export default function Nests() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { canSeeAllNests, canAddNest } = useUserPermissions();
  const onList = canSeeAllNests && location.pathname === LIST_PATH;
  const here = `${location.pathname}${location.search}`;

  // --- What waits ---------------------------------------------------------------
  const [todo, setTodo] = useState<NestTodo | null>(null);
  const [todoError, setTodoError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = () => {
    setVersion((value) => value + 1);
    refreshPending();
  };
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    fetchNestTodo()
      .then((found) => { if (!cancelled) { setTodo(found); setTodoError(null); } })
      .catch(() => { if (!cancelled) setTodoError("La liste n'est pas disponible pour le moment."); });
    return () => { cancelled = true; };
  }, [auth.isAuthenticated, version]);
  // A nest can belong to several sections: it counts once, as in `GET /api/pending/`
  const waiting = new Set(
    [...(todo?.to_verify ?? []), ...(todo?.confirmed ?? []), ...(todo?.near_apiaries ?? [])].map((nest) => nest.id),
  ).size;

  // --- The list of the season ---------------------------------------------------
  const params = useMemo(() => new URLSearchParams(onList ? location.search : ''), [onList, location.search]);
  const query = useMemo<ManagedNestsQuery>(() => {
    const status = (params.get('status') ?? 'open').split(',').filter(Boolean) as ManagedNestsQuery['status'];
    const ordering = params.get('ordering') as NestOrdering | null;
    return {
      show: params.get('show') === 'mine' ? 'mine' : 'all',
      status,
      q: params.get('q') || undefined,
      ordering: ordering && ORDERINGS.some((entry) => entry.value === ordering) ? ordering : '-created_at',
    };
  }, [params]);
  const updateQuery = useCallback((changes: Partial<Record<'show' | 'status' | 'q' | 'ordering', string>>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    const search = next.toString();
    navigate({ pathname: LIST_PATH, search: search ? `?${search}` : '' }, { replace: true });
  }, [params, navigate]);

  const [search, setSearch] = useState(query.q ?? '');
  useEffect(() => {
    if (!onList || (search.trim() || undefined) === query.q) return;
    const timer = window.setTimeout(() => updateQuery({ q: search.trim() }), 400);
    return () => window.clearTimeout(timer);
  }, [search, query.q, onList, updateQuery]);

  const [list, setList] = useState<{ key: string; items: Nest[]; count: number; page: number; more: boolean } | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const queryKey = JSON.stringify(query);
  useEffect(() => {
    if (!auth.isAuthenticated || !onList) return;
    let cancelled = false;
    fetchManagedNests(query, 1)
      .then((found) => {
        if (cancelled) return;
        setList({ key: JSON.stringify(query), items: found.results, count: found.count, page: 1, more: Boolean(found.next) });
        setListError(null);
      })
      .catch(() => { if (!cancelled) setListError("La liste n'est pas disponible pour le moment."); });
    return () => { cancelled = true; };
  }, [auth.isAuthenticated, onList, query, version]);
  const loadingList = onList && !listError && list?.key !== queryKey;

  const loadMore = async () => {
    if (!list) return;
    setLoadingMore(true);
    try {
      const found = await fetchManagedNests(query, list.page + 1);
      setList({ ...list, items: [...list.items, ...found.results], page: list.page + 1, more: Boolean(found.next) });
    } catch {
      setListError("La liste n'est pas disponible pour le moment.");
    } finally {
      setLoadingMore(false);
    }
  };

  // --- Dialogs (one at a time) ----------------------------------------------------
  const [sheetNest, setSheetNest] = useState<Nest | null>(null);
  const [actionsNest, setActionsNest] = useState<Nest | null>(null);
  const [eventDialog, setEventDialog] = useState<EventDialog | null>(null);
  const [ownerNest, setOwnerNest] = useState<Nest | null>(null);
  const [placing, setPlacing] = useState(false);
  const [reportAt, setReportAt] = useState<{ lat: number; lng: number } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // `?nest=<id>`: open its sheet, then drop the parameter so a reload does not reopen it
  const requested = Number(new URLSearchParams(location.search).get('nest')) || null;
  useEffect(() => {
    if (!requested || auth.isLoading || !auth.isAuthenticated) return;
    let cancelled = false;
    dispatch(fetchNestDetail(requested)).unwrap()
      .then((nest) => { if (!cancelled) setSheetNest(nest); })
      .catch(() => { if (!cancelled) setLinkError("Ce nid est introuvable, ou vous n'y avez pas accès."); })
      .finally(() => {
        if (cancelled) return;
        const rest = new URLSearchParams(location.search);
        rest.delete('nest');
        navigate({ pathname: location.pathname, search: rest.toString() ? `?${rest}` : '' }, { replace: true });
      });
    return () => { cancelled = true; };
  }, [requested, auth.isLoading, auth.isAuthenticated, dispatch, navigate, location.pathname, location.search]);

  const locate = (nest: Nest) => navigate(mapUrl({ mode: 'nest', nest: nest.id, from: here }));
  const openMap = () => navigate(mapUrl({ mode: 'nests', from: here }));
  const record = (nest: Nest, kind: 'visit' | 'destruction') => {
    if (nest.id) setEventDialog({ nest: { ...nest, id: nest.id }, kind });
  };
  // The main action of a row: what the nest waits for, if the user may do it
  const rowAction = (nest: Nest) => {
    if (nest.permissions?.visit && nest.status === 'reported') {
      return { label: 'Vérifier', onClick: (item: Nest) => record(item, 'visit') };
    }
    if (nest.permissions?.destroy && isOpenStatus(nest.status)) {
      return { label: nest.permissions.visit ? 'Neutraliser' : 'Signaler neutralisé', onClick: (item: Nest) => record(item, 'destruction') };
    }
    return undefined;
  };

  // --- Render -----------------------------------------------------------------
  const renderRows = (nests: Nest[], withMore: boolean) => (
    <div className="list-group">
      {nests.filter((nest): nest is Nest & { id: number } => Boolean(nest.id)).map((nest) => (
        <NestListItem
          key={nest.id}
          nest={nest}
          onOpen={setSheetNest}
          onLocate={locate}
          onMore={withMore ? setActionsNest : undefined}
          action={rowAction(nest)}
        />
      ))}
    </div>
  );

  // Each nest is listed once, in the first section (in order of urgency) that holds it
  const shown = new Set<number | undefined>();
  const sections = todo ? TODO_SECTIONS
    .map((section) => ({
      ...section,
      items: (todo[section.key] ?? [])
        .filter((nest) => section.key !== 'mine' || isOpenStatus(nest.status))
        .filter((nest) => !shown.has(nest.id)),
    }))
    .map((section) => { section.items.forEach((nest) => shown.add(nest.id)); return section; })
    .filter((section) => section.items.length > 0) : [];

  return (
    <PageLayout>
      <Container className="pb-5 nest-manager">
        <PageHeader
          title="Nids"
          help="Les nids de la saison : ce qui attend une action, et la liste."
          actions={auth.isAuthenticated && (
            <>
              {canAddNest && (
                <Button variant="primary" onClick={() => setPlacing(true)}>
                  <i className={`bi bi-${ACTION_ICONS.add} me-2`} aria-hidden="true" />
                  Signaler
                </Button>
              )}
              <IconButton variant="outline-secondary" icon="map" label="Carte" onClick={openMap} />
            </>
          )}
        />

        {!auth.isAuthenticated ? (
          <Alert variant="info">
            {auth.isLoading ? <Spinner animation="border" size="sm" /> : (
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="flex-grow-1">Connectez-vous pour signaler un nid et suivre vos signalements.</span>
                <Button onClick={() => void signInFromCurrentPage(auth)}>Connexion</Button>
                <Button variant="outline-secondary" onClick={openMap}>Carte</Button>
              </div>
            )}
          </Alert>
        ) : (
          <>
            {linkError && <Alert variant="danger" dismissible onClose={() => setLinkError(null)}>{linkError}</Alert>}

            {canSeeAllNests && (
              <ButtonGroup className="d-flex mb-3" role="tablist" aria-label="Vue">
                <Button role="tab" aria-selected={!onList} variant={onList ? 'outline-primary' : 'primary'}
                  onClick={() => navigate(TODO_PATH)}>
                  À traiter
                  {waiting > 0 && (
                    <Badge pill bg={onList ? 'danger' : 'light'} text={onList ? undefined : 'dark'} className="ms-2">
                      {waiting}
                    </Badge>
                  )}
                </Button>
                <Button role="tab" aria-selected={onList} variant={onList ? 'primary' : 'outline-primary'}
                  onClick={() => navigate(LIST_PATH)}>
                  Nids
                </Button>
              </ButtonGroup>
            )}

            {!onList && (
              <>
                {todoError && <Alert variant="warning">{todoError}</Alert>}
                {!todo && !todoError && <Spinner animation="border" role="status" />}
                {todo && canSeeAllNests && (sections.length > 0 ? sections.map((section) => (
                  <section key={section.key} className="mb-3">
                    <h2 className="h6 text-uppercase text-muted mb-1 d-flex justify-content-between">
                      <span>{section.title}</span><span>{section.items.length}</span>
                    </h2>
                    {renderRows(section.items, true)}
                  </section>
                )) : (
                  <div className="text-center text-muted py-5">
                    <div className="display-6" aria-hidden="true">{OBJECT_ICONS.nest}</div>
                    <span className="d-inline-flex align-items-center">
                      Rien à traiter.
                      <HelpTip id="nests-todo-empty-help" doc="nests#module" title="À traiter">
                        Un nid apparaît ici quand il attend quelque chose de vous : une vérification ou sa neutralisation
                        (coordinateurs), parce qu&apos;il est à moins de 1 km d&apos;un de vos ruchers, ou parce que vous
                        l&apos;avez signalé et qu&apos;il n&apos;est pas encore neutralisé.
                      </HelpTip>
                    </span>
                  </div>
                ))}
                {todo && !canSeeAllNests && (
                  <section>
                    <h2 className="h6 text-uppercase text-muted mb-1 d-flex justify-content-between">
                      <span>Mes signalements · saison {new Date().getFullYear()}</span><span>{todo.mine.length}</span>
                    </h2>
                    {todo.mine.length > 0 ? renderRows(todo.mine, false) : (
                      <div className="text-center text-muted py-5">
                        <div className="display-6" aria-hidden="true">{OBJECT_ICONS.nest}</div>
                        Vous n&apos;avez pas signalé de nid cette saison.
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {onList && (
              <>
                <ButtonGroup className="d-flex mb-2" aria-label="Portée">
                  {(['all', 'mine'] as NestScope[]).map((scope) => (
                    <Button key={scope} variant={query.show === scope ? 'secondary' : 'outline-secondary'}
                      onClick={() => updateQuery({ show: scope === 'all' ? '' : scope })}>
                      {scope === 'all' ? 'Tous' : 'Mes signalements'}
                    </Button>
                  ))}
                </ButtonGroup>
                <div className="d-flex gap-2 mb-2">
                  <Form.Control type="search" placeholder="Rechercher (n°, adresse)" aria-label="Rechercher"
                    value={search} onChange={(event) => setSearch(event.target.value)} />
                  <Form.Select aria-label="Trier" value={query.ordering} className="w-auto"
                    onChange={(event) => updateQuery({ ordering: event.target.value === '-created_at' ? '' : event.target.value })}>
                    {ORDERINGS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                  </Form.Select>
                </div>
                <div className="mb-2">
                  <ChipChoice name="nest-status" label="Statuts" options={STATUS_FILTERS} value={query.status} multiple
                    onChange={(value) => updateQuery({ status: (value as string[]).join(',') || 'open' })} />
                </div>
                <div className="small text-muted mb-2">
                  Saison {new Date().getFullYear()}
                  {list && ` · ${list.count} nid${list.count > 1 ? 's' : ''}`}
                </div>
                {listError && <Alert variant="danger">{listError}</Alert>}
                {loadingList && <Spinner animation="border" role="status" />}
                {list && !loadingList && list.items.length === 0 && (
                  <div className="text-center text-muted py-5">Aucun nid ne correspond à ces critères.</div>
                )}
                {list && !loadingList && renderRows(list.items, true)}
                {list?.more && !loadingList && (
                  <div className="text-center mt-3">
                    <Button variant="outline-secondary" onClick={() => void loadMore()} disabled={loadingMore}>
                      {loadingMore ? <Spinner animation="border" size="sm" /> : 'Afficher plus'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Container>

      <ReportNestSheet
        show={placing}
        onHide={() => setPlacing(false)}
        onPlace={(lat, lng) => { setPlacing(false); setReportAt({ lat, lng }); }}
        onMap={openMap}
      />

      {reportAt && (
        <AddNestPopup
          show
          onHide={() => setReportAt(null)}
          latitude={reportAt.lat}
          longitude={reportAt.lng}
          onSuccess={(nest) => { reload(); setSheetNest(nest); }}
        />
      )}

      <NestInfoPopup
        show={sheetNest !== null && eventDialog === null}
        onHide={() => setSheetNest(null)}
        nest={sheetNest}
        onLocate={locate}
        onChanged={reload}
      />

      <NestActionsSheet
        nest={actionsNest}
        onHide={() => setActionsNest(null)}
        onOpen={(nest) => { setActionsNest(null); setSheetNest(nest); }}
        onLocate={(nest) => { setActionsNest(null); locate(nest); }}
        onVisit={(nest) => { setActionsNest(null); record(nest, 'visit'); }}
        onDestruction={(nest) => { setActionsNest(null); record(nest, 'destruction'); }}
        onChangeOwner={(nest) => { setActionsNest(null); setOwnerNest(nest); }}
      />

      {ownerNest && (
        <NestOwnerModal
          onHide={() => setOwnerNest(null)}
          nest={{ ...ownerNest, id: ownerNest.id as number }}
          keepsSight={canSeeAllNests}
          onTransferred={() => { setOwnerNest(null); reload(); }}
        />
      )}

      {eventDialog && (
        <NestEventModal
          onHide={() => setEventDialog(null)}
          nest={eventDialog.nest}
          kind={eventDialog.kind}
          asReporter={eventDialog.kind === 'destruction' && !eventDialog.nest.permissions?.visit}
          onSaved={reload}
        />
      )}
    </PageLayout>
  );
}
