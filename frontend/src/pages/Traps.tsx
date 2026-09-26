import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Container, Spinner } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { PageHeader, PageLayout } from '../components/layout';
import { mapUrl } from '../components/map/viewModes';
import { ConfirmationModal } from '../components/modals';
import {
  TrapActionsSheet, TrapEventModal, TrapFormModal, TrapInfoPopup, TrapListItem, TrapListToolbar,
} from '../components/traps';
import { TagAssociateModal, TagScannerModal } from '../components/tags';
import { IconButton } from '../components/ui';
import { useTagDeepLink } from '../hooks/useTagDeepLink';
import { useUserPermissions } from '../hooks/useUserPermissions';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  deleteTrap, fetchManagedTraps, fetchTrapDetail, fetchTrapTypes, selectManagedTraps, selectMapCenter,
  selectTrapTypes,
  type ManagedTrapsQuery, type Trap, type TrapOrdering, type TrapScope,
} from '../store/store';
import { signInFromCurrentPage } from '../utils/authRedirect';
import { ACTION_ICONS } from '../utils/icons';
import { memberGroups } from '../utils/groups';
import { currentPosition } from '../utils/position';
import type { TagResolution } from '../utils/tagsApi';

const LIST_PATH = '/traps';

const ORDERINGS: TrapOrdering[] = [
  'last_event_at', '-last_event_at', 'hornet_catch_count', '-hornet_catch_count',
  'installed_at', '-installed_at', 'address', 'id', '-id', 'distance',
];

/**
 * URL parameters that make up the list query (others, like `trap`, are
 * one-off requests). The scope travels as `show`: `scope` is an OAuth
 * parameter, wiped from every URL by `utils/urlCleaner.ts`.
 */
const QUERY_KEYS = ['show', 'active', 'ordering', 'q', 'group', 'trap_type', 'has_tag'];
const urlKey = (key: string) => (key === 'scope' ? 'show' : key);

/**
 * Trap manager: the traps the user owns or has been delegated, as a list to
 * sort, filter and act upon, with the scanner at hand. "Locate" opens the map
 * module on the trap (view mode `trap`), with a way back to this list.
 *
 * Also the landing of `/tag/<value>` (printed QR codes, captured by the
 * installed app), `/scan` (shortcut of the installed app) and
 * `/traps?trap=<id>` (link to a trap, e.g. from the QR Codes administration).
 */
