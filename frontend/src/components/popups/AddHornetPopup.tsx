import { Modal, Button, Form, Alert, Row, Col } from 'react-bootstrap';
import { useState, useEffect } from 'react';
import { createHornet } from '../../store/store';
import { useAppDispatch } from '../../store/hooks';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { ColorSelector } from '../../components/forms';
import CompassCapture from '../map/CompassCapture';
import CoordinateInput from '../common/CoordinateInput';
import { useAuth } from 'react-oidc-context';

interface AddHornetPopupProps {
  show: boolean;
  onHide: () => void;
  latitude: number;
  longitude: number;
  onSuccess?: () => void;
  initialDirection?: number | null; // Direction capturée par la boussole
}

export default function AddHornetPopup({ 
  show, 
  onHide, 
  latitude, 
  longitude, 
  onSuccess, 
  initialDirection 
}: AddHornetPopupProps) {
  const dispatch = useAppDispatch();
  const { accessToken } = useUserPermissions();
  const auth = useAuth();
  
  // États du formulaire
  const [direction, setDirection] = useState(initialDirection ? initialDirection.toString() : '');
  const [duration, setDuration] = useState('');
  const [markColor1, setMarkColor1] = useState('');
  const [markColor2, setMarkColor2] = useState('');
  
  // États de contrôle
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);
  const [showCompass, setShowCompass] = useState(false);

  const resetForm = () => {
    setDirection('');
    setDuration('');
    setMarkColor1('');
    setMarkColor2('');
    setError(null);
    setValidated(false);
  };

  // Mettre à jour la direction quand initialDirection change
  useEffect(() => {
    if (initialDirection !== null && initialDirection !== undefined) {
      setDirection(initialDirection.toString());
    }
  }, [initialDirection]);

  const handleClose = () => {
    resetForm();
    onHide();
  };

  // Vérifier si l'appareil supporte la boussole
  const isCompassSupported = () => {
    return typeof DeviceOrientationEvent !== 'undefined' && 
           navigator.geolocation &&
           ('requestPermission' in DeviceOrientationEvent || 'ondeviceorientation' in window);
  };

  // Ouvrir le dialogue de capture de direction
  const handleOpenCompass = () => {
    setShowCompass(true);
  };

  // Callback quand la direction est capturée
  const handleCompassCapture = (capturedDirection: number) => {
    setDirection(capturedDirection.toString());
    setShowCompass(false);
  };

  // Fermer le dialogue de boussole
  const handleCompassClose = () => {
    setShowCompass(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const form = event.currentTarget;
    setValidated(true);

    // Validation des champs obligatoires
    if (!form.checkValidity()) {
      return;
    }

    // Validation des valeurs
    const directionValue = parseInt(direction);
    if (isNaN(directionValue) || directionValue < 0 || directionValue >= 360) {
      setError('La direction doit être un nombre entre 0 et 359 degrés.');
      return;
    }

    const durationValue = duration ? parseInt(duration) : undefined;
    if (duration && (isNaN(durationValue!) || durationValue! <= 0)) {
      setError('La durée doit être un nombre positif en secondes.');
      return;
    }

    if (!accessToken) {
      setError('Vous devez être connecté pour ajouter un frelon.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await dispatch(createHornet({
        latitude,
        longitude,
        direction: directionValue,
        duration: durationValue,
        mark_color_1: markColor1 || undefined,
        mark_color_2: markColor2 || undefined,
        accessToken,
        userGuid: auth.user?.profile?.sub || ''
      })).unwrap();

      // Succès : fermer la popup et réinitialiser le formulaire
      resetForm();
      onHide();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      setError(error as string);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDurationInput = (minutes: number) => {
    return (minutes * 60).toString();
  };

  // Convertir la direction en point cardinal
  const getDirectionLabel = (degrees: number) => {
    if (isNaN(degrees)) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return ` (${directions[index]})`;
  };

  return (
    <>
      <Modal show={show} onHide={handleClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <span className="me-2">🐝</span>
            Ajouter un nouveau frelon
          </Modal.Title>
        </Modal.Header>
      
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          <Row className="mb-3">
            <Col>
              <div className="d-flex flex-column gap-3">
                <CoordinateInput
                  label="Latitude"
                  value={latitude}
                  onChange={() => {}} // Ne sera pas appelé en mode lecture seule
                  readOnly={true}
                  precision={6}
                />
                <CoordinateInput
                  label="Longitude"
                  value={longitude}
                  onChange={() => {}} // Ne sera pas appelé en mode lecture seule
                  readOnly={true}
                  precision={6}
                />
              </div>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col>
              <Form.Group>
                <Form.Label>
                  <strong>Direction de vol *</strong>
                  {direction && getDirectionLabel(parseInt(direction))}
                </Form.Label>
                <div className="d-flex gap-2">
                  <Form.Control
                    type="number"
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    placeholder="Direction en degrés (0-359)"
                    min="0"
                    max="359"
                    required
                    disabled={isSubmitting}
                    style={{ flex: 1 }}
                  />
                  {isCompassSupported() && (
                    <Button
                      variant="outline-primary"
                      onClick={handleOpenCompass}
                      disabled={isSubmitting}
                      title="Capturer la direction avec la boussole"
                    >
                      🎯
                    </Button>
                  )}
                </div>
                <Form.Control.Feedback type="invalid">
                  Veuillez entrer une direction valide entre 0 et 359 degrés.
                </Form.Control.Feedback>
                <Form.Text className="text-muted">
                  0° = Nord, 90° = Est, 180° = Sud, 270° = Ouest
                  {isCompassSupported() && (
                    <><br/>💡 Utilisez le bouton cible pour une capture automatique</>
                  )}
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col>
              <Form.Group>
                <Form.Label><strong>Durée d'absence (facultatif)</strong></Form.Label>
                <Form.Control
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="Durée en secondes"
                  min="1"
                  disabled={isSubmitting}
                />
                <Form.Text className="text-muted">
                  Temps écoulé entre le départ et le retour du frelon (en secondes)
                </Form.Text>
                <div className="d-flex flex-wrap align-items-center gap-1 mt-2">
                  <small className="text-muted me-2">Durées courantes:</small>
                  {[1, 2, 5, 10, 15, 30].map(minutes => (
                    <Button
                      key={minutes}
                      variant="outline-info"
                      size="sm"
                      type="button"
                      onClick={() => setDuration(formatDurationInput(minutes))}
                      disabled={isSubmitting}
                    >
                      {minutes}min
                    </Button>
                  ))}
                </div>
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col md={6}>
              <ColorSelector
                value={markColor1}
                onChange={setMarkColor1}
                disabled={isSubmitting}
                label="Couleur de marquage 1 (facultatif)"
                size="sm"
              />
            </Col>
            <Col md={6}>
              <ColorSelector
                value={markColor2}
                onChange={setMarkColor2}
                disabled={isSubmitting}
                label="Couleur de marquage 2 (facultatif)"
                size="sm"
              />
            </Col>
          </Row>

          <Alert variant="info" className="small">
            <strong>Information :</strong> Cette observation sera enregistrée à votre nom. 
            Les champs marqués d'un astérisque (*) sont obligatoires.
          </Alert>
        </Modal.Body>
        
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button 
            type="submit" 
            variant="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer le frelon'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
    
    {/* Dialogue de capture de direction par la boussole */}
    <CompassCapture 
      show={showCompass} 
      onHide={handleCompassClose} 
      onCapture={handleCompassCapture}
      initialLatitude={latitude}
      initialLongitude={longitude}
    />
    </>
  );
}
