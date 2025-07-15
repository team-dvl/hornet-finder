import { Button } from "react-bootstrap";
import { useMap } from "react-leaflet";
import * as L from "leaflet";

interface LocateButtonProps {
  onLocationUpdate: (coordinates: [number, number]) => void;
  onErrorUpdate: (error: string | null) => void;
  onLocationMarkerUpdate?: (marker: L.Marker | null) => void;
}

export default function LocateButton({ onLocationUpdate, onErrorUpdate, onLocationMarkerUpdate }: LocateButtonProps) {
  const map = useMap();

  // Créer une icône en forme de croix avec CSS inline robuste
  const createCrossLocationIcon = () => {
    const html = `
      <div style="
        position: relative;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- Cercle d'arrière-plan -->
        <div style="
          position: absolute;
          width: 20px;
          height: 20px;
          background-color: rgba(0, 123, 255, 0.2);
          border: 2px solid #007bff;
          border-radius: 50%;
          top: 2px;
          left: 2px;
        "></div>
        <!-- Croix verticale -->
        <div style="
          position: absolute;
          width: 2px;
          height: 12px;
          background-color: #007bff;
          top: 6px;
          left: 11px;
          z-index: 2;
        "></div>
        <!-- Croix horizontale -->
        <div style="
          position: absolute;
          width: 12px;
          height: 2px;
          background-color: #007bff;
          top: 11px;
          left: 6px;
          z-index: 2;
        "></div>
      </div>
    `;
    
    return new L.DivIcon({
      html: html,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
      className: '' // Pas de classe CSS externe pour éviter les conflits
    });
  };

  // Créer un marqueur avec icône croix personnalisée
  const createLocationMarker = (coordinates: [number, number]) => {
    // Supprimer les anciens marqueurs de position
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer.options.title === 'Ma position') {
        map.removeLayer(layer);
      }
    });
    
    const marker = L.marker(coordinates, {
      icon: createCrossLocationIcon(),
      title: 'Ma position',
      zIndexOffset: 1000
    });
    
    marker.addTo(map);
    
    // Appeler les callbacks
    onLocationUpdate(coordinates);
    if (onLocationMarkerUpdate) {
      onLocationMarkerUpdate(marker);
    }
    
    // Centrer la carte sur la position
    map.setView(coordinates, Math.max(map.getZoom(), 15));
    
    return marker;
  };

  const handleLocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newCoordinates: [number, number] = [latitude, longitude];
          
          createLocationMarker(newCoordinates);
        },
        (error) => {
          let errorMessage = "Impossible d'obtenir votre position";
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Permission de géolocalisation refusée";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Position non disponible";
              break;
            case error.TIMEOUT:
              errorMessage = "Timeout de géolocalisation";
              break;
          }
          
          // En cas d'erreur, ajouter un marqueur au centre de la carte
          const centerCoords = map.getCenter();
          createLocationMarker([centerCoords.lat, centerCoords.lng]);
          
          onErrorUpdate(errorMessage + " (marqueur ajouté au centre)");
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000 // Cache la position pendant 1 minute
        }
      );
    } else {
      // Ajouter un marqueur au centre de la carte
      const centerCoords = map.getCenter();
      createLocationMarker([centerCoords.lat, centerCoords.lng]);
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
