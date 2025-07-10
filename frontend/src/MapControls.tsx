import { Button, Alert, Spinner } from "react-bootstrap";
import { useMap } from "react-leaflet";
import { useAppDispatch, useAppSelector } from './store/hooks';
import { cycleHornetDisplayMode, selectHornetDisplayMode, HornetDisplayMode, toggleApiaries, selectShowApiaries } from './store/store';

interface MapControlsProps {
  loading: boolean;
  error: string | null;
  onLocationUpdate: (coordinates: [number, number]) => void;
  onErrorUpdate: (error: string | null) => void;
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
      className="position-absolute map-control-button"
      style={{
        top: "10px",
        right: "10px",
        zIndex: 1000,
      }}
    >
      Ma position
    </Button>
  );
}

function LoadingIndicator({ loading }: { loading: boolean }) {
  if (!loading) return null;
  
  return (
    <div className="position-absolute top-50 start-50 translate-middle map-control-button" style={{ zIndex: 1001 }}>
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
      className="position-absolute top-0 start-0 m-3 map-control-button"
      style={{ zIndex: 1001, maxWidth: "300px" }}
      dismissible
      onClose={onClose}
    >
      {error}
    </Alert>
  );
}

function HornetDisplayModeButton() {
  const dispatch = useAppDispatch();
  const displayMode = useAppSelector(selectHornetDisplayMode);

  const handleCycle = () => {
    dispatch(cycleHornetDisplayMode());
  };

  // Configuration des états d'affichage
  const getDisplayConfig = (mode: HornetDisplayMode) => {
    switch (mode) {
      case HornetDisplayMode.FULL:
        return {
          variant: "success" as const,
          icon: "🔺",
          label: "Zones de vol",
          title: "Frelons et zones visibles - Cliquer pour masquer les zones"
        };
      case HornetDisplayMode.HORNETS_ONLY:
        return {
          variant: "warning" as const,
          icon: "🐝",
          label: "Frelons",
          title: "Frelons uniquement - Cliquer pour tout masquer"
        };
      case HornetDisplayMode.HIDDEN:
        return {
          variant: "outline-secondary" as const,
          icon: "👁️",
          label: "Masqué",
          title: "Tout masqué - Cliquer pour tout afficher"
        };
      default:
        return {
          variant: "outline-secondary" as const,
          icon: "❓",
          label: "Inconnu",
          title: "État inconnu"
        };
    }
  };

  const config = getDisplayConfig(displayMode);

  return (
    <Button
      onClick={handleCycle}
      variant={config.variant}
      size="sm"
      className="position-absolute map-control-button"
      style={{
        top: "10px",
        right: "250px", // Positionné à gauche du bouton de ruchers
        zIndex: 1000,
      }}
      title={config.title}
    >
      <span className="me-1">{config.icon}</span>
      {config.label}
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
      className="position-absolute map-control-button"
      style={{
        top: "10px",
        right: "130px", // Positionné entre les cônes et "Ma position"
        zIndex: 1000,
      }}
      title={showApiaries ? "Masquer les ruchers" : "Afficher les ruchers"}
    >
      {showApiaries ? "🐝 Ruchers" : "🐝 Ruchers"}
    </Button>
  );
}

export default function MapControls({ loading, error, onLocationUpdate, onErrorUpdate }: MapControlsProps) {
  return (
    <>
      <LocateButton onLocationUpdate={onLocationUpdate} onErrorUpdate={onErrorUpdate} />
      <HornetDisplayModeButton />
      <ToggleApiariesButton />
      <LoadingIndicator loading={loading} />
      <ErrorAlert error={error} onClose={() => onErrorUpdate(null)} />
    </>
  );
}
