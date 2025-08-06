import { Modal, Button, Alert } from 'react-bootstrap';

interface DeleteConfirmationModalProps {
  show: boolean;
  onHide: () => void;
  onConfirm: () => void;
  itemName: string;
  itemType: 'frelon' | 'nid' | 'rucher';
  isDeleting?: boolean;
  deleteError?: string | null;
}

export default function DeleteConfirmationModal({
  show,
  onHide,
  onConfirm,
  itemName,
  itemType,
  isDeleting = false,
  deleteError = null
}: DeleteConfirmationModalProps) {
  const getIcon = () => {
    switch (itemType) {
      case 'frelon': return '🐝';
      case 'nid': return '🏴';
      case 'rucher': return '🏠';
      default: return '❓';
    }
  };

  const getWarningMessage = () => {
    switch (itemType) {
      case 'frelon':
        return 'Toutes les données associées à ce frelon  seront définitivement perdues.';
      case 'nid':
        return 'Toutes les informations de ce nid seront définitivement perdues.';
      case 'rucher':
        return 'Toutes les informations de ce rucher seront définitivement perdues.';
      default:
        return 'Cette action est irréversible.';
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="border-0">
        <Modal.Title className="text-danger">
          <i className="fas fa-exclamation-triangle me-2"></i>
          Confirmer la suppression
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <div className="text-center mb-3">
          <div style={{ fontSize: '3rem' }} className="mb-2">
            {getIcon()}
          </div>
          <h5 className="mb-3">
            Supprimer {itemType === 'frelon' ? 'le' : itemType === 'nid' ? 'le' : 'le'} {itemName} ?
          </h5>
        </div>
        
        <Alert variant="warning" className="mb-3">
          <strong>⚠️ Attention :</strong> Cette action est irréversible.
          <br />
          {getWarningMessage()}
        </Alert>

        {deleteError && (
          <Alert variant="danger" className="mb-3">
            <strong>Erreur :</strong> {deleteError}
          </Alert>
        )}
        
        <p className="text-muted text-center">
          Êtes-vous sûr de vouloir continuer ?
        </p>
      </Modal.Body>
      
      <Modal.Footer className="border-0 justify-content-center">
        <Button 
          variant="outline-secondary" 
          onClick={onHide}
          disabled={isDeleting}
        >
          Annuler
        </Button>
        <Button 
          variant="danger" 
          onClick={onConfirm}
          disabled={isDeleting}
          className="px-4"
        >
          {isDeleting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Suppression...
            </>
          ) : (
            <>
              <i className="fas fa-trash me-2"></i>
              Supprimer définitivement
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
