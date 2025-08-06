import { Modal, Button, Alert, Tabs, Tab } from 'react-bootstrap';
import { useState, useEffect, useRef } from 'react';
import CompassPermissionModal from './CompassPermissionModal';

interface DeviceOrientationEventStatic {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

declare global {
  interface Window {
    DeviceOrientationEvent: DeviceOrientationEventStatic & {
      new (type: string, eventInitDict?: DeviceOrientationEventInit): DeviceOrientationEvent;
      prototype: DeviceOrientationEvent;
    };
    AbsoluteOrientationSensor?: {
      new (options?: { frequency?: number }): AbsoluteOrientationSensor;
    };
  }
  interface Navigator {
    standalone?: boolean;
  }
}

interface AbsoluteOrientationSensor extends EventTarget {
  quaternion: number[] | null;
  start(): void;
  stop(): void;
  addEventListener(type: 'reading', listener: () => void): void;
  addEventListener(type: 'error', listener: (event: Event) => void): void;
}

interface CompassCaptureProps {
  show: boolean;
  onHide: () => void;
  onCapture: (direction: number) => void;
  initialLatitude?: number;
  initialLongitude?: number;
  showPermissionModal?: boolean;
  onRequestOrientationPermission?: () => void;
  onCancelPermissionModal?: () => void;
  orientationPermissionGranted?: boolean;
}

export default function CompassCapture({ 
  show, 
  onHide, 
  onCapture, 
  initialLatitude, 
  initialLongitude,
  showPermissionModal = false,
  onRequestOrientationPermission,
  onCancelPermissionModal,
  orientationPermissionGranted = false
}: CompassCaptureProps) {
  const [latitude, setLatitude] = useState<number | null>(initialLatitude || null);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude || null);
  const [heading, setHeading] = useState<number | null>(null);
  // const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [needsOrientationPermission, setNeedsOrientationPermission] = useState(false);
  const [orientationPermissionGrantedLocal, setOrientationPermissionGrantedLocal] = useState(orientationPermissionGranted);
  const [manualHeading, setManualHeading] = useState<number | null>(null);
  const [tabKey, setTabKey] = useState<'compass' | 'manual'>('compass');
  const watchIdRef = useRef<number | null>(null);
  const sensorRef = useRef<AbsoluteOrientationSensor | null>(null);
  const orientationListenerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null);

  // Vérifier si les APIs sont supportées
  useEffect(() => {
    if (!navigator.geolocation || !window.DeviceOrientationEvent) {
      setIsSupported(false);
      // setError('Votre appareil ne supporte pas la géolocalisation ou l\'orientation.');
      return;
    }
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      setNeedsOrientationPermission(true);
    }
  }, []);

  // Demander les permissions et démarrer le suivi
  useEffect(() => {
    if (!show || !isSupported || (needsOrientationPermission && !orientationPermissionGrantedLocal)) return;
    let cleanup: (() => void) | undefined;
    const startTracking = async () => {
      // setError(null);

      // Démarrer la géolocalisation
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            setLatitude(position.coords.latitude);
            setLongitude(position.coords.longitude);
            // Réinitialiser l'erreur si la position est obtenue avec succès
            // setError(null);
          },
          (error) => {
            console.error('Erreur de géolocalisation:', error);
            let errorMessage = 'Impossible d\'obtenir la position. ';
            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage += 'Permission de géolocalisation refusée.';
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage += 'Position non disponible.';
                break;
              case error.TIMEOUT:
                errorMessage += 'Timeout de géolocalisation.';
                break;
              default:
                errorMessage += 'Erreur inconnue.';
                break;
            }
            // setError(errorMessage);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000, // Augmenter le timeout pour iOS PWA
            maximumAge: 5000 // Augmenter l'âge maximum
          }
        );
      }

      // Démarrer l'écoute de l'orientation avec un délai pour iOS PWA
      const startOrientationTracking = () => {
        const isAndroid = /Android/.test(navigator.userAgent);

        // Fonction pour convertir quaternion en heading (yaw)
        const quaternionToHeading = (q: number[]): number => {
          const [x, y, z, w] = q;
          // Calculer le yaw (rotation autour de l'axe Z) depuis le quaternion
          const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
          // Convertir en degrés
          let degrees = (yaw * 180) / Math.PI;
          // Sur Android, inverser l'angle (360 - angle)
          if (isAndroid) {
            degrees = 360 - degrees;
          }
          // Normaliser entre 0-359
          degrees = ((degrees % 360) + 360) % 360;
          return degrees;
        };

        // Essayer d'utiliser AbsoluteOrientationSensor sur Android si disponible
        if (isAndroid && window.AbsoluteOrientationSensor) {
          const checkSensorPermissions = async () => {
            try {
              // Vérifier les permissions pour les capteurs
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const permissionStatus = await (navigator as any).permissions?.query({ name: 'accelerometer' });
              if (permissionStatus?.state === 'granted' || permissionStatus?.state === 'prompt') {
                const sensor = new window.AbsoluteOrientationSensor!({ frequency: 10 });
                sensorRef.current = sensor;
                
                sensor.addEventListener('reading', () => {
                  if (sensor.quaternion) {
                    const heading = quaternionToHeading(sensor.quaternion);
                    setHeading(Math.round(heading));
                  }
                });
                
                sensor.addEventListener('error', (event: Event) => {
                  console.error('AbsoluteOrientationSensor error:', event);
                  // setError('Erreur du capteur AbsoluteOrientationSensor. Votre appareil Android ne supporte pas cette fonctionnalité de manière fiable.');
                });
                
                sensor.start();
                return;
              } else {
                // setError('Permissions des capteurs refusées. L\'application a besoin d\'accéder aux capteurs de mouvement pour fonctionner sur Android.');
              }
            } catch (error) {
              console.log('AbsoluteOrientationSensor non disponible:', error);
              // setError('AbsoluteOrientationSensor non supporté. Votre appareil Android ne supporte pas cette fonctionnalité nécessaire pour la capture de direction.');
            }
          };
          
          checkSensorPermissions();
        } else if (isAndroid) {
          // Android sans AbsoluteOrientationSensor
          // setError('Votre appareil Android ne supporte pas AbsoluteOrientationSensor, nécessaire pour la capture de direction précise.');
        } else {
          // iOS : utiliser DeviceOrientationEvent
          startDeviceOrientationTracking();
        }

        function startDeviceOrientationTracking() {
          // Fonction uniquement pour iOS
          const handleOrientation = (event: DeviceOrientationEvent) => {
            if (event.alpha !== null) {
              let direction = event.alpha;
              
              // Sur iOS, utiliser webkitCompassHeading si disponible
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if (typeof (event as any).webkitCompassHeading === 'number') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                direction = (event as any).webkitCompassHeading;
              }
              
              // Normaliser entre 0-359
              direction = ((direction % 360) + 360) % 360;
              
              setHeading(Math.round(direction));
            }
          };

          // Stocker la référence du listener pour pouvoir le nettoyer
          orientationListenerRef.current = handleOrientation;
          window.addEventListener('deviceorientation', handleOrientation, true);
        }

        // Nettoyer les event listeners lors du démontage
        return () => {
          // Arrêter le sensor si il est actif
          if (sensorRef.current) {
            sensorRef.current.stop();
            sensorRef.current = null;
          }
          
          // Nettoyer le listener DeviceOrientation si il existe
          if (orientationListenerRef.current) {
            window.removeEventListener('deviceorientation', orientationListenerRef.current, true);
            orientationListenerRef.current = null;
          }
          
          // Nettoyer la géolocalisation
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
          }
        };
      };

      // Pour iOS PWA, attendre un peu avant de démarrer l'écoute d'orientation
      const isIOSPWA = window.navigator.standalone === true;
      if (isIOSPWA) {
        setTimeout(() => {
          cleanup = startOrientationTracking();
        }, 500);
      } else {
        cleanup = startOrientationTracking();
      }
    };
    startTracking();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [show, isSupported, needsOrientationPermission, orientationPermissionGrantedLocal]);

  // Nettoyer lors de la fermeture
  const handleClose = () => {
    // Arrêter le sensor si il est actif
    if (sensorRef.current) {
      sensorRef.current.stop();
      sensorRef.current = null;
    }
    
    // Nettoyer le listener DeviceOrientation si il existe
    if (orientationListenerRef.current) {
      window.removeEventListener('deviceorientation', orientationListenerRef.current, true);
      orientationListenerRef.current = null;
    }
    
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    onHide();
  };

  // Capturer la direction actuelle
  const handleCapture = () => {
    if (tabKey === 'manual') {
      if (manualHeading !== null && latitude !== null && longitude !== null) {
        onCapture(manualHeading);
        handleClose();
      } else {
        // setError('Veuillez entrer une direction valide (0-359°) et attendre la position.');
      }
      return;
    }
    if (heading !== null && latitude !== null && longitude !== null) {
      onCapture(heading);
      handleClose();
    } else {
      // setError('Veuillez attendre que la position et la direction soient détectées.');
    }
  };

  // Convertir les degrés en point cardinal pour affichage
  const getDirectionLabel = (degrees: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  };

  useEffect(() => {
    setOrientationPermissionGrantedLocal(orientationPermissionGranted);
  }, [orientationPermissionGranted]);

  if (showPermissionModal && needsOrientationPermission && !orientationPermissionGrantedLocal) {
    return (
      <>
        <CompassPermissionModal
          show={true}
          onRequestPermission={onRequestOrientationPermission || (() => {})}
          onCancel={onCancelPermissionModal || (() => {})}
        />
        <Modal show={show} onHide={handleClose} centered size="lg" backdrop="static" keyboard={false} style={{ opacity: 0.5, pointerEvents: 'none' }}>
          {/* Modal CompassCapture rendu mais désactivé visuellement */}
        </Modal>
      </>
    );
  }

  if (!isSupported) {
    return (
      <Modal show={show} onHide={handleClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>🎯 Capture de direction</Modal.Title>
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
        <Modal.Title>🎯 Capture de direction</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <Tabs
          id="direction-capture-tabs"
          activeKey={tabKey}
          onSelect={k => setTabKey(k as 'compass' | 'manual')}
          className="mb-3 justify-content-center"
        >
          <Tab eventKey="compass" title="Boussole">
            <div style={{ minHeight: 340, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <div className="d-flex justify-content-center align-items-center" style={{ height: '240px', margin: '0', position: 'relative' }}>
                <div className="bg-primary rounded-circle d-flex justify-content-center align-items-center"
                  style={{ width: '200px', height: '200px', position: 'relative' }}>
                  
                  {/* Marqueurs de direction - rosace qui pivote avec le nord */}
                  <div 
                    className="position-absolute"
                    style={{ 
                      width: '100%', 
                      height: '100%',
                      transform: heading !== null ? `rotate(${-heading}deg)` : 'none',
                      transformOrigin: 'center'
                    }}
                  >
                    {/* Points cardinaux principaux */}
                    <div className="position-absolute" style={{ top: '10px', left: '50%', transform: 'translateX(-50%)', color: 'white', fontWeight: 'bold', fontSize: '14px' }}>
                      N
                    </div>
                    <div className="position-absolute" style={{ right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'white', fontWeight: 'bold', fontSize: '14px' }}>
                      E
                    </div>
                    <div className="position-absolute" style={{ bottom: '10px', left: '50%', transform: 'translateX(-50%)', color: 'white', fontWeight: 'bold', fontSize: '14px' }}>
                      S
                    </div>
                    <div className="position-absolute" style={{ left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'white', fontWeight: 'bold', fontSize: '14px' }}>
                      O
                    </div>
                    
                    {/* Points cardinaux intermédiaires */}
                    <div className="position-absolute" style={{ top: '35px', right: '35px', color: 'white', fontWeight: 'bold', fontSize: '12px' }}>
                      NE
                    </div>
                    <div className="position-absolute" style={{ bottom: '35px', right: '35px', color: 'white', fontWeight: 'bold', fontSize: '12px' }}>
                      SE
                    </div>
                    <div className="position-absolute" style={{ bottom: '35px', left: '35px', color: 'white', fontWeight: 'bold', fontSize: '12px' }}>
                      SO
                    </div>
                    <div className="position-absolute" style={{ top: '35px', left: '35px', color: 'white', fontWeight: 'bold', fontSize: '12px' }}>
                      NO
                    </div>
                  </div>

                  {/* Flèche du nord géographique */}
                  {heading !== null && (
                    <div 
                      className="position-absolute d-flex flex-column align-items-center"
                      style={{ 
                        color: '#ffff00',
                        transform: `rotate(${-heading}deg)`,
                        transformOrigin: 'center',
                        zIndex: 1
                      }}
                    >
                      <div style={{ 
                        width: '0', 
                        height: '0', 
                        borderLeft: '15px solid transparent',
                        borderRight: '15px solid transparent',
                        borderBottom: '40px solid #ffff00',
                        marginBottom: '5px',
                        filter: 'drop-shadow(1px 1px 1px black) drop-shadow(-1px -1px 1px black) drop-shadow(1px -1px 1px black) drop-shadow(-1px 1px 1px black)'
                      }}></div>
                      <div style={{ 
                        width: '6px', 
                        height: '60px', 
                        backgroundColor: '#ffff00',
                        filter: 'drop-shadow(1px 1px 1px black) drop-shadow(-1px -1px 1px black) drop-shadow(1px -1px 1px black) drop-shadow(-1px 1px 1px black)'
                      }}></div>
                    </div>
                  )}

                  {/* Flèche de direction de l'appareil (toujours pointée vers le haut) */}
                  <div className="position-absolute d-flex flex-column align-items-center" 
                       style={{ color: 'white', zIndex: 2 }}>
                    <div style={{ 
                      width: '0', 
                      height: '0', 
                      borderLeft: '15px solid transparent',
                      borderRight: '15px solid transparent',
                      borderBottom: '40px solid white',
                      marginBottom: '5px',
                      filter: 'drop-shadow(1px 1px 1px black) drop-shadow(-1px -1px 1px black) drop-shadow(1px -1px 1px black) drop-shadow(-1px 1px 1px black)'
                    }}></div>
                    <div style={{ 
                      width: '6px', 
                      height: '60px', 
                      backgroundColor: 'white',
                      filter: 'drop-shadow(1px 1px 1px black) drop-shadow(-1px -1px 1px black) drop-shadow(1px -1px 1px black) drop-shadow(-1px 1px 1px black)'
                    }}></div>
                  </div>
                </div>
              </div>
              <div className="text-center mt-2">
                <p className="text-muted small mb-1">
                  <strong>Flèche blanche :</strong> Direction de votre appareil<br/>
                  <strong>Flèche jaune :</strong> Nord géographique
                </p>
                <p className="text-muted small mb-0">
                  Orientez votre appareil dans la direction du vol du frelon, puis capturez.
                </p>
              </div>
            </div>
          </Tab>
          <Tab eventKey="manual" title="Saisie manuelle">
            <div style={{ minHeight: 340, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <div className="text-center" style={{ marginTop: 40 }}>
                <div className="mb-3">
                  <label htmlFor="manualHeadingInput" className="form-label">
                    Direction (en degrés)
                  </label>
                </div>
                <div className="mb-3">
                  <input
                    id="manualHeadingInput"
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={0}
                    max={359}
                    className="form-control text-center"
                    style={{ width: '120px', margin: '0 auto' }}
                    value={manualHeading !== null ? manualHeading : ''}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 0 && val <= 359) {
                        setManualHeading(val);
                        // setError(null);
                      } else {
                        setManualHeading(null);
                        // setError('Veuillez entrer une valeur entre 0 et 359.');
                      }
                    }}
                    placeholder="0-359"
                  />
                </div>
                <div className="text-center mt-2">
                  <p className="text-muted small mb-0">
                    Saisissez manuellement la direction du vol du frelon.
                  </p>
                </div>
              </div>
            </div>
          </Tab>
        </Tabs>
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
                {tabKey === 'manual'
                  ? manualHeading !== null
                    ? `${manualHeading}° (${getDirectionLabel(manualHeading)})`
                    : '...'
                  : heading !== null
                    ? `${heading}° (${getDirectionLabel(heading)})`
                    : '...'}
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-3">
          <Button 
            variant="primary" 
            onClick={handleCapture}
            disabled={tabKey === 'manual'
              ? manualHeading === null || latitude === null || longitude === null
              : heading === null || latitude === null || longitude === null}
          >
            📍 Capturer la direction
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
}
