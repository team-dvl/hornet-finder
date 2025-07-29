import { Modal, Badge, Button } from 'react-bootstrap';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAuth } from 'react-oidc-context';
import { Nest, deleteNest } from '../../store/slices/nestsSlice';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { DeleteConfirmationModal } from '../modals';
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
  const { canDeleteNest, accessToken } = useUserPermissions();
  
  // États pour la suppression
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
            className="me-auto"
          >
            <i className="fas fa-trash me-1"></i>
            Supprimer
          </Button>
        )}
        
        <Button variant="secondary" onClick={onHide}>
          Fermer
        </Button>
      </Modal.Footer>
      
      {/* Modal de confirmation de suppression */}
      <DeleteConfirmationModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemName={`nid #${nest.id}`}
        itemType="nid"
        isDeleting={isDeleting}
        deleteError={deleteError}
      />
    </Modal>
  );
}
