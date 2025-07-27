import { Modal, ListGroup, Badge } from 'react-bootstrap';
import { Hornet } from '../../store/slices/hornetsSlice';
import { Apiary } from '../../store/slices/apiariesSlice';
import { Nest } from '../../store/slices/nestsSlice';
import { MapObject, MapObjectType } from './types';
import { ColorSelector } from '../../components/forms';
import CoordinateInput from '../common/CoordinateInput';

interface OverlapDialogProps {
  show: boolean;
  onHide: () => void;
  objects: MapObject[];
  onSelectObject: (object: MapObject) => void;
  position: { lat: number; lng: number };
}

// Fonction pour obtenir le badge du niveau d'infestation
const getInfestationBadge = (level: 1 | 2 | 3) => {
  const badges = {
    1: { bg: 'warning', text: 'Faible' },
    2: { bg: 'warning', text: 'Modérée' },
    3: { bg: 'danger', text: 'Élevée' }
  };
  const badge = badges[level];
  return <Badge bg={badge.bg}>{badge.text}</Badge>;
};

export default function OverlapDialog({ 
  show, 
  onHide, 
  objects, 
  onSelectObject, 
  position 
}: OverlapDialogProps) {
  
  const handleObjectClick = (object: MapObject) => {
    onSelectObject(object);
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          📍 Objets superposés
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <div className="mb-3">
          <div className="d-flex align-items-center gap-3">
            <small className="text-muted">Plusieurs objets se trouvent à cette position :</small>
            <div className="d-flex gap-2">
              <CoordinateInput
                label=""
                value={position.lat}
                onChange={() => {}} // Fonction vide car en mode lecture seule
                readOnly={true}
                precision={6}
              />
              <CoordinateInput
                label=""
                value={position.lng}
                onChange={() => {}} // Fonction vide car en mode lecture seule
                readOnly={true}
                precision={6}
              />
            </div>
          </div>
        </div>
        
        <ListGroup>
          {objects.map((object, index) => (
            <ListGroup.Item
              key={`${object.type}-${object.id}-${index}`}
              action
              onClick={() => handleObjectClick(object)}
              className="d-flex align-items-center justify-content-between p-3"
              style={{ cursor: 'pointer' }}
            >
              <div className="d-flex align-items-center">
                {/* Symbole de l'objet */}
                <div 
                  className="me-3"
                  style={{ 
                    fontSize: '24px',
                    minWidth: '32px',
                    textAlign: 'center'
                  }}
                >
                  {object.symbol}
                </div>
                
                {/* Informations de l'objet */}
                <div>
                  <div className="fw-bold">
                    {object.title}
                  </div>
                  {object.subtitle && (
                    <div className="text-muted small">
                      {object.subtitle}
                    </div>
                  )}
                  
                  {/* Informations spécifiques selon le type */}
                  {object.type === MapObjectType.HORNET && object.data && (
                    <div className="mt-1">
                      <small className="text-muted">
                        {(object.data as Hornet).duration && (
                          <span>Durée: {(object.data as Hornet).duration}s</span>
                        )}
                      </small>
                    </div>
                  )}
                  
                  {object.type === MapObjectType.APIARY && object.data && (
                    <div className="mt-1">
                      {getInfestationBadge((object.data as Apiary).infestation_level)}
                    </div>
                  )}
                  
                  {object.type === MapObjectType.NEST && object.data && (
                    <div className="mt-1">
                      {(object.data as Nest).destroyed ? (
                        <Badge bg="secondary">Détruit</Badge>
                      ) : (
                        <Badge bg="danger">Actif</Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Couleurs pour les frelons */}
              {object.colors && object.colors.length > 0 && (
                <div className="d-flex gap-1">
                  {object.colors.map((color, colorIndex) => (
                    <ColorSelector 
                      key={colorIndex} 
                      value={color} 
                      readOnly 
                      size="sm" 
                    />
                  ))}
                </div>
              )}
              
              {/* ID de l'objet */}
              <div className="text-muted small">
                #{object.id}
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
        
        <div className="mt-3">
          <small className="text-muted">
            💡 Cliquez sur un objet pour l'afficher ou zoomer plus pour les distinguer.
          </small>
        </div>
      </Modal.Body>
    </Modal>
  );
}
