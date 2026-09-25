import { Button, Form, Alert, InputGroup, Spinner } from 'react-bootstrap';
import { useState } from 'react';
import { createHornet } from '../../store/store';
import { useAppDispatch } from '../../store/hooks';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { ColorSelector } from '../../components/forms';
import CompassCapture from '../map/CompassCapture';
import { HelpTip } from '../common';
import { AppModal } from '../ui';
import { OBJECT_ICONS } from '../../utils/icons';
import { useAuth } from 'react-oidc-context';

/** Usual absence durations, in minutes */
const DURATION_PRESETS = [1, 2, 5, 10, 15, 30];

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

  // Convertir la direction en point cardinal
  const getDirectionLabel = (degrees: number) => {
    if (isNaN(degrees)) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return directions[Math.round(degrees / 45) % 8];
  };

  return (
    <>
      <AppModal
        show={show && !showCompass}
        onHide={handleClose}
        locked
        icon={OBJECT_ICONS.hornet}
        title="Nouveau frelon"
        onSubmit={handleSubmit}
        validated={validated}
        footer={(
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
            Enregistrer
          </Button>
        )}
      >
        {error && <Alert variant="danger">{error}</Alert>}

        <Form.Group className="mb-3" controlId="hornet-direction">
          <Form.Label className="d-flex align-items-center">
            Direction de vol
            <HelpTip id="hornet-direction-help" title="Direction de vol">
              Direction dans laquelle le frelon repart, en degrés : 0° = Nord, 90° = Est, 180° = Sud, 270° = Ouest.
              La boussole la mesure en pointant le téléphone dans cette direction.
            </HelpTip>
          </Form.Label>
          <div className="d-flex gap-2">
            {isCompassSupported() && (
              <Button variant="primary" onClick={handleOpenCompass} disabled={isSubmitting} className="flex-shrink-0">
                <i className="bi bi-compass me-2" aria-hidden="true" />
                Boussole
              </Button>
            )}
            <InputGroup>
              <Form.Control
                type="number"
                inputMode="numeric"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                placeholder="0 à 359"
                min="0"
                max="359"
                required
                disabled={isSubmitting}
              />
              <InputGroup.Text style={{ minWidth: '3.5rem' }} className="justify-content-center">
                {direction ? `° ${getDirectionLabel(parseInt(direction))}` : '°'}
              </InputGroup.Text>
            </InputGroup>
          </div>
          <Form.Control.Feedback type="invalid" className={validated && !direction ? 'd-block' : ''}>
            Indiquez une direction entre 0 et 359°.
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3" controlId="hornet-duration">
          <Form.Label className="d-flex align-items-center">
            Durée d'absence
            <HelpTip id="hornet-duration-help" title="Durée d'absence">
              Temps écoulé entre le départ et le retour du frelon au même endroit. Il sert à estimer la distance du nid.
            </HelpTip>
          </Form.Label>
          <div className="d-flex flex-wrap gap-2 mb-2">
            {DURATION_PRESETS.map((minutes) => (
              <Button
                key={minutes}
                variant={duration === String(minutes * 60) ? 'info' : 'outline-info'}
                className="rounded-pill"
                onClick={() => setDuration(String(minutes * 60))}
                disabled={isSubmitting}
              >
                {minutes} min
              </Button>
            ))}
          </div>
          <InputGroup>
            <Form.Control
              type="number"
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Autre durée"
              min="1"
              disabled={isSubmitting}
            />
            <InputGroup.Text>secondes</InputGroup.Text>
          </InputGroup>
        </Form.Group>

        <Form.Label>Marquage</Form.Label>
        <div className="d-flex flex-column gap-2">
          <ColorSelector value={markColor1} onChange={setMarkColor1} disabled={isSubmitting} />
          <ColorSelector value={markColor2} onChange={setMarkColor2} disabled={isSubmitting} />
        </div>
      </AppModal>

      {/* Dialogue de capture de direction par la boussole, à la place du formulaire */}
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
