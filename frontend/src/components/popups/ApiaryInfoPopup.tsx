import { Alert } from 'react-bootstrap';
import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { Apiary, updateApiary, selectApiaryById, deleteApiary } from '../../store/slices/apiariesSlice';
import { ConfirmationModal } from '../modals';
import InfestationLevelInput, { InfestationLevel } from '../common/InfestationLevelInput';
import { AuthImage } from '../common';
import { ApiaryFormModal, ApiarySharingPanel } from '../apiaries';
import { AppModal, FieldRow, IconButton } from '../ui';
import { ACTION_ICONS, OBJECT_ICONS } from '../../utils/icons';
import { formatDate } from '../../utils/format';

const LEVEL_NAMES = { 1: 'low', 2: 'moderate', 3: 'high' } as const;
const LEVEL_VALUES = { low: 1, moderate: 2, high: 3 } as const;

interface ApiaryInfoPopupProps {
  show: boolean;
  onHide: () => void;
  apiary: Apiary | null;
  onAddAtLocation?: (lat: number, lng: number) => void;
}

/** Dialog shown in place of the sheet (one dialog at a time) */
type SubDialog = 'edit' | 'delete' | 'photo';

/** Detail of an apiary; what the user may do comes from the backend (`permissions`). */
export default function ApiaryInfoPopup({ show, onHide, apiary, onAddAtLocation }: ApiaryInfoPopupProps) {
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const [sub, setSub] = useState<SubDialog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // The store copy follows the edits made from this sheet
  const stored = useAppSelector((state) => selectApiaryById(state, apiary?.id));
  const current = stored || apiary;
  if (!current?.id) return null;
  const apiaryId = current.id;

  const mayEdit = Boolean(current.permissions?.update);
  const mayDelete = Boolean(current.permissions?.delete);
  const canAddHere = auth.isAuthenticated && onAddAtLocation;
  const closeSub = () => setSub(null);

  const handleLevel = async (level: InfestationLevel) => {
    const value = LEVEL_VALUES[level];
    if (value === current.infestation_level) return;
    setError(null);
    try {
      await dispatch(updateApiary({ id: apiaryId, values: { infestation_level: value } })).unwrap();
    } catch (updateError) {
      setError(updateError as string);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await dispatch(deleteApiary(apiaryId)).unwrap();
      setSub(null);
      onHide();
    } catch (deleteError) {
      setError(deleteError as string);
    } finally {
      setIsDeleting(false);
    }
  };

  const creatorIsOwner = !current.created_by || current.created_by.guid === current.owner?.guid;

  return (
    <>
      <AppModal
        show={show && sub === null}
        onHide={onHide}
        icon={OBJECT_ICONS.apiary}
        title={`Rucher #${apiaryId}`}
      >
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

        {current.photo_url && (
          <AuthImage
            src={current.photo_url}
            alt="Photo du rucher"
            role="button"
            onClick={() => setSub('photo')}
            className="w-100 mb-2 rounded"
            style={{ height: 160, width: '100%', objectFit: 'cover' }}
          />
        )}

        <div className="text-muted small mb-1">Infestation</div>
        <InfestationLevelInput
          value={LEVEL_NAMES[current.infestation_level] as InfestationLevel}
          readOnly={!mayEdit}
          onChange={(level) => void handleLevel(level)}
        />

        <div className="mt-3">
          {current.afsca_number && <FieldRow label="N° AFSCA"><code>{current.afsca_number}</code></FieldRow>}
          {current.owner && <FieldRow label="Propriétaire">{current.owner.display_name}</FieldRow>}
          {!creatorIsOwner && current.created_by && (
            <FieldRow label="Créé par">{current.created_by.display_name}</FieldRow>
          )}
          {current.created_at && <FieldRow label="Créé le">{formatDate(current.created_at)}</FieldRow>}
        </div>
        {current.comments && <p className="small mt-2 mb-0">{current.comments}</p>}

        {(mayEdit || canAddHere || mayDelete) && (
          <div className="sheet-actions mt-3">
            {mayEdit && (
              <IconButton variant="outline-secondary" icon={ACTION_ICONS.edit} label="Modifier" onClick={() => setSub('edit')} />
            )}
            {canAddHere && (
              <IconButton
                variant="outline-secondary"
                icon={ACTION_ICONS.addHere}
                label="Ajouter à cette position"
                onClick={() => onAddAtLocation(current.latitude, current.longitude)}
              />
            )}
            {mayDelete && (
              <IconButton variant="outline-danger" icon={ACTION_ICONS.delete} label="Supprimer" className="ms-auto" onClick={() => setSub('delete')} />
            )}
          </div>
        )}

        <ApiarySharingPanel apiary={{ ...current, id: apiaryId }} />
      </AppModal>

      {sub === 'edit' && <ApiaryFormModal onHide={closeSub} apiary={current} />}

      <ConfirmationModal
        show={sub === 'delete'}
        onHide={closeSub}
        onConfirm={handleDelete}
        itemName={`le rucher #${apiaryId}`}
        action="delete"
        isDeleting={isDeleting}
        deleteError={error}
      />

      {/* Agrandissement de la photo */}
      <AppModal
        show={sub === 'photo'}
        onHide={closeSub}
        title="Photo"
        size="lg"
        bodyClassName="p-0 d-flex align-items-center bg-dark"
      >
        {sub === 'photo' && current.photo_url && <AuthImage src={current.photo_url} alt="Photo du rucher" className="w-100" />}
      </AppModal>
    </>
  );
}
