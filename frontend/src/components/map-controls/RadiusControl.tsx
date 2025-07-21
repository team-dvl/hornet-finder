import { useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';

interface RadiusControlProps {
  currentRadius: number;
  onRadiusChange: (radius: number) => void;
  maxRadius?: number;
}

export default function RadiusControl({ 
  currentRadius, 
  onRadiusChange, 
  maxRadius = 5 
}: RadiusControlProps) {
  const [showModal, setShowModal] = useState(false);
  const [tempRadius, setTempRadius] = useState(currentRadius);

  const handleShow = () => {
    setTempRadius(currentRadius);
    setShowModal(true);
  };

  const handleClose = () => setShowModal(false);

  const handleApply = () => {
    onRadiusChange(tempRadius);
    setShowModal(false);
  };

  return (
    <>
      <Button
        onClick={handleShow}
        variant="primary"
        size="sm"
        className="map-control-button"
        title={`Rayon actuel: ${currentRadius}km`}
        style={{ opacity: 0.7, borderRadius: '12px' }}
      >
        <span className="map-control-button-icon">📏</span>
        <span className="map-control-button-text">{currentRadius}km</span>
      </Button>

      <Modal show={showModal} onHide={handleClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>Rayon de recherche</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>
                Rayon de recherche: {tempRadius}km
              </Form.Label>
              <Form.Range
                min={0.5}
                max={maxRadius}
                step={0.5}
                value={tempRadius}
                onChange={(e) => setTempRadius(Number(e.target.value))}
              />
              <div className="d-flex justify-content-between text-muted small">
                <span>0.5km</span>
                <span>{maxRadius}km</span>
              </div>
            </Form.Group>
            <div className="alert alert-info">
              <small>
                <strong>Note:</strong> Un rayon plus large peut afficher plus d'éléments 
                mais les temps de chargement peuvent être plus longs.
                {maxRadius < 10 && (
                  <><br />Les utilisateurs non-admins sont limités à {maxRadius}km maximum.</>
                )}
              </small>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleApply}>
            Appliquer
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
