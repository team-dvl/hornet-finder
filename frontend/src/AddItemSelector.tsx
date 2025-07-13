import { Modal, Button, Card, Row, Col } from 'react-bootstrap';
import { useUserPermissions } from './hooks/useUserPermissions';

interface AddItemSelectorProps {
  show: boolean;
  onHide: () => void;
  latitude: number;
  longitude: number;
  onSelectHornet: () => void;
  onSelectApiary: () => void;
  onSelectNest: () => void;
}

export default function AddItemSelector({ 
  show, 
  onHide, 
  latitude, 
  longitude, 
  onSelectHornet, 
  onSelectApiary, 
  onSelectNest 
}: AddItemSelectorProps) {
  const { canAddHornet, canAddApiary, roles } = useUserPermissions();
  
  // Vérifier si l'utilisateur peut ajouter des nids (pour l'instant, tous les utilisateurs authentifiés)
  const canAddNest = roles.length > 0;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="me-2">📍</span>
          Que souhaitez-vous ajouter ici?
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <div className="mb-3">
          <strong>Position sélectionnée :</strong>
          <div className="bg-light p-2 rounded small mt-1">
            <div>Latitude: {latitude.toFixed(6)}</div>
            <div>Longitude: {longitude.toFixed(6)}</div>
          </div>
        </div>

        <Row className="g-3">
          {canAddHornet && (
            <Col md={12}>
              <Card className="h-100 border-2 border-warning">
                <Card.Body className="text-center">
                  <div className="mb-3" style={{ fontSize: '3rem' }}>🐝</div>
                  <Card.Title>Frelon asiatique</Card.Title>
                  <Card.Text className="text-muted">
                    Signaler l'observation d'un frelon asiatique avec sa direction de vol
                  </Card.Text>
                  <Button 
                    variant="warning" 
                    onClick={onSelectHornet}
                    className="w-100"
                  >
                    Ajouter un frelon
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          )}

          {canAddApiary && (
            <Col md={12}>
              <Card className="h-100 border-2 border-success">
                <Card.Body className="text-center">
                  <div className="mb-3" style={{ fontSize: '3rem' }}>🍯</div>
                  <Card.Title>Rucher</Card.Title>
                  <Card.Text className="text-muted">
                    Enregistrer l'emplacement d'un rucher et son niveau d'infestation
                  </Card.Text>
                  <Button 
                    variant="success" 
                    onClick={onSelectApiary}
                    className="w-100"
                  >
                    Ajouter un rucher
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          )}

          {canAddNest && (
            <Col md={12}>
              <Card className="h-100 border-2 border-danger">
                <Card.Body className="text-center">
                  <div className="mb-3" style={{ fontSize: '3rem' }}>🏴</div>
                  <Card.Title>Nid de frelons</Card.Title>
                  <Card.Text className="text-muted">
                    Signaler un nid de frelons asiatiques découvert
                  </Card.Text>
                  <Button 
                    variant="danger" 
                    onClick={onSelectNest}
                    className="w-100"
                  >
                    Signaler un nid
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          )}
        </Row>

        {!canAddHornet && !canAddApiary && !canAddNest && (
          <div className="text-center p-4">
            <div className="text-muted">
              <span style={{ fontSize: '3rem' }}>🔒</span>
              <h5 className="mt-3">Accès restreint</h5>
              <p>Vous devez avoir les permissions appropriées pour ajouter des éléments sur la carte.</p>
            </div>
          </div>
        )}
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Annuler
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
