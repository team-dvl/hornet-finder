import { Button, Alert, Spinner } from "react-bootstrap";
import { useMap } from "react-leaflet";
import LayerControls from './LayerControls';

interface MapControlsProps {
  loading: boolean;
  error: string | null;
  onLocationUpdate: (coordinates: [number, number]) => void;
  onErrorUpdate: (error: string | null) => void;
  showApiariesButton?: boolean; // Bouton pour contrôler l'affichage des ruchers
  showNestsButton?: boolean; // Bouton pour contrôler l'affichage des nids
  onQuickHornetCapture?: () => void; // Nouvelle prop pour la capture rapide
  canAddHornet?: boolean; // Pour vérifier si l'utilisateur peut ajouter des frelons
}

function LocateButton({ onLocationUpdate, onErrorUpdate }: {
  onLocationUpdate: (coordinates: [number, number]) => void;
  onErrorUpdate: (error: string | null) => void;
}) {
  const map = useMap();

  const handleLocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newCoordinates: [number, number] = [latitude, longitude];
          onLocationUpdate(newCoordinates);
          map.setView(newCoordinates, Math.max(map.getZoom(), 15));
        },
        (error) => {
          console.error("Error fetching location:", error);
          onErrorUpdate("Impossible d'obtenir votre position");
        }
      );
    } else {
      onErrorUpdate("La géolocalisation n'est pas supportée");
    }
  };

  return (
    <Button
      onClick={handleLocate}
      variant="primary"
      size="sm"
      className="map-control-button"
      title="Centrer la carte sur ma position"
    >
      <span className="map-control-button-icon">📍</span>
      <span className="map-control-button-text">Ma position</span>
    </Button>
  );
}

function LoadingIndicator({ loading }: { loading: boolean }) {
  if (!loading) return null;
  
  return (
    <div className="position-absolute top-50 start-50 translate-middle" style={{ zIndex: 1001 }}>
      <div className="d-flex align-items-center bg-white p-3 rounded shadow">
        <Spinner animation="border" size="sm" className="me-2" />
        <span>Chargement des données...</span>
      </div>
    </div>
  );
}

function ErrorAlert({ error, onClose }: { error: string | null; onClose: () => void }) {
  if (!error) return null;
  
  return (
    <Alert 
      variant="danger" 
      className="position-absolute start-0 m-3"
      style={{ 
        zIndex: 1001, 
        maxWidth: "300px",
        top: "60px" // Positionné sous les contrôles
      }}
      dismissible
      onClose={onClose}
    >
      {error}
    </Alert>
  );
}

function QuickHornetCaptureButton({ onQuickCapture, canAddHornet }: { 
  onQuickCapture: () => void; 
  canAddHornet: boolean;
}) {
  // Vérifier si les APIs nécessaires sont supportées
  const isSupported = () => {
    return navigator.geolocation && window.DeviceOrientationEvent;
  };

  // Détecter iOS PWA
  const isIOSPWA = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window.navigator as any).standalone === true;
  };

  const handleClick = () => {
    if (isSupported()) {
      onQuickCapture();
    }
  };

  const supported = isSupported();
  const isPWA = isIOSPWA();

  return (
    <Button
      onClick={handleClick}
      variant="primary"
      size="sm"
      className="map-control-button"
      disabled={!supported}
      style={{ backgroundColor: '#6f42c1', borderColor: '#6f42c1' }}
      title={
        !supported 
          ? "Votre appareil ne supporte pas la capture automatique" 
          : !canAddHornet
          ? "Cliquer pour vous connecter et ajouter un frelon"
          : isPWA
          ? "Capture rapide avec boussole (iOS PWA) - Permissions requises"
          : "Capture rapide avec boussole - Position et direction automatiques"
      }
    >
      <span className="map-control-button-icon">🎯</span>
      <span className="map-control-button-text">Encoder{isPWA ? ' PWA' : ''}</span>
    </Button>
  );
}

export default function MapControls({ 
  loading, 
  error, 
  onLocationUpdate, 
  onErrorUpdate, 
  showApiariesButton = false, 
  showNestsButton = false,
  onQuickHornetCapture,
  canAddHornet = false
}: MapControlsProps) {
  return (
    <>
      <div className="map-controls-container">
        <LocateButton onLocationUpdate={onLocationUpdate} onErrorUpdate={onErrorUpdate} />
        <LayerControls 
          showApiariesButton={showApiariesButton}
          showNestsButton={showNestsButton}
        />
        {onQuickHornetCapture && (
          <QuickHornetCaptureButton onQuickCapture={onQuickHornetCapture} canAddHornet={canAddHornet} />
        )}
      </div>
      <LoadingIndicator loading={loading} />
      <ErrorAlert error={error} onClose={() => onErrorUpdate(null)} />
    </>
  );
}