export default function Traps() {
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isAdmin, roles, groups, userGuid, canAddTrap, canActOnTrap, canEditTrap,
  } = useUserPermissions();

  const managed = useAppSelector(selectManagedTraps);
  const trapTypes = useAppSelector(selectTrapTypes);
  const mapCenter = useAppSelector(selectMapCenter);

  // --- Query, from the URL of the list ---------------------------------------
  // `/tag/...` and `/scan` keep the filters of the list they were opened from.
  // Adjusted while rendering, the way React recommends for state derived from
  // navigation.
  const onList = location.pathname === LIST_PATH;
  const [listSearch, setListSearch] = useState(onList ? location.search : '');
  if (onList && location.search !== listSearch) setListSearch(location.search);
  const searchParams = useMemo(() => new URLSearchParams(onList ? location.search : listSearch),
    [onList, location.search, listSearch]);
  // The list as it is, without one-off requests: where the map and the scanner come back to
  const listPath = useMemo(() => {
    const kept = new URLSearchParams();
    QUERY_KEYS.forEach((key) => { const value = searchParams.get(key); if (value) kept.set(key, value); });
    const search = kept.toString();
    return search ? `${LIST_PATH}?${search}` : LIST_PATH;
  }, [searchParams]);

  const scopes = useMemo<TrapScope[]>(() => {
    const available: TrapScope[] = [];
    if (roles.includes('volunteer') || roles.includes('beekeeper')) available.push('mine');
    available.push('delegated');
    if (isAdmin) available.push('all');
    return available;
  }, [roles, isAdmin]);
  // A platform admin cannot own traps: they start on every trap
  const defaultScope: TrapScope = scopes.includes('mine') ? 'mine' : isAdmin ? 'all' : 'delegated';

  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const query = useMemo<ManagedTrapsQuery>(() => {
    const scope = searchParams.get('show') as TrapScope | null;
    const active = searchParams.get('active');
    const ordering = searchParams.get('ordering') as TrapOrdering | null;
    const hasTag = searchParams.get('has_tag');
    const result: ManagedTrapsQuery = {
      scope: scope && scopes.includes(scope) ? scope : defaultScope,
      active: active === 'false' || active === 'all' ? active : 'true',
      ordering: ordering && ORDERINGS.includes(ordering) ? ordering : 'last_event_at',
      q: searchParams.get('q') || undefined,
      group: searchParams.get('group') || undefined,
      trap_type: searchParams.get('trap_type') || undefined,
      has_tag: hasTag === 'true' || hasTag === 'false' ? hasTag : undefined,
    };
    if (result.ordering === 'distance' && origin) {
      result.lat = origin.lat;
      result.lon = origin.lon;
    }
    return result;
  }, [searchParams, scopes, defaultScope, origin]);

  const updateQuery = useCallback((changes: Partial<ManagedTrapsQuery>) => {
    const next = new URLSearchParams(listPath.split('?')[1] ?? '');
    Object.entries(changes).forEach(([key, value]) => {
      if (key === 'lat' || key === 'lon') return;
      if (value === undefined || value === '') next.delete(urlKey(key));
      else next.set(urlKey(key), String(value));
    });
    const search = next.toString();
    navigate({ pathname: LIST_PATH, search: search ? `?${search}` : '' }, { replace: true });
  }, [listPath, navigate]);

  // Sorting by distance needs the position of the user: the list waits for it
  const needsOrigin = query.ordering === 'distance' && !origin;
  useEffect(() => {
    if (!needsOrigin || !auth.isAuthenticated) return;
    let cancelled = false;
    currentPosition()
      .then((position) => { if (!cancelled) setOrigin(position); })
      .catch((error: Error) => {
        if (cancelled) return;
        setListError(error.message);
        updateQuery({ ordering: 'last_event_at' });
      });
    return () => { cancelled = true; };
  }, [needsOrigin, auth.isAuthenticated, updateQuery]);

  const queryKey = JSON.stringify(query);
  const reload = useCallback(() => {
    dispatch(fetchManagedTraps({ query, page: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, queryKey]);

  useEffect(() => {
    if (!auth.isAuthenticated || needsOrigin) return;
    reload();
  }, [auth.isAuthenticated, needsOrigin, reload]);

  useEffect(() => {
    if (auth.isAuthenticated && trapTypes.length === 0) dispatch(fetchTrapTypes());
  }, [auth.isAuthenticated, trapTypes.length, dispatch]);

  const loadMore = () => dispatch(fetchManagedTraps({ query, page: managed.page + 1 }));

  // --- Dialogs (one at a time) -----------------------------------------------
  const [sheetTrap, setSheetTrap] = useState<Trap | null>(null);
  const [actionsTrap, setActionsTrap] = useState<Trap | null>(null);
  const [recordTrap, setRecordTrap] = useState<Trap | null>(null);
  const [editTrap, setEditTrap] = useState<Trap | null>(null);
  const [deletingTrap, setDeletingTrap] = useState<Trap | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [newTrapAt, setNewTrapAt] = useState<{ lat: number; lng: number } | null>(null);
  const [placing, setPlacing] = useState(false);

  /** The trap in its surroundings: the map module, with a way back to this list. */
  const locate = useCallback((trap: Trap) => {
    navigate(mapUrl({ mode: 'trap', trap: trap.id, from: listPath }));
  }, [navigate, listPath]);

  /** Dragging the marker to its new place happens in the map module. */
  const move = useCallback((trap: Trap) => {
    navigate(mapUrl({ mode: 'trap-move', trap: trap.id, from: listPath }));
  }, [navigate, listPath]);

  const handleDelete = async () => {
    if (!deletingTrap) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await dispatch(deleteTrap(deletingTrap.id)).unwrap();
      setDeletingTrap(null);
    } catch (error) {
      setDeleteError(error as string);
    } finally {
      setDeleting(false);
    }
  };

  // A new trap is usually installed where the user stands
  const startAdd = async () => {
    setPlacing(true);
    try {
      const { lat, lon } = await currentPosition();
      setNewTrapAt({ lat, lng: lon });
    } catch {
      setNewTrapAt({ lat: mapCenter.latitude, lng: mapCenter.longitude });
    } finally {
      setPlacing(false);
    }
  };

  // --- Links to a trap and QR codes ------------------------------------------
  const [scanning, setScanning] = useState(false);
  const [associating, setAssociating] = useState<{ value: string; short: string } | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);

  // `/traps?trap=<id>`: open its sheet if the user may see it, then drop the
  // parameter so a reload does not reopen it
  const requestedTrapId = onList ? Number(searchParams.get('trap')) || null : null;
  useEffect(() => {
    if (!requestedTrapId || auth.isLoading || !auth.isAuthenticated) return;
    let cancelled = false;
    dispatch(fetchTrapDetail(requestedTrapId)).unwrap()
      .then((trap) => { if (!cancelled) setSheetTrap(trap); })
      .catch(() => { if (!cancelled) setTagError("Ce piège est introuvable, ou vous n'y avez pas accès."); })
      .finally(() => { if (!cancelled) navigate(listPath, { replace: true }); });
    return () => { cancelled = true; };
  }, [requestedTrapId, auth.isLoading, auth.isAuthenticated, dispatch, navigate, listPath]);

  const handleTagResolved = useCallback((value: string, resolution: TagResolution) => {
    setTagError(null);
    if (resolution.status === 'associated') {
      setSheetTrap(resolution.trap);
    } else {
      setAssociating({ value, short: resolution.short });
    }
  }, []);

  const { needsSignIn: tagNeedsSignIn, resolving: resolvingTag } = useTagDeepLink({
    onResolved: handleTagResolved,
    onError: setTagError,
    returnTo: listPath,
  });

  // The scanner only extracts the value: `/tag/<value>` does the rest, as for
  // a tag scanned outside the app
  const handleScannedTag = (value: string) => {
    setScanning(false);
    navigate(`/tag/${value}`);
  };

  // `/scan` (shortcut of the installed app, scan button of the map): open the
  // scanner once signed in, and go back to the list so a reload does not reopen it
  const scanRequested = location.pathname === '/scan';
  const scanNeedsSignIn = scanRequested && !auth.isLoading && !auth.isAuthenticated;
  const scanReady = scanRequested && !auth.isLoading && auth.isAuthenticated;
  const [openedScanKey, setOpenedScanKey] = useState<string | null>(null);
  if (scanReady && openedScanKey !== location.key) {
    setOpenedScanKey(location.key);
    setScanning(true);
  }
  useEffect(() => {
    if (scanReady) navigate(listPath, { replace: true });
  }, [scanReady, navigate, listPath]);

  // --- Render -----------------------------------------------------------------
  const groupOptions = useMemo(() => memberGroups(groups), [groups]);
  const filtered = Boolean(query.q || query.group || query.trap_type || query.has_tag || query.active !== 'true');

  return (
    <PageLayout>
      <Container className="pb-5 trap-manager">
        <PageHeader
          title="Pièges"
          help="Vos pièges et ceux confiés à vos groupes."
          actions={auth.isAuthenticated && (
            <>
              <Button variant="primary" onClick={() => setScanning(true)}>
                <i className={`bi bi-${ACTION_ICONS.scan} me-2`} aria-hidden="true" />
                Scanner
              </Button>
              {canAddTrap && (
                <IconButton
                  variant="outline-primary"
                  icon={ACTION_ICONS.add}
                  label="Ajouter"
                  onClick={() => void startAdd()}
                  disabled={placing}
                />
              )}
            </>
          )}
        />

        {!auth.isAuthenticated ? (
          <Alert variant="info">
            {auth.isLoading ? <Spinner animation="border" size="sm" /> : (
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="flex-grow-1">Connectez-vous pour gérer vos pièges.</span>
                <Button onClick={() => void signInFromCurrentPage(auth)}>Connexion</Button>
              </div>
            )}
          </Alert>
        ) : (
          <>
            <TrapListToolbar
              query={query}
              onChange={updateQuery}
              scopes={scopes}
              groups={groupOptions}
              trapTypes={trapTypes}
              count={managed.count}
              loading={managed.loading && managed.page === 0}
              locating={needsOrigin}
            />

            {placing && (
              <Alert variant="light" className="small py-2">
                <Spinner animation="border" size="sm" className="me-2" />Localisation…
              </Alert>
            )}
            {listError && (
              <Alert variant="warning" dismissible onClose={() => setListError(null)}>{listError}</Alert>
            )}
            {managed.error && <Alert variant="danger">{managed.error}</Alert>}

            {!managed.loading && managed.items.length === 0 && !managed.error && (
              <div className="text-center text-muted py-5">
                <div className="display-6" aria-hidden="true">🪤</div>
                {filtered
                  ? 'Aucun piège ne correspond à ces critères.'
                  : query.scope === 'mine'
                    ? "Vous n'avez pas encore de piège en service."
                    : query.scope === 'delegated'
                      ? "Aucun piège n'est délégué à vos groupes."
                      : 'Aucun piège.'}
              </div>
            )}

            <div className="list-group">
              {managed.items.map((trap) => (
                <TrapListItem
                  key={trap.id}
                  trap={trap}
                  isMine={Boolean(trap.owner && trap.owner.guid === userGuid)}
                  canAct={canActOnTrap(trap)}
                  origin={query.ordering === 'distance' ? origin : null}
                  onOpen={setSheetTrap}
                  onLocate={locate}
                  onRecord={setRecordTrap}
                  onMore={setActionsTrap}
                />
              ))}
            </div>

            {managed.hasMore && (
              <div className="text-center mt-3">
                <Button variant="outline-secondary" onClick={loadMore} disabled={managed.loading}>
                  {managed.loading ? <Spinner animation="border" size="sm" /> : 'Afficher plus'}
                </Button>
              </div>
            )}
          </>
        )}

        {(tagError || tagNeedsSignIn || scanNeedsSignIn || resolvingTag) && (
          <Alert
            variant={tagError ? 'danger' : 'info'}
            dismissible={Boolean(tagError)}
            onClose={() => setTagError(null)}
            className="trap-manager-notice py-2"
          >
            {tagError ?? (tagNeedsSignIn || scanNeedsSignIn ? (
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="flex-grow-1">
                  {scanNeedsSignIn ? 'Connectez-vous pour scanner un QR Code.' : 'Connectez-vous pour lire ce QR Code.'}
                </span>
                <Button onClick={() => void signInFromCurrentPage(auth)}>Connexion</Button>
              </div>
            ) : (
              <><Spinner animation="border" size="sm" className="me-2" />Lecture du QR Code…</>
            ))}
          </Alert>
        )}
      </Container>

      <TrapInfoPopup
        show={sheetTrap !== null}
        onHide={() => setSheetTrap(null)}
        trap={sheetTrap}
        onLocate={locate}
        onMove={move}
      />

      <TrapActionsSheet
        trap={actionsTrap}
        onHide={() => setActionsTrap(null)}
        canEdit={actionsTrap ? canEditTrap(actionsTrap) : false}
        onOpen={(trap) => { setActionsTrap(null); setSheetTrap(trap); }}
        onLocate={(trap) => { setActionsTrap(null); locate(trap); }}
        onMove={(trap) => { setActionsTrap(null); move(trap); }}
        onEdit={(trap) => { setActionsTrap(null); setEditTrap(trap); }}
        onDelete={(trap) => { setActionsTrap(null); setDeleteError(null); setDeletingTrap(trap); }}
      />

      {recordTrap && (
        <TrapEventModal onHide={() => setRecordTrap(null)} trap={recordTrap} initialKind="catch" />
      )}

      {editTrap && <TrapFormModal onHide={() => setEditTrap(null)} trap={editTrap} />}

      {newTrapAt && (
        <TrapFormModal
          onHide={() => setNewTrapAt(null)}
          latitude={newTrapAt.lat}
          longitude={newTrapAt.lng}
          onSaved={reload}
        />
      )}

      <ConfirmationModal
        show={deletingTrap !== null}
        onHide={() => setDeletingTrap(null)}
        onConfirm={handleDelete}
        itemName={deletingTrap ? `le piège #${deletingTrap.id}` : ''}
        isDeleting={deleting}
        deleteError={deleteError}
      />

      {scanning && <TagScannerModal onHide={() => setScanning(false)} onTag={handleScannedTag} />}

      {associating && (
        <TagAssociateModal
          value={associating.value}
          short={associating.short}
          onHide={() => setAssociating(null)}
          onAssociated={(trap) => { setAssociating(null); setSheetTrap(trap); reload(); }}
        />
      )}
    </PageLayout>
  );
}
