import { Modal, Button, ListGroup, Badge } from 'react-bootstrap';
import { Hornet } from './store/store';
import { useUserPermissions } from './hooks/useUserPermissions';
import { useAuth } from 'react-oidc-context';
import { getColorLabel } from './utils/colors';

interface HornetReturnZoneInfoPopupProps {
  show: boolean;
  onHide: () => void;
  hornet: Hornet | null;
  clickPosition?: { lat: number; lng: number } | null; // Position cliquée sur la zone de retour
  onAddAtLocation?: (lat: number, lng: number) => void; // Prop pour déclencher l'ajout
}

// Calculer la distance estimée du nid basée sur la durée
function calculateNestDistance(duration?: number): number {
  if (!duration || duration <= 0) {
    return 2; // Distance max par défaut: 2km
  }
  
  // 100m par minute = 100m / 60s = 1.67m par seconde
  const distanceInMeters = Math.round((duration / 60) * 100);
  const maxDistance = 3000; // 3km max
  const finalDistance = Math.min(distanceInMeters, maxDistance);
  
  // Convertir en kilomètres
  return finalDistance / 1000;
}

export default function HornetReturnZoneInfoPopup({ 
  show, 
  onHide, 
  hornet, 
  clickPosition,
  onAddAtLocation 
}: HornetReturnZoneInfoPopupProps) {
  const { canAddHornet, canAddApiary } = useUserPermissions();
  const auth = useAuth();

  if (!hornet) {
    return null;
  }

  const calculatedDistance = calculateNestDistance(hornet.duration);
  const isBasedOnDuration = Boolean(hornet.duration && hornet.duration > 0);

  // Utiliser la position cliquée si disponible, sinon la position du frelon
  const displayPosition = clickPosition || { lat: hornet.latitude, lng: hornet.longitude };
  const isClickedPosition = Boolean(clickPosition);

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Zone de retour du frelon</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <div className="row">
          <div className="col-md-6">
            <h6>Informations du frelon</h6>
            <ListGroup variant="flush">
              <ListGroup.Item className="d-flex justify-content-between">
                <span>Position du frelon:</span>
                <span>{hornet.latitude.toFixed(6)}, {hornet.longitude.toFixed(6)}</span>
              </ListGroup.Item>
              
              {isClickedPosition && (
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>Position cliquée:</span>
                  <span>
                    {displayPosition.lat.toFixed(6)}, {displayPosition.lng.toFixed(6)}
                    <Badge bg="primary" className="ms-2">📍</Badge>
                  </span>
                </ListGroup.Item>
              )}
              
              <ListGroup.Item className="d-flex justify-content-between">
                <span>Direction:</span>
                <span>{hornet.direction}°</span>
              </ListGroup.Item>
              
              {hornet.duration && (
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>Durée mesurée:</span>
                  <span>{hornet.duration}s</span>
                </ListGroup.Item>
              )}
              
              {hornet.mark_color_1 && (
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>Couleur 1:</span>
                  <Badge bg="secondary">{getColorLabel(hornet.mark_color_1)}</Badge>
                </ListGroup.Item>
              )}
              
              {hornet.mark_color_2 && (
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>Couleur 2:</span>
                  <Badge bg="secondary">{getColorLabel(hornet.mark_color_2)}</Badge>
                </ListGroup.Item>
              )}
              
              {hornet.created_at && (
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>Date:</span>
                  <span>{new Date(hornet.created_at).toLocaleDateString('fr-FR')}</span>
                </ListGroup.Item>
              )}
            </ListGroup>
          </div>
          
          <div className="col-md-6">
            <h6>Zone de retour estimée</h6>
            <ListGroup variant="flush">
              <ListGroup.Item className="d-flex justify-content-between">
                <span>Distance estimée:</span>
                <span>{calculatedDistance.toFixed(1)} km</span>
              </ListGroup.Item>
              
              <ListGroup.Item className="d-flex justify-content-between">
                <span>Précision:</span>
                <Badge bg={isBasedOnDuration ? "success" : "warning"}>
                  {isBasedOnDuration ? "Basée sur la durée" : "Estimation par défaut"}
                </Badge>
              </ListGroup.Item>
              
              <ListGroup.Item className="d-flex justify-content-between">
                <span>Angle de vol:</span>
                <span>5°</span>
              </ListGroup.Item>
            </ListGroup>
            
            {!isBasedOnDuration && (
              <div className="mt-3">
                <small className="text-muted">
                  ⚠️ Cette zone est une estimation par défaut (2km max). 
                  Pour une zone plus précise, ajoutez la durée de vol mesurée.
                </small>
              </div>
            )}
          </div>
        </div>
        
        {auth.isAuthenticated && (canAddHornet || canAddApiary) && onAddAtLocation && (
          <div className="mt-3 pt-3 border-top">
            <p className="text-muted mb-2">
              <strong>Ajouter un élément à cette position:</strong>
            </p>
            <div className="d-flex flex-column gap-2">
              <div className="small text-muted">
                📍 Coordonnées: {displayPosition.lat.toFixed(6)}, {displayPosition.lng.toFixed(6)}
                {isClickedPosition && <Badge bg="primary" className="ms-2">Position cliquée</Badge>}
              </div>
              <Button
                variant="primary"
                onClick={() => onAddAtLocation(displayPosition.lat, displayPosition.lng)}
              >
                📍 Ajouter à cette position
              </Button>
            </div>
          </div>
        )}
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Fermer
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
