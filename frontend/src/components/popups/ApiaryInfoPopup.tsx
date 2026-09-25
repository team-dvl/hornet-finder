import { Alert } from 'react-bootstrap';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from 'react-oidc-context';
import { Apiary, updateApiary, selectApiaryById, deleteApiary } from '../../store/slices/apiariesSlice';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { AppDispatch, RootState } from '../../store/store';
import { ConfirmationModal } from '../modals';
import InfestationLevelInput, { InfestationLevel } from '../common/InfestationLevelInput';
import ApiaryGroupPermissions from '../common/ApiaryGroupPermissions';
import { AppModal, FieldRow, IconButton } from '../ui';
import { ACTION_ICONS, OBJECT_ICONS } from '../../utils/icons';
import { formatDate } from '../../utils/format';

const infestationLevelMap = {
  1: 'low',
  2: 'moderate',
  3: 'high',
};
const infestationLevelReverseMap = {
  low: 1,
  moderate: 2,
  high: 3,
};

interface ApiaryInfoPopupProps {
  show: boolean;
  onHide: () => void;
  apiary: Apiary | null;
  onAddAtLocation?: (lat: number, lng: number) => void;
}

export default function ApiaryInfoPopup({ show, onHide, apiary, onAddAtLocation }: ApiaryInfoPopupProps) {
  const dispatch = useDispatch<AppDispatch>();
  const auth = useAuth();
  const { canAddApiary, canDeleteApiary, accessToken } = useUserPermissions(); // Les apiculteurs peuvent modifier leurs ruchers
  const [updateError, setUpdateError] = useState<string | null>(null);

  // États pour la suppression
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Récupérer le rucher mis à jour depuis Redux si on a un ID, sinon utiliser la prop
  const updatedApiary = useSelector((state: RootState) => 
    selectApiaryById(state, apiary?.id)
  );
  
  // Utiliser le rucher mis à jour depuis Redux, ou la prop en fallback
  const currentApiary = updatedApiary || apiary;

  if (!currentApiary) return null;

  // Logique de suppression
  const handleDelete = async () => {
    if (!currentApiary?.id || !accessToken) return;
    
    setIsDeleting(true);
    setDeleteError(null);
    
    try {
      await dispatch(deleteApiary({ 
        apiaryId: currentApiary.id, 
        accessToken 
      })).unwrap();
      
      setShowDeleteModal(false);
      onHide(); // Fermer le popup principal
    } catch (error) {
      setDeleteError(error as string);
    } finally {
      setIsDeleting(false);
    }
  };

  // Vérifier si l'utilisateur peut éditer ce rucher (apiculteur qui l'a créé ou admin)
  const isAdmin = auth.user?.profile?.role === 'admin' || auth.user?.profile?.is_admin;
  const canEdit = canAddApiary && (isAdmin || auth.user?.profile?.sub === currentApiary.created_by?.guid);

  const canDelete = auth.isAuthenticated && canDeleteApiary(currentApiary);
  const canAddHere = auth.isAuthenticated && onAddAtLocation;

  return (
    <>
      <AppModal
        show={show && !showDeleteModal}
        onHide={onHide}
        icon={OBJECT_ICONS.apiary}
        title={`Rucher #${currentApiary.id}`}
      >
        <div className="text-muted small mb-1">Infestation</div>
        <InfestationLevelInput
          value={infestationLevelMap[currentApiary.infestation_level] as InfestationLevel}
          readOnly={!canEdit}
          onChange={async (level) => {
            const newLevel = infestationLevelReverseMap[level];
            if (newLevel !== currentApiary.infestation_level && auth.user?.access_token && currentApiary.id) {
              try {
                await dispatch(updateApiary({
                  id: currentApiary.id,
                  infestation_level: newLevel,
                  accessToken: auth.user.access_token
                })).unwrap();
              } catch (error) {
                setUpdateError(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
              }
            }
          }}
        />
        {updateError && <Alert variant="danger" className="mt-2 mb-0 py-2">{updateError}</Alert>}

        <div className="mt-3">
          {currentApiary.created_at && <FieldRow label="Créé le">{formatDate(currentApiary.created_at)}</FieldRow>}
          {currentApiary.created_by && (
            <FieldRow label="Créé par">{currentApiary.created_by.display_name || currentApiary.created_by.guid}</FieldRow>
          )}
        </div>
        {currentApiary.comments && <p className="small mt-2 mb-0">{currentApiary.comments}</p>}

        {/* Permissions étendues par groupe */}
        {Array.isArray(currentApiary.extended_permissions) && currentApiary.extended_permissions.length > 0 && (
          <div className="mt-3">
            <div className="text-muted small mb-1">Permissions supplémentaires</div>
            <ApiaryGroupPermissions permissions={currentApiary.extended_permissions} readOnly />
          </div>
        )}

        {(canAddHere || canDelete) && (
          <div className="sheet-actions mt-3">
            {canAddHere && (
              <IconButton
                variant="outline-secondary"
                icon={ACTION_ICONS.addHere}
                label="Ajouter à cette position"
                onClick={() => onAddAtLocation(currentApiary.latitude, currentApiary.longitude)}
              />
            )}
            {canDelete && (
              <IconButton variant="outline-danger" icon={ACTION_ICONS.delete} label="Supprimer" className="ms-auto" onClick={() => setShowDeleteModal(true)} />
            )}
          </div>
        )}
      </AppModal>

      <ConfirmationModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemName={`le rucher #${currentApiary.id}`}
        action="delete"
        isDeleting={isDeleting}
        deleteError={deleteError}
      />
    </>
  );
}
