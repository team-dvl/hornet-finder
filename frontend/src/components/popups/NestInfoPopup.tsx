import { Alert, Button, Spinner } from 'react-bootstrap';
import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  Nest, NestPhoto, deleteNest, archiveNest, deleteNestPhoto, selectNestById,
} from '../../store/slices/nestsSlice';
import { deleteNestEvent, fetchNestDetail, recordNestEvent, type NestEvent } from '../../store/store';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useHistoryAction } from '../../hooks/useHistoryAction';
import { ConfirmationModal } from '../modals';
import { AuthImage, ClampedText } from '../common';
import {
  NearbyApiaries, NestEventModal, NestFormModal, NestJournal, NestOwnerModal, NestPhotos, NestStatusBadge, NestSteps,
} from '../nests';
import { AppModal, ConfirmDialog, FieldRow, SheetActions } from '../ui';
import { ACTION_ICONS, OBJECT_ICONS } from '../../utils/icons';
import { formatDate } from '../../utils/format';
import { heightLabel, isOpenStatus, nestTypeLabel, sizeLabel } from '../../utils/nestStatus';

interface NestInfoPopupProps {
  show: boolean;
  onHide: () => void;
  nest: Nest | null;
  onAddAtLocation?: (lat: number, lng: number) => void;
  /** Shows the nest on the map (from the nests module) */
  onLocate?: (nest: Nest) => void;
  /** The nest changed (a visit, a destruction…): lists showing it reload */
  onChanged?: (nest: Nest) => void;
}

/** Dialog shown in place of the sheet (one dialog at a time) */
type SubDialog =
  | { kind: 'edit' | 'delete' | 'archive' | 'reactivate' | 'visit' | 'destruction' | 'owner' }
  | { kind: 'photo' | 'photo-delete'; photo: NestPhoto }
  | { kind: 'event-delete'; event: NestEvent };

/**
 * Detail of a nest: where it stands, what is known of it, its journal, and
 * what the user may do next (from the backend's `permissions`).
 */
