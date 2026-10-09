import { Alert, Badge, Button } from 'react-bootstrap';
import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { Nest, NestPhoto, deleteNest, archiveNest, deleteNestPhoto, selectNestById } from '../../store/slices/nestsSlice';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useHistoryAction } from '../../hooks/useHistoryAction';
import { ConfirmationModal } from '../modals';
import { AuthImage, ClampedText } from '../common';
import { NearbyApiaries, NestFormModal, NestPhotos } from '../nests';
import { AppModal, ConfirmDialog, FieldRow, SheetActions } from '../ui';
import { ACTION_ICONS, OBJECT_ICONS } from '../../utils/icons';
import { formatDate } from '../../utils/format';

interface NestInfoPopupProps {
  show: boolean;
  onHide: () => void;
  nest: Nest | null;
  onAddAtLocation?: (lat: number, lng: number) => void;
}

/** Dialog shown in place of the sheet (one dialog at a time) */
type SubDialog =
  | { kind: 'edit' | 'delete' | 'archive' }
  | { kind: 'photo' | 'photo-delete'; photo: NestPhoto };

/** Detail of a nest; what the user may change comes from the backend (`permissions`). */
export default function NestInfoPopup({ show, onHide, nest, onAddAtLocation }: NestInfoPopupProps) {
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const { canArchiveNest } = useUserPermissions();
  const historyAction = useHistoryAction();
  const [sub, setSub] = useState<SubDialog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The store copy follows the edits made from this sheet
  const stored = useAppSelector((state) => selectNestById(state, nest?.id));
  const current = stored || nest;
  if (!current?.id) return null;
  const nestId = current.id;

  const permissions = current.permissions;
  const mayEdit = Boolean(permissions?.update);
  const mayChangePhotos = Boolean(permissions?.photos);
  const mayDelete = Boolean(permissions?.delete);
  const mayArchive = auth.isAuthenticated && canArchiveNest() && !current.archived;
  const canAddHere = auth.isAuthenticated && onAddAtLocation;
  const photos = current.photos ?? [];
  const history = historyAction(`nest:${nestId}`, `Nid #${nestId}`);

  const closeSub = () => {
    setSub(null);
    setError(null);
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
    () => dispatch(deleteNest({ nestId })).unwrap(),
    () => { setSub(null); onHide(); },
  );

  const handleArchive = () => run(
    () => dispatch(archiveNest({ nestId })).unwrap(),
    () => { setSub(null); onHide(); },
  );

  const handleDeletePhoto = (photo: NestPhoto) => run(
    () => dispatch(deleteNestPhoto({ id: nestId, photoId: photo.id })).unwrap(),
    () => setSub(null),
  );

  return (
    <>
      <AppModal
        show={show && sub === null}
        onHide={onHide}
        icon={OBJECT_ICONS.nest}
        title={`Nid #${nestId}`}
        badges={(
          <Badge bg={current.destroyed ? 'secondary' : 'danger'} className="fw-normal">
            {current.destroyed ? 'Détruit' : 'Actif'}
          </Badge>
        )}
      >
        {error && sub === null && <Alert variant="danger" className="py-2">{error}</Alert>}

        <NestPhotos
          nestId={nestId}
          photos={photos}
          canAdd={mayChangePhotos}
          onOpen={(photo) => setSub({ kind: 'photo', photo })}
          onError={setError}
        />

        <FieldRow label="Lieu">{current.public_place ? 'Public' : 'Privé'}</FieldRow>
        {current.destroyed && current.destroyed_at && <FieldRow label="Détruit le">{formatDate(current.destroyed_at)}</FieldRow>}
        {current.created_at && <FieldRow label="Signalé le">{formatDate(current.created_at)}</FieldRow>}
        {current.created_by && <FieldRow label="Signalé par">{current.created_by.display_name || current.created_by.guid}</FieldRow>}
        {current.address && (
          <div className="text-muted small mt-1 d-flex gap-1">
            <i className="bi bi-geo-alt flex-shrink-0" aria-hidden="true" />
            <ClampedText id={`nest-${nestId}-address`} text={current.address} lines={2} />
          </div>
        )}
        {current.comments && <p className="small mt-2 mb-0">{current.comments}</p>}

        {permissions?.nearby_apiaries && show && sub === null && <NearbyApiaries nestId={nestId} />}

        {(mayEdit || canAddHere || mayArchive || mayDelete || history) && (
          <SheetActions
            className="mt-3"
            more={[
              mayEdit && { icon: ACTION_ICONS.edit, label: 'Modifier', onClick: () => setSub({ kind: 'edit' }) },
              canAddHere && {
                icon: ACTION_ICONS.addHere,
                label: 'Ajouter à cette position',
                onClick: () => onAddAtLocation(current.latitude, current.longitude),
              },
              history,
              mayArchive && { icon: ACTION_ICONS.archive, label: 'Archiver', tone: 'warning', onClick: () => setSub({ kind: 'archive' }) },
              mayDelete && { icon: ACTION_ICONS.delete, label: 'Supprimer', tone: 'danger', onClick: () => setSub({ kind: 'delete' }) },
            ]}
          />
        )}
      </AppModal>

      {sub?.kind === 'edit' && <NestFormModal onHide={closeSub} nest={{ ...current, id: nestId }} />}

      <ConfirmationModal
        show={sub?.kind === 'delete'}
        onHide={closeSub}
        onConfirm={handleDelete}
        itemName={`le nid #${nestId}`}
        action="delete"
        isDeleting={busy}
        deleteError={error}
      />

      <ConfirmationModal
        show={sub?.kind === 'archive'}
        onHide={closeSub}
        onConfirm={handleArchive}
        itemName={`le nid #${nestId}`}
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
