import { Button, Alert, Spinner } from "react-bootstrap";
import { useMap } from "react-leaflet";
import { useAppDispatch, useAppSelector } from './store/hooks';
import { toggleReturnZones, selectShowReturnZones } from './store/store';

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
      className="position-absolute"
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
      className="position-absolute top-0 start-0 m-3"
      style={{ zIndex: 1001, maxWidth: "300px" }}
      dismissible
      onClose={onClose}
    >
      {error}
    </Alert>
  );
}

function ToggleReturnZonesButton() {
  const dispatch = useAppDispatch();
  const showReturnZones = useAppSelector(selectShowReturnZones);

  const handleToggle = () => {
    dispatch(toggleReturnZones());
  };

  return (
    <Button
      onClick={handleToggle}
      variant={showReturnZones ? "success" : "outline-secondary"}
      size="sm"
      className="position-absolute"
      style={{
        top: "10px",
        right: "130px", // Positionné à gauche du bouton "Ma position"
        zIndex: 1000,
      }}
      title={showReturnZones ? "Masquer les cônes de retour" : "Afficher les cônes de retour"}
    >
      {showReturnZones ? "🔺 Cônes" : "🔻 Cônes"}
    </Button>
  );
}

export default function MapControls({ loading, error, onLocationUpdate, onErrorUpdate }: MapControlsProps) {
  return (
    <>
      <LocateButton onLocationUpdate={onLocationUpdate} onErrorUpdate={onErrorUpdate} />
      <ToggleReturnZonesButton />
      <LoadingIndicator loading={loading} />
      <ErrorAlert error={error} onClose={() => onErrorUpdate(null)} />
    </>
  );
}