export default function NestInfoPopup({ show, onHide, nest, onAddAtLocation, onLocate, onChanged }: NestInfoPopupProps) {
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const { canArchiveNest, canSeeAllNests } = useUserPermissions();
  const historyAction = useHistoryAction();
  const [sub, setSub] = useState<SubDialog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The detail (journal included) of the nest shown, fetched at each opening
  const [detail, setDetail] = useState<Nest | null>(null);

  const nestId = nest?.id;
  useEffect(() => {
    if (!show || !nestId || !auth.isAuthenticated) return;
    let cancelled = false;
    dispatch(fetchNestDetail(nestId)).unwrap()
      .then((found) => { if (!cancelled) setDetail(found); })
      .catch(() => { /* the public list has no detail: the sheet shows what it has */ });
    return () => { cancelled = true; setDetail(null); };
  }, [show, nestId, auth.isAuthenticated, dispatch]);

  // The store copy follows the edits made from this sheet
  const stored = useAppSelector((state) => selectNestById(state, nestId));
  const current = (detail?.id === nestId ? detail : null) ?? stored ?? nest;
  if (!current?.id) return null;
  const id = current.id;

  const permissions = current.permissions;
  const mayEdit = Boolean(permissions?.update);
  const mayChangePhotos = Boolean(permissions?.photos);
  const mayDelete = Boolean(permissions?.delete);
  const mayVisit = Boolean(permissions?.visit);
  const mayDestroy = Boolean(permissions?.destroy);
  const mayReactivate = Boolean(permissions?.reactivate) && !isOpenStatus(current.status);
  const mayChangeOwner = Boolean(permissions?.change_owner);
  // Shown when it is not the reporter, who is already named
  const followedBy = current.owner && current.owner.guid !== current.created_by?.guid ? current.owner : null;
  const mayArchive = auth.isAuthenticated && canArchiveNest() && !current.archived;
  const canAddHere = auth.isAuthenticated && onAddAtLocation;
  const photos = current.photos ?? [];
  const history = historyAction(`nest:${id}`, `Nid #${id}`);
  // Without the right to record a visit, the destruction is the reporter's short form
  const asReporter = mayDestroy && !mayVisit;

  const closeSub = () => {
    setSub(null);
    setError(null);
  };

  const changed = (updated: Nest) => {
    setDetail(updated);
    onChanged?.(updated);
  };

  // Runs an action of a sub-dialog; `then` decides where the user lands
  const run = async (action: () => Promise<unknown>, then: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      then();
    } catch (actionError) {
      setError(actionError as string);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => run(
    () => dispatch(deleteNest({ nestId: id })).unwrap(),
    () => { setSub(null); onHide(); },
  );

  const handleArchive = () => run(
    () => dispatch(archiveNest({ nestId: id })).unwrap(),
    () => { setSub(null); onHide(); },
  );

  const handleDeletePhoto = (photo: NestPhoto) => run(
    () => dispatch(deleteNestPhoto({ id, photoId: photo.id })).unwrap().then(changed),
    () => setSub(null),
  );

  // Handed over: the sheet shows who follows it now, or closes when the requester no longer sees the nest
  const handleTransferred = (updated: Nest) => {
    onChanged?.(updated);
    if (canSeeAllNests) {
      setDetail(updated);
      setSub(null);
    } else {
      setSub(null);
      onHide();
    }
  };

  const handleDeleteEvent = (event: NestEvent) => run(
    () => dispatch(deleteNestEvent({ id, eventId: event.id })).unwrap().then(changed),
    () => setSub(null),
  );

  const handleReactivate = () => run(
    () => dispatch(recordNestEvent({ id, values: { kind: 'reactivation' } })).unwrap().then(changed),
    () => setSub(null),
  );

  const details = [nestTypeLabel(current.nest_type), heightLabel(current.height_class), sizeLabel(current.size_class)];

  return (
    <>
      <AppModal
        show={show && sub === null}
        onHide={onHide}
        icon={OBJECT_ICONS.nest}
        title={`Nid #${id}`}
        badges={<NestStatusBadge status={current.status} />}
      >
        {error && sub === null && <Alert variant="danger" className="py-2">{error}</Alert>}

        <NestPhotos
          nestId={id}
          photos={photos}
          canAdd={mayChangePhotos}
          onOpen={(photo) => setSub({ kind: 'photo', photo })}
          onError={setError}
          onChanged={changed}
        />

        <NestSteps nest={current} />

        {details[0] && <FieldRow label="Type">{details[0]}</FieldRow>}
        {details[1] && <FieldRow label="Hauteur">{details[1]}</FieldRow>}
        {details[2] && <FieldRow label="Taille">{details[2]}</FieldRow>}
        <FieldRow label="Lieu">{current.public_place ? 'Public' : 'Privé'}</FieldRow>
        {current.created_at && !current.events && <FieldRow label="Signalé le">{formatDate(current.created_at)}</FieldRow>}
        {current.created_by && <FieldRow label="Signalé par">{current.created_by.display_name || current.created_by.guid}</FieldRow>}
        {followedBy && <FieldRow label="Suivi par">{followedBy.display_name || followedBy.guid}</FieldRow>}
        {current.contact_phone && (
          <FieldRow label="Téléphone">
            <a href={`tel:${current.contact_phone.replace(/[^\d+]/g, '')}`}>{current.contact_phone}</a>
          </FieldRow>
        )}
        {current.address && (
          <div className="text-muted small mt-1 d-flex gap-1">
            <i className="bi bi-geo-alt flex-shrink-0" aria-hidden="true" />
            <ClampedText id={`nest-${id}-address`} text={current.address} lines={2} />
          </div>
        )}
        {current.comments && <p className="small mt-2 mb-0">{current.comments}</p>}
        {current.private_comments && (
          <p className="small mt-2 mb-0 d-flex gap-1">
            <i className="bi bi-lock flex-shrink-0" role="img" aria-label="Pour les coordinateurs" title="Pour les coordinateurs" />
            <span>{current.private_comments}</span>
          </p>
        )}

        {permissions?.nearby_apiaries && show && sub === null && <NearbyApiaries nestId={id} />}

        {(mayVisit || mayDestroy || mayEdit || canAddHere || mayArchive || mayDelete || history || onLocate || mayReactivate
          || mayChangeOwner) && (
          <SheetActions
            className="mt-3"
            more={[
              onLocate && { icon: ACTION_ICONS.showOnMap, label: 'Voir sur la carte', onClick: () => onLocate(current) },
              mayEdit && { icon: ACTION_ICONS.edit, label: 'Modifier', onClick: () => setSub({ kind: 'edit' }) },
              canAddHere && {
                icon: ACTION_ICONS.addHere,
                label: 'Ajouter à cette position',
                onClick: () => onAddAtLocation(current.latitude, current.longitude),
              },
              mayReactivate && { icon: 'arrow-counterclockwise', label: 'Réactiver', onClick: () => setSub({ kind: 'reactivate' }) },
              mayChangeOwner && { icon: ACTION_ICONS.transfer, label: 'Transférer', onClick: () => setSub({ kind: 'owner' }) },
              history,
              mayArchive && { icon: ACTION_ICONS.archive, label: 'Archiver', tone: 'warning', onClick: () => setSub({ kind: 'archive' }) },
              mayDelete && { icon: ACTION_ICONS.delete, label: 'Supprimer', tone: 'danger', onClick: () => setSub({ kind: 'delete' }) },
            ]}
          >
            {mayVisit && (
              <Button variant={current.status === 'reported' ? 'primary' : 'outline-primary'} onClick={() => setSub({ kind: 'visit' })}>
                <span className="me-1" aria-hidden="true">🔍</span>Vérifier
              </Button>
            )}
            {mayDestroy && (
              <Button variant={current.status === 'confirmed' || asReporter ? 'primary' : 'outline-primary'}
                onClick={() => setSub({ kind: 'destruction' })}>
                <span className="me-1" aria-hidden="true">✅</span>{asReporter ? 'Signaler neutralisé' : 'Neutraliser'}
              </Button>
            )}
          </SheetActions>
        )}

        {current.events
          ? <NestJournal events={current.events} onDelete={(event) => setSub({ kind: 'event-delete', event })} />
          : show && auth.isAuthenticated && <div className="text-center mt-3"><Spinner animation="border" size="sm" /></div>}
      </AppModal>

      {sub?.kind === 'edit' && <NestFormModal onHide={closeSub} nest={{ ...current, id }} onSaved={changed} />}

      {sub?.kind === 'owner' && (
        <NestOwnerModal onHide={closeSub} nest={{ ...current, id }} keepsSight={canSeeAllNests} onTransferred={handleTransferred} />
      )}

      {(sub?.kind === 'visit' || sub?.kind === 'destruction') && (
        <NestEventModal
          onHide={closeSub}
          nest={{ ...current, id }}
          kind={sub.kind}
          asReporter={sub.kind === 'destruction' && asReporter}
          onSaved={changed}
        />
      )}

      <ConfirmDialog
        show={sub?.kind === 'event-delete'}
        onHide={closeSub}
        onConfirm={() => sub?.kind === 'event-delete' && void handleDeleteEvent(sub.event)}
        title="Supprimer cette entrée du journal ?"
        message="Le statut du nid sera recalculé sans elle."
        confirmLabel="Supprimer"
        confirmIcon={ACTION_ICONS.delete}
        busy={busy}
        error={error}
      />

      <ConfirmDialog
        show={sub?.kind === 'reactivate'}
        onHide={closeSub}
        onConfirm={() => void handleReactivate()}
        title={`Réactiver le nid #${id} ?`}
        message="Il redevient « Signalé » et attend une nouvelle vérification."
        confirmLabel="Réactiver"
        confirmIcon="arrow-counterclockwise"
        variant="primary"
        busy={busy}
        error={error}
      />

      <ConfirmationModal
        show={sub?.kind === 'delete'}
        onHide={closeSub}
        onConfirm={handleDelete}
        itemName={`le nid #${id}`}
        action="delete"
        isDeleting={busy}
        deleteError={error}
      />

      <ConfirmationModal
        show={sub?.kind === 'archive'}
        onHide={closeSub}
        onConfirm={handleArchive}
        itemName={`le nid #${id}`}
        action="archive"
        isDeleting={busy}
        deleteError={error}
      />

      {/* Agrandissement d'une photo */}
      <AppModal
        show={sub?.kind === 'photo'}
        onHide={closeSub}
        title="Photo"
        size="lg"
        bodyClassName="p-0 d-flex align-items-center bg-dark"
        footer={mayChangePhotos && sub?.kind === 'photo' ? (
          <Button variant="outline-danger" onClick={() => setSub({ kind: 'photo-delete', photo: sub.photo })}>
            <i className={`bi bi-${ACTION_ICONS.delete} me-2`} aria-hidden="true" />
            Supprimer
          </Button>
        ) : undefined}
      >
        {sub?.kind === 'photo' && sub.photo.url && <AuthImage src={sub.photo.url} alt="Photo du nid" className="w-100" />}
      </AppModal>

      <ConfirmDialog
        show={sub?.kind === 'photo-delete'}
        onHide={() => (sub?.kind === 'photo-delete' ? setSub({ kind: 'photo', photo: sub.photo }) : closeSub())}
        onConfirm={() => sub?.kind === 'photo-delete' && void handleDeletePhoto(sub.photo)}
        title="Supprimer cette photo ?"
        message="Elle sera retirée du nid pour tout le monde."
        confirmLabel="Supprimer"
        confirmIcon={ACTION_ICONS.delete}
        busy={busy}
        error={error}
      />
    </>
  );
}
