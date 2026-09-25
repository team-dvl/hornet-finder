import { Button } from 'react-bootstrap';
import { AppModal } from '../ui';

interface CompassPermissionModalProps {
  show: boolean;
  onRequestPermission: () => void;
  onCancel: () => void;
}

/** iOS asks for an explicit permission, from a user gesture, before giving the compass. */
export default function CompassPermissionModal({ show, onRequestPermission, onCancel }: CompassPermissionModalProps) {
  return (
    <AppModal
      show={show}
      onHide={onCancel}
      compact
      title="Activer la boussole ?"
      footer={(
        <Button variant="primary" onClick={onRequestPermission}>
          <i className="bi bi-compass me-2" aria-hidden="true" />
          Autoriser
        </Button>
      )}
    >
      <p className="mb-0">Safari demande votre accord avant de donner accès à la boussole.</p>
    </AppModal>
  );
}
