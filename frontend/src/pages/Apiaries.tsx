import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Container, Spinner } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { PageHeader, PageLayout } from '../components/layout';
import { mapUrl } from '../components/map/viewModes';
import { ConfirmationModal } from '../components/modals';
import {
  ApiaryActionsSheet, ApiaryFormModal, ApiaryListItem, ApiaryListToolbar,
} from '../components/apiaries';
import { ApiaryInfoPopup } from '../components/popups';
import { IconButton } from '../components/ui';
import { useUserPermissions } from '../hooks/useUserPermissions';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  deleteApiary, fetchApiaryDetail, fetchManagedApiaries, selectManagedApiaries, selectMapCenter,
  type Apiary, type ApiaryOrdering, type ApiaryScope, type ManagedApiariesQuery,
} from '../store/store';
import { signInFromCurrentPage } from '../utils/authRedirect';
import { memberGroups } from '../utils/groups';
import { ACTION_ICONS, OBJECT_ICONS } from '../utils/icons';
import { currentPosition } from '../utils/position';

const LIST_PATH = '/apiaries';

const ORDERINGS: ApiaryOrdering[] = [
  '-infestation_level', 'infestation_level', '-created_at', 'created_at', 'address', '-id', 'id', 'distance',
];

/**
 * URL parameters that make up the list query (others, like `apiary`, are
 * one-off requests). The scope travels as `show`: `scope` is an OAuth
 * parameter, wiped from every URL by `utils/urlCleaner.ts`.
 */
const QUERY_KEYS = ['show', 'ordering', 'q', 'group', 'infestation_level'];
const urlKey = (key: string) => (key === 'scope' ? 'show' : key);

/**
 * Apiary manager: the apiaries the user owns or that their associations share
 * with them, as a list to sort, filter and act upon. "Voir sur la carte" opens
 * the map module on the apiary (view mode `apiary`), with a way back to this
 * list. `/apiaries?apiary=<id>` opens the sheet of an apiary over the list.
 */
