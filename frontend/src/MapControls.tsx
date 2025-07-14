import { Button, Alert, Spinner } from "react-bootstrap";
import { useMap } from "react-leaflet";
import { useAppDispatch, useAppSelector } from './store/hooks';
import { cycleDisplayMode, selectDisplayMode, toggleApiaries, selectShowApiaries, toggleNests, selectShowNests } from './store/store';

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

function HornetDisplayModeButton() {
  const dispatch = useAppDispatch();
  const displayMode = useAppSelector(selectDisplayMode);

  const handleCycle = () => {
    dispatch(cycleDisplayMode());
  };

  // Configuration des états du bouton
  const getModeConfig = () => {
    switch (displayMode) {
      case 'full':
        return {
          variant: 'success' as const,
          icon: '🔴',
          text: 'Frelons et zônes',
          title: 'Frelons et zônes de retour visibles - Cliquer pour masquer les zônes de retour'
        };
      case 'hornets-only':
        return {
          variant: 'warning' as const,
          icon: '🐝',
          text: 'Frelons',
          title: 'Seuls les frelons sont visibles - Cliquer pour tout masquer'
        };
      case 'hidden':
        return {
          variant: 'outline-secondary' as const,
          icon: '👁️',
          text: 'Masqué',
          title: 'Frelons et zônes de retour masqués - Cliquer pour tout afficher'
        };
      default:
        return {
          variant: 'success' as const,
          icon: '🔴',
          text: 'Tout',
          title: 'Mode par défaut'
        };
    }
  };

  const config = getModeConfig();

  return (
    <Button
      onClick={handleCycle}
      variant={config.variant}
      size="sm"
      className="map-control-button"
      title={config.title}
    >
      <span className="map-control-button-icon me-1">{config.icon}</span>
      <span className="map-control-button-text">{config.text}</span>
    </Button>
  );
}

function ToggleApiariesButton() {
  const dispatch = useAppDispatch();
  const showApiaries = useAppSelector(selectShowApiaries);

  const handleToggle = () => {
    dispatch(toggleApiaries());
  };

  return (
    <Button
      onClick={handleToggle}
      variant={showApiaries ? "warning" : "outline-secondary"}
      size="sm"
      className="map-control-button"
      title={showApiaries ? "Masquer les ruchers" : "Afficher les ruchers"}
    >
      <span className="map-control-button-icon">🍯</span>
      <span className="map-control-button-text">Ruchers</span>
    </Button>
  );
}

function ToggleNestsButton() {
  const dispatch = useAppDispatch();
  const showNests = useAppSelector(selectShowNests);

  const handleToggle = () => {
    dispatch(toggleNests());
  };

  return (
    <Button
      onClick={handleToggle}
      variant={showNests ? "danger" : "outline-secondary"}
      size="sm"
      className="map-control-button"
      title={showNests ? "Masquer les nids" : "Afficher les nids"}
    >
      <span className="map-control-button-icon">🏴</span>
      <span className="map-control-button-text">Nids</span>
    </Button>
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
        <HornetDisplayModeButton />
        {onQuickHornetCapture && (
          <QuickHornetCaptureButton onQuickCapture={onQuickHornetCapture} canAddHornet={canAddHornet} />
        )}
        {showApiariesButton && <ToggleApiariesButton />}
        {showNestsButton && <ToggleNestsButton />}
      </div>
      <LoadingIndicator loading={loading} />
      <ErrorAlert error={error} onClose={() => onErrorUpdate(null)} />
    </>
  );
}
