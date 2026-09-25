import { Badge } from 'react-bootstrap';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAuth } from 'react-oidc-context';
import { Nest, deleteNest, archiveNest } from '../../store/slices/nestsSlice';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { ConfirmationModal } from '../modals';
import { AppDispatch } from '../../store/store';
import { AppModal, FieldRow, IconButton } from '../ui';
import { ACTION_ICONS, OBJECT_ICONS } from '../../utils/icons';
import { formatDate } from '../../utils/format';

interface NestInfoPopupProps {
  show: boolean;
  onHide: () => void;
  nest: Nest | null;
  onAddAtLocation?: (lat: number, lng: number) => void;
}

export default function NestInfoPopup({ show, onHide, nest, onAddAtLocation }: NestInfoPopupProps) {
  const dispatch = useDispatch<AppDispatch>();
  const auth = useAuth();
  const { canDeleteNest, canArchiveNest, accessToken } = useUserPermissions();
  
  // États pour la suppression
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // États pour l'archivage
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  if (!nest) return null;

  // Logique de suppression
  const handleDelete = async () => {
    if (!nest?.id || !accessToken) return;
    
    setIsDeleting(true);
    setDeleteError(null);
    
    try {
      await dispatch(deleteNest({ 
        nestId: nest.id, 
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

  // Logique d'archivage
  const handleArchive = async () => {
    if (!nest?.id || !accessToken) return;

    setIsArchiving(true);
    setArchiveError(null);

    try {
      await dispatch(archiveNest({
        nestId: nest.id,
        accessToken
      })).unwrap();

      setShowArchiveModal(false);
      onHide(); // Fermer le popup principal
    } catch (error) {
      setArchiveError(error as string);
    } finally {
      setIsArchiving(false);
    }
  };

  const confirming = showDeleteModal || showArchiveModal;
  const canDelete = auth.isAuthenticated && canDeleteNest(nest);
  const canArchive = auth.isAuthenticated && canArchiveNest() && !nest.archived;
  const canAddHere = auth.isAuthenticated && onAddAtLocation;

  return (
    <>
      <AppModal
        show={show && !confirming}
        onHide={onHide}
        icon={OBJECT_ICONS.nest}
        title={`Nid #${nest.id}`}
        badges={(
          <Badge bg={nest.destroyed ? 'secondary' : 'danger'} className="fw-normal">
            {nest.destroyed ? 'Détruit' : 'Actif'}
          </Badge>
        )}
      >
        <FieldRow label="Lieu">{nest.public_place ? 'Public' : 'Privé'}</FieldRow>
        {nest.destroyed && nest.destroyed_at && <FieldRow label="Détruit le">{formatDate(nest.destroyed_at)}</FieldRow>}
        {nest.created_at && <FieldRow label="Signalé le">{formatDate(nest.created_at)}</FieldRow>}
        {nest.created_by && <FieldRow label="Signalé par">{nest.created_by.display_name || nest.created_by.guid}</FieldRow>}
        {nest.address && (
          <div className="text-muted small mt-1 d-flex gap-1">
            <i className="bi bi-geo-alt flex-shrink-0" aria-hidden="true" />
            <span>{nest.address}</span>
          </div>
        )}
        {nest.comments && <p className="small mt-2 mb-0">{nest.comments}</p>}

        {(canAddHere || canArchive || canDelete) && (
          <div className="sheet-actions mt-3">
            {canAddHere && (
              <IconButton
                variant="outline-secondary"
                icon={ACTION_ICONS.addHere}
                label="Ajouter à cette position"
                onClick={() => onAddAtLocation(nest.latitude, nest.longitude)}
              />
            )}
            {canArchive && (
              <IconButton variant="outline-warning" icon={ACTION_ICONS.archive} label="Archiver" className="ms-auto" onClick={() => setShowArchiveModal(true)} />
            )}
            {canDelete && (
              <IconButton
                variant="outline-danger"
                icon={ACTION_ICONS.delete}
                label="Supprimer"
                className={canArchive ? '' : 'ms-auto'}
                onClick={() => setShowDeleteModal(true)}
              />
            )}
          </div>
        )}
      </AppModal>

      <ConfirmationModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemName={`le nid #${nest.id}`}
        action="delete"
        isDeleting={isDeleting}
        deleteError={deleteError}
      />

      <ConfirmationModal
        show={showArchiveModal}
        onHide={() => setShowArchiveModal(false)}
        onConfirm={handleArchive}
        itemName={`le nid #${nest.id}`}
        action="archive"
        isDeleting={isArchiving}
        deleteError={archiveError}
      />
    </>
  );
}
