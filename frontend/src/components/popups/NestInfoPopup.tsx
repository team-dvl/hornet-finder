import { Modal, Badge, Button } from 'react-bootstrap';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAuth } from 'react-oidc-context';
import { Nest, deleteNest, archiveNest } from '../../store/slices/nestsSlice';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { ConfirmationModal } from '../modals';
import { AppDispatch } from '../../store/store';
import CoordinateInput from '../common/CoordinateInput';

interface NestInfoPopupProps {
  show: boolean;
  onHide: () => void;
  nest: Nest | null;
}

export default function NestInfoPopup({ show, onHide, nest }: NestInfoPopupProps) {
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

  const getStatusBadge = () => {
    if (nest.destroyed) {
      return (
        <Badge bg="secondary" className="ms-2">
          💀 Détruit
        </Badge>
      );
    }
    return (
      <Badge bg="danger" className="ms-2">
        🏴 Actif
      </Badge>
    );
  };

  const getLocationBadge = () => {
    if (nest.public_place) {
      return (
        <Badge bg="warning" className="ms-2">
          🏛️ Lieu public
        </Badge>
      );
    }
    return (
      <Badge bg="info" className="ms-2">
        🏠 Lieu privé
      </Badge>
    );
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          🏴 Nid de frelon #{nest.id}
          {getStatusBadge()}
          {getLocationBadge()}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <strong>Coordonnées :</strong>
          <div className="mt-2">
            <CoordinateInput
              label="Latitude"
              value={nest.latitude}
              onChange={() => {}} // Read-only
              labelPosition="horizontal"
              readOnly
            />
            <CoordinateInput
              label="Longitude"
              value={nest.longitude}
              onChange={() => {}} // Read-only
              labelPosition="horizontal"
              readOnly
            />
          </div>
        </div>

        {nest.address && (
          <div className="mb-3">
            <strong>Adresse :</strong>
            <div>{nest.address}</div>
          </div>
        )}

        {nest.comments && (
          <div className="mb-3">
            <strong>Commentaires :</strong>
            <div>{nest.comments}</div>
          </div>
        )}

        {nest.destroyed && nest.destroyed_at && (
          <div className="mb-3">
            <strong>Détruit le :</strong>
            <div className="text-muted">
              {new Date(nest.destroyed_at).toLocaleDateString('fr-FR')}
            </div>
          </div>
        )}

        {nest.created_at && (
          <div className="mb-3">
            <strong>Signalé le :</strong>
            <div className="text-muted">
              {new Date(nest.created_at).toLocaleDateString('fr-FR')}
            </div>
          </div>
        )}

        {nest.created_by && (
          <div>
            <strong>Signalé par :</strong>
            <div className="text-muted">
              {nest.created_by.display_name || nest.created_by.guid}
            </div>
          </div>
        )}
      </Modal.Body>
      
      <Modal.Footer>
        {/* Bouton de suppression pour les administrateurs et propriétaires */}
        {auth.isAuthenticated && canDeleteNest(nest) && (
          <Button 
            variant="outline-danger" 
            onClick={() => setShowDeleteModal(true)}
            className="me-2"
          >
            <i className="fas fa-trash me-1"></i>
            Supprimer
          </Button>
        )}

        {/* Bouton d'archivage réservé aux administrateurs */}
        {auth.isAuthenticated && canArchiveNest() && !nest.archived && (
          <Button
            variant="outline-warning"
            onClick={() => setShowArchiveModal(true)}
            className="me-auto"
          >
            <i className="fas fa-box-archive me-1"></i>
            Archiver
          </Button>
        )}
        
        <Button variant="secondary" onClick={onHide}>
          Fermer
        </Button>
      </Modal.Footer>
      
      {/* Modal de confirmation de suppression */}
      <ConfirmationModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemName={`nid #${nest.id}`}
        itemType="nid"
        action="delete"
        isDeleting={isDeleting}
        deleteError={deleteError}
      />

      {/* Modal de confirmation d'archivage */}
      <ConfirmationModal
        show={showArchiveModal}
        onHide={() => setShowArchiveModal(false)}
        onConfirm={handleArchive}
        itemName={`nid #${nest.id}`}
        itemType="nid"
        action="archive"
        isDeleting={isArchiving}
        deleteError={archiveError}
      />
    </Modal>
  );
}
