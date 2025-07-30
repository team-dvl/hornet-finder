import { Modal, Button } from 'react-bootstrap';

interface CompassPermissionModalProps {
  show: boolean;
  onRequestPermission: () => void;
  onCancel: () => void;
}

export default function CompassPermissionModal({ show, onRequestPermission, onCancel }: CompassPermissionModalProps) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Activer la boussole</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Pour activer la capture de direction, veuillez autoriser l'accès à la boussole.<br/>
          Cette étape est requise par Safari/iOS pour des raisons de sécurité.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button variant="primary" onClick={onRequestPermission}>
          Autoriser la boussole
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
