import { Modal, Button, Alert } from 'react-bootstrap';
import { useState, useEffect, useRef } from 'react';

interface DeviceOrientationEventStatic {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

declare global {
  interface Window {
    DeviceOrientationEvent: DeviceOrientationEventStatic & {
      new (type: string, eventInitDict?: DeviceOrientationEventInit): DeviceOrientationEvent;
      prototype: DeviceOrientationEvent;
    };
  }
}

interface CompassCaptureProps {
  show: boolean;
  onHide: () => void;
  onCapture: (direction: number) => void;
  initialLatitude?: number;
  initialLongitude?: number;
}

export default function CompassCapture({ 
  show, 
  onHide, 
  onCapture, 
  initialLatitude, 
  initialLongitude 
}: CompassCaptureProps) {
  const [latitude, setLatitude] = useState<number | null>(initialLatitude || null);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude || null);
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const orientationPermissionRef = useRef<boolean>(false);

  // Vérifier si les APIs sont supportées
  useEffect(() => {
    if (!navigator.geolocation || !window.DeviceOrientationEvent) {
      setIsSupported(false);
      setError('Votre appareil ne supporte pas la géolocalisation ou l\'orientation.');
      return;
    }
  }, []);

  // Demander les permissions et démarrer le suivi
  useEffect(() => {
    if (!show || !isSupported) return;

    const startTracking = async () => {
      setError(null);

      try {
        // Demander la permission pour l'orientation sur iOS
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const permission = await (DeviceOrientationEvent as any).requestPermission();
          if (permission !== 'granted') {
            setError('Permission d\'orientation refusée. Veuillez l\'activer dans les paramètres.');
            return;
          }
          orientationPermissionRef.current = true;
        }

        // Démarrer la géolocalisation
        if (navigator.geolocation) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
              setLatitude(position.coords.latitude);
              setLongitude(position.coords.longitude);
            },
            (error) => {
              console.error('Erreur de géolocalisation:', error);
              setError('Impossible d\'obtenir la position. Vérifiez les permissions de géolocalisation.');
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 1000
            }
          );
        }

        // Démarrer l'écoute de l'orientation
        const handleOrientation = (event: DeviceOrientationEvent) => {
          if (event.alpha !== null) {
            // alpha donne la direction de la boussole (0-360°)
            // On ajuste pour que 0° soit le nord géographique
            let direction = event.alpha;
            
            // Sur iOS, il faut parfois ajuster l'orientation
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (typeof (event as any).webkitCompassHeading === 'number') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              direction = (event as any).webkitCompassHeading;
            }
            
            setHeading(Math.round(direction));
          }
        };

        window.addEventListener('deviceorientation', handleOrientation);

        // Nettoyer les event listeners lors du démontage
        return () => {
          window.removeEventListener('deviceorientation', handleOrientation);
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
          }
        };
      } catch (err) {
        console.error('Erreur lors du démarrage du suivi:', err);
        setError('Erreur lors de l\'accès aux capteurs de l\'appareil.');
      }
    };

    startTracking();
  }, [show, isSupported]);

  // Nettoyer lors de la fermeture
  const handleClose = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    onHide();
  };

  // Capturer la direction actuelle
  const handleCapture = () => {
    if (heading !== null && latitude !== null && longitude !== null) {
      onCapture(heading);
      handleClose();
    } else {
      setError('Veuillez attendre que la position et la direction soient détectées.');
    }
  };

  // Convertir les degrés en point cardinal pour affichage
  const getDirectionLabel = (degrees: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  };

  if (!isSupported) {
    return (
      <Modal show={show} onHide={handleClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>🧭 Capture de direction</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            Votre appareil ne supporte pas la capture automatique de direction. 
            Veuillez saisir la direction manuellement.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Fermer
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  return (
    <Modal show={show} onHide={handleClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>🧭 Capture de direction</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}
        
        {/* Informations de position et direction */}
        <div className="bg-light p-3 rounded mb-3">
          <div className="row text-center">
            <div className="col-4">
              <strong>Latitude</strong>
              <div className="small">
                {latitude !== null ? latitude.toFixed(6) : '...'}
              </div>
            </div>
            <div className="col-4">
              <strong>Longitude</strong>
              <div className="small">
                {longitude !== null ? longitude.toFixed(6) : '...'}
              </div>
            </div>
            <div className="col-4">
              <strong>Direction</strong>
              <div className="small">
                {heading !== null ? `${heading}° (${getDirectionLabel(heading)})` : '...'}
              </div>
            </div>
          </div>
        </div>

        {/* Flèche de direction au centre */}
        <div className="d-flex justify-content-center align-items-center" style={{ height: '300px', position: 'relative' }}>
          <div className="bg-primary rounded-circle d-flex justify-content-center align-items-center" 
               style={{ width: '200px', height: '200px', position: 'relative' }}>
            
            {/* Marqueurs de direction */}
            <div className="position-absolute" style={{ top: '10px', left: '50%', transform: 'translateX(-50%)', color: 'white', fontWeight: 'bold' }}>
              N
            </div>
            <div className="position-absolute" style={{ right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'white', fontWeight: 'bold' }}>
              E
            </div>
            <div className="position-absolute" style={{ bottom: '10px', left: '50%', transform: 'translateX(-50%)', color: 'white', fontWeight: 'bold' }}>
              S
            </div>
            <div className="position-absolute" style={{ left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'white', fontWeight: 'bold' }}>
              W
            </div>

            {/* Flèche de référence (toujours pointée vers le haut) */}
            <div className="position-absolute d-flex flex-column align-items-center" 
                 style={{ color: 'white' }}>
              <div style={{ 
                width: '0', 
                height: '0', 
                borderLeft: '15px solid transparent',
                borderRight: '15px solid transparent',
                borderBottom: '40px solid white',
                marginBottom: '5px'
              }}></div>
              <div style={{ 
                width: '6px', 
                height: '60px', 
                backgroundColor: 'white' 
              }}></div>
            </div>

            {/* Flèche de direction de l'appareil */}
            {heading !== null && (
              <div 
                className="position-absolute d-flex flex-column align-items-center"
                style={{ 
                  color: '#ffff00',
                  transform: `rotate(${heading}deg)`,
                  transformOrigin: 'center'
                }}
              >
                <div style={{ 
                  width: '0', 
                  height: '0', 
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderBottom: '30px solid #ffff00',
                  marginBottom: '3px'
                }}></div>
                <div style={{ 
                  width: '4px', 
                  height: '40px', 
                  backgroundColor: '#ffff00' 
                }}></div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-3">
          <p className="text-muted small">
            <strong>Flèche blanche :</strong> Référence (Nord)<br/>
            <strong>Flèche jaune :</strong> Direction de votre appareil
          </p>
          <p className="text-muted small">
            Orientez votre appareil dans la direction du vol du frelon, puis capturez.
          </p>
        </div>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Annuler
        </Button>
        <Button 
          variant="primary" 
          onClick={handleCapture}
          disabled={heading === null || latitude === null || longitude === null}
        >
          📍 Capturer la direction
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