export default function Apiaries() {
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, roles, groups, userGuid, canAddApiary } = useUserPermissions();

  const managed = useAppSelector(selectManagedApiaries);
  const mapCenter = useAppSelector(selectMapCenter);

  // --- Query, from the URL of the list ---------------------------------------
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  // The list as it is, without one-off requests: where the map comes back to
  const listPath = useMemo(() => {
    const kept = new URLSearchParams();
    QUERY_KEYS.forEach((key) => { const value = searchParams.get(key); if (value) kept.set(key, value); });
    const search = kept.toString();
    return search ? `${LIST_PATH}?${search}` : LIST_PATH;
  }, [searchParams]);

  const scopes = useMemo<ApiaryScope[]>(() => {
    const available: ApiaryScope[] = [];
    if (roles.includes('beekeeper')) available.push('mine');
    available.push('shared');
    if (isAdmin) available.push('all');
    return available;
  }, [roles, isAdmin]);
  // A platform admin who keeps no apiary starts on every apiary
  const defaultScope: ApiaryScope = scopes.includes('mine') ? 'mine' : isAdmin ? 'all' : 'shared';

  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const query = useMemo<ManagedApiariesQuery>(() => {
    const scope = searchParams.get('show') as ApiaryScope | null;
    const ordering = searchParams.get('ordering') as ApiaryOrdering | null;
    const level = searchParams.get('infestation_level');
    const result: ManagedApiariesQuery = {
      scope: scope && scopes.includes(scope) ? scope : defaultScope,
      ordering: ordering && ORDERINGS.includes(ordering) ? ordering : '-infestation_level',
      q: searchParams.get('q') || undefined,
      group: searchParams.get('group') || undefined,
      infestation_level: level === '1' || level === '2' || level === '3' ? level : undefined,
    };
    if (result.ordering === 'distance' && origin) {
      result.lat = origin.lat;
      result.lon = origin.lon;
    }
    return result;
  }, [searchParams, scopes, defaultScope, origin]);

  const updateQuery = useCallback((changes: Partial<ManagedApiariesQuery>) => {
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
        updateQuery({ ordering: '-infestation_level' });
      });
    return () => { cancelled = true; };
  }, [needsOrigin, auth.isAuthenticated, updateQuery]);

  const queryKey = JSON.stringify(query);
  const reload = useCallback(() => {
    dispatch(fetchManagedApiaries({ query, page: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, queryKey]);

  useEffect(() => {
    if (!auth.isAuthenticated || needsOrigin) return;
    reload();
  }, [auth.isAuthenticated, needsOrigin, reload]);

  const loadMore = () => dispatch(fetchManagedApiaries({ query, page: managed.page + 1 }));

  // --- Dialogs (one at a time) -----------------------------------------------
  const [sheetApiary, setSheetApiary] = useState<Apiary | null>(null);
  const [actionsApiary, setActionsApiary] = useState<Apiary | null>(null);
  const [editApiary, setEditApiary] = useState<Apiary | null>(null);
  const [deletingApiary, setDeletingApiary] = useState<Apiary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [newApiaryAt, setNewApiaryAt] = useState<{ lat: number; lng: number } | null>(null);
  const [placing, setPlacing] = useState(false);

  /** The apiary in its surroundings: the map module, with a way back to this list. */
  const locate = useCallback((apiary: Apiary) => {
    navigate(mapUrl({ mode: 'apiary', apiary: apiary.id, from: listPath }));
  }, [navigate, listPath]);

  const handleDelete = async () => {
    if (!deletingApiary?.id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await dispatch(deleteApiary(deletingApiary.id)).unwrap();
      setDeletingApiary(null);
    } catch (error) {
      setDeleteError(error as string);
    } finally {
      setDeleting(false);
    }
  };

  // An apiary is usually registered where the beekeeper stands
  const startAdd = async () => {
    setPlacing(true);
    try {
      const { lat, lon } = await currentPosition();
      setNewApiaryAt({ lat, lng: lon });
    } catch {
      setNewApiaryAt({ lat: mapCenter.latitude, lng: mapCenter.longitude });
    } finally {
      setPlacing(false);
    }
  };

  // `/apiaries?apiary=<id>`: open its sheet if the user may see it, then drop
  // the parameter so a reload does not reopen it
  const [linkError, setLinkError] = useState<string | null>(null);
  const requestedApiaryId = Number(searchParams.get('apiary')) || null;
  useEffect(() => {
    if (!requestedApiaryId || auth.isLoading || !auth.isAuthenticated) return;
    let cancelled = false;
    dispatch(fetchApiaryDetail(requestedApiaryId)).unwrap()
      .then((apiary) => { if (!cancelled) setSheetApiary(apiary); })
      .catch(() => { if (!cancelled) setLinkError("Ce rucher est introuvable, ou vous n'y avez pas accès."); })
      .finally(() => { if (!cancelled) navigate(listPath, { replace: true }); });
    return () => { cancelled = true; };
  }, [requestedApiaryId, auth.isLoading, auth.isAuthenticated, dispatch, navigate, listPath]);

  // --- Render -----------------------------------------------------------------
  const groupOptions = useMemo(() => memberGroups(groups), [groups]);
  const filtered = Boolean(query.q || query.group || query.infestation_level);

  return (
    <PageLayout>
      <Container className="pb-5">
        <PageHeader
          title="Ruchers"
          help="Vos ruchers et ceux que vos associations partagent avec vous."
          actions={auth.isAuthenticated && canAddApiary && (
            <IconButton
              variant="primary"
              icon={ACTION_ICONS.add}
              label="Ajouter"
              onClick={() => void startAdd()}
              disabled={placing}
            />
          )}
        />

        {!auth.isAuthenticated ? (
          <Alert variant="info">
            {auth.isLoading ? <Spinner animation="border" size="sm" /> : (
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="flex-grow-1">Connectez-vous pour gérer vos ruchers.</span>
                <Button onClick={() => void signInFromCurrentPage(auth)}>Connexion</Button>
              </div>
            )}
          </Alert>
        ) : (
          <>
            <ApiaryListToolbar
              query={query}
              onChange={updateQuery}
              scopes={scopes}
              groups={groupOptions}
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
            {linkError && (
              <Alert variant="danger" dismissible onClose={() => setLinkError(null)}>{linkError}</Alert>
            )}
            {managed.error && <Alert variant="danger">{managed.error}</Alert>}

            {!managed.loading && managed.items.length === 0 && !managed.error && (
              <div className="text-center text-muted py-5">
                <div className="display-6" aria-hidden="true">{OBJECT_ICONS.apiary}</div>
                {filtered
                  ? 'Aucun rucher ne correspond à ces critères.'
                  : query.scope === 'mine'
                    ? "Vous n'avez pas encore de rucher."
                    : query.scope === 'shared'
                      ? "Aucun rucher n'est partagé avec vos associations."
                      : 'Aucun rucher.'}
              </div>
            )}

            <div className="list-group">
              {managed.items.map((apiary) => apiary.id !== undefined && (
                <ApiaryListItem
                  key={apiary.id}
                  apiary={{ ...apiary, id: apiary.id }}
                  isMine={Boolean(apiary.owner && apiary.owner.guid === userGuid)}
                  origin={query.ordering === 'distance' ? origin : null}
                  onOpen={setSheetApiary}
                  onLocate={locate}
                  onMore={setActionsApiary}
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
      </Container>

      <ApiaryInfoPopup
        show={sheetApiary !== null}
        onHide={() => setSheetApiary(null)}
        apiary={sheetApiary}
        onLocate={locate}
      />

      <ApiaryActionsSheet
        apiary={actionsApiary}
        onHide={() => setActionsApiary(null)}
        onOpen={(apiary) => { setActionsApiary(null); setSheetApiary(apiary); }}
        onLocate={(apiary) => { setActionsApiary(null); locate(apiary); }}
        onEdit={(apiary) => { setActionsApiary(null); setEditApiary(apiary); }}
        onDelete={(apiary) => { setActionsApiary(null); setDeleteError(null); setDeletingApiary(apiary); }}
      />

      {editApiary && <ApiaryFormModal onHide={() => setEditApiary(null)} apiary={editApiary} />}

      {newApiaryAt && (
        <ApiaryFormModal
          onHide={() => setNewApiaryAt(null)}
          latitude={newApiaryAt.lat}
          longitude={newApiaryAt.lng}
          onSaved={reload}
        />
      )}

      <ConfirmationModal
        show={deletingApiary !== null}
        onHide={() => setDeletingApiary(null)}
        onConfirm={handleDelete}
        itemName={deletingApiary ? `le rucher #${deletingApiary.id}` : ''}
        isDeleting={deleting}
        deleteError={deleteError}
      />
    </PageLayout>
  );
}
