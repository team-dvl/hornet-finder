import { Button } from "react-bootstrap";
import { useMap } from "react-leaflet";

interface LocateButtonProps {
  onLocationUpdate: (coordinates: [number, number]) => void;
  onErrorUpdate: (error: string | null) => void;
}

export default function LocateButton({ onLocationUpdate, onErrorUpdate }: LocateButtonProps) {
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
      style={{ opacity: 0.7, borderRadius: '12px' }}
    >
      <span className="map-control-button-icon">📍</span>
      <span className="map-control-button-text">Ma position</span>
    </Button>
  );
}
