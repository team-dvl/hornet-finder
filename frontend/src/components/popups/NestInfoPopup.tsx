import { Modal, Badge } from 'react-bootstrap';
import { Nest } from '../../store/store';

interface NestInfoPopupProps {
  show: boolean;
  onHide: () => void;
  nest: Nest | null;
}

export default function NestInfoPopup({ show, onHide, nest }: NestInfoPopupProps) {
  if (!nest) return null;

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
          <div className="text-muted small">
            Latitude: {nest.latitude.toFixed(6)}
            <br />
            Longitude: {nest.longitude.toFixed(6)}
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
            <div className="text-muted">{nest.created_by}</div>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
