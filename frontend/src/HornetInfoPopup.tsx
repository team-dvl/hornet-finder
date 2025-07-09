import { Modal, Button, ListGroup, Badge } from 'react-bootstrap';
import { Hornet } from './store/store';

interface HornetInfoPopupProps {
  show: boolean;
  onHide: () => void;
  hornet: Hornet | null;
}

export default function HornetInfoPopup({ show, onHide, hornet }: HornetInfoPopupProps) {
  if (!hornet) {
    return null;
  }

  // Formatter la date si disponible
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Non disponible';
    return new Date(dateString).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Convertir la direction en point cardinal
  const getDirectionLabel = (degrees: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return `${degrees}° (${directions[index]})`;
  };

  // Calculer la distance estimée du nid basée sur la durée
  const calculateNestDistance = (duration?: number) => {
    if (!duration || duration <= 0) {
      return {
        distance: 3000, // Distance max par défaut: 3km
        isEstimated: false,
        displayText: "3 km (distance maximale par défaut)"
      };
    }
    
    // 100m par minute = 100m / 60s = 1.67m par seconde
    const distanceInMeters = Math.round((duration / 60) * 100);
    const maxDistance = 3000; // 3km max
    const finalDistance = Math.min(distanceInMeters, maxDistance);
    
    if (finalDistance < 1000) {
      return {
        distance: finalDistance,
        isEstimated: true,
        displayText: `${finalDistance} m (estimé d'après la durée d'absence)`
      };
    } else {
      return {
        distance: finalDistance,
        isEstimated: true,
        displayText: `${(finalDistance / 1000).toFixed(1)} km (estimé d'après la durée d'absence)`
      };
    }
  };

  const nestInfo = calculateNestDistance(hornet.duration);

  // Formater la durée en minutes et secondes
  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Non renseignée';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    }
    return remainingSeconds === 0 ? `${minutes}min` : `${minutes}min ${remainingSeconds}s`;
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="me-2">🐝</span>
          Informations du frelon
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <ListGroup variant="flush">
          {hornet.id && (
            <ListGroup.Item className="d-flex justify-content-between align-items-center">
              <strong>ID:</strong>
              <Badge bg="secondary">{hornet.id}</Badge>
            </ListGroup.Item>
          )}
          
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Position:</strong>
            <span className="text-end">
              <div>Lat: {hornet.latitude.toFixed(6)}</div>
              <div>Lng: {hornet.longitude.toFixed(6)}</div>
            </span>
          </ListGroup.Item>
          
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Direction de vol:</strong>
            <span>{getDirectionLabel(hornet.direction)}</span>
          </ListGroup.Item>
          
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Durée d'absence:</strong>
            <span className={hornet.duration ? "text-info" : "text-muted"}>
              {formatDuration(hornet.duration)}
            </span>
          </ListGroup.Item>
          
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Distance estimée du nid:</strong>
            <span className={nestInfo.isEstimated ? "text-success" : "text-muted"}>
              {nestInfo.displayText}
            </span>
          </ListGroup.Item>
          
          {hornet.created_at && (
            <ListGroup.Item className="d-flex justify-content-between align-items-center">
              <strong>Observé le:</strong>
              <span className="text-muted small">
                {formatDate(hornet.created_at)}
              </span>
            </ListGroup.Item>
          )}
          
          {hornet.updated_at && hornet.updated_at !== hornet.created_at && (
            <ListGroup.Item className="d-flex justify-content-between align-items-center">
              <strong>Mis à jour le:</strong>
              <span className="text-muted small">
                {formatDate(hornet.updated_at)}
              </span>
            </ListGroup.Item>
          )}
          
          {hornet.user_id && (
            <ListGroup.Item className="d-flex justify-content-between align-items-center">
              <strong>Rapporté par:</strong>
              <Badge bg="info">Utilisateur #{hornet.user_id}</Badge>
            </ListGroup.Item>
          )}
          
          <ListGroup.Item>
            <div className="text-muted small">
              <strong>Zone de retour probable:</strong><br/>
              Cette zone triangulaire représente la direction probable du nid du frelon basée sur sa direction de vol observée.
              {nestInfo.isEstimated ? (
                <>
                  {' '}La zone s&apos;étend sur {nestInfo.distance < 1000 ? `${nestInfo.distance} m` : `${(nestInfo.distance / 1000).toFixed(1)} km`} avec un angle de dispersion de 5°, 
                  calculée d&apos;après la durée d&apos;absence observée (100m par minute d&apos;absence).
                </>
              ) : (
                <> La zone s&apos;étend sur la distance maximale de 3 km avec un angle de dispersion de 5°.</>
              )}
            </div>
          </ListGroup.Item>
        </ListGroup>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Fermer
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
