import { Modal, Button, Alert } from 'react-bootstrap';

type ConfirmationAction = 'delete' | 'archive';

interface ConfirmationModalProps {
  show: boolean;
  onHide: () => void;
  onConfirm: () => void;
  itemName: string;
  itemType: 'frelon' | 'nid' | 'rucher';
  action?: ConfirmationAction;
  isDeleting?: boolean;
  deleteError?: string | null;
}

const ICONS: Record<ConfirmationModalProps['itemType'], string> = {
  frelon: '🐝',
  nid: '🏴',
  rucher: '🏠',
};

const ACTION_CONFIG: Record<ConfirmationAction, {
  title: string;
  variant: 'danger' | 'warning';
  confirmLabel: string;
  confirmingLabel: string;
  confirmIcon: string;
  getWarningMessage: (itemType: ConfirmationModalProps['itemType']) => string;
}> = {
  delete: {
    title: 'Confirmer la suppression',
    variant: 'danger',
    confirmLabel: 'Supprimer définitivement',
    confirmingLabel: 'Suppression...',
    confirmIcon: 'fa-trash',
    getWarningMessage: (itemType) => {
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
    },
  },
  archive: {
    title: "Confirmer l'archivage",
    variant: 'warning',
    confirmLabel: 'Archiver',
    confirmingLabel: 'Archivage...',
    confirmIcon: 'fa-box-archive',
    getWarningMessage: () => "Cet élément ne sera plus affiché par défaut, mais restera consultable via les données archivées.",
  },
};

export default function ConfirmationModal({
  show,
  onHide,
  onConfirm,
  itemName,
  itemType,
  action = 'delete',
  isDeleting = false,
  deleteError = null
}: ConfirmationModalProps) {
  const config = ACTION_CONFIG[action];

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="border-0">
        <Modal.Title className={`text-${config.variant}`}>
          <i className="fas fa-exclamation-triangle me-2"></i>
          {config.title}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <div className="text-center mb-3">
          <div style={{ fontSize: '3rem' }} className="mb-2">
            {ICONS[itemType]}
          </div>
          <h5 className="mb-3">
            {config.confirmLabel.split(' ')[0]} le {itemName} ?
          </h5>
        </div>
        
        <Alert variant={config.variant} className="mb-3">
          <strong>⚠️ Attention :</strong> {action === 'delete' ? 'Cette action est irréversible.' : 'Cette action ne peut pas être annulée depuis l\'interface.'}
          <br />
          {config.getWarningMessage(itemType)}
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
          variant={config.variant} 
          onClick={onConfirm}
          disabled={isDeleting}
          className="px-4"
        >
          {isDeleting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              {config.confirmingLabel}
            </>
          ) : (
            <>
              <i className={`fas ${config.confirmIcon} me-2`}></i>
              {config.confirmLabel}
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
