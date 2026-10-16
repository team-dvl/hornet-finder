import { useState } from "react";
import { useMap } from "react-leaflet";
import { ListGroup } from "react-bootstrap";
import * as L from "leaflet";
import { BottomSheet } from "../ui";
import { AddressSearch } from "../traps";
import type { AddressSuggestion } from "../../utils/geocoding";

/** Where the crosshair was placed from */
export type CrosshairSource = 'gps' | 'address' | 'center';

/** Title of the crosshair marker, also used to find the previous one */
const CROSSHAIR_TITLE = 'Viseur';
/** Closest zoom when fitting the extent of an address */
const ADDRESS_MAX_ZOOM = 17;

interface LocateButtonProps {
  /** The crosshair was placed: at the device's position, at an address, or at the map centre when the position failed */
  onLocationUpdate: (coordinates: [number, number], source: CrosshairSource) => void;
  onErrorUpdate: (error: string | null) => void;
  onLocationMarkerUpdate?: (marker: L.Marker | null) => void;
}

/**
 * The position map button: places the crosshair (the default position of the
 * additions) at the user's position or at an address, and centres the map.
 */
export default function LocateButton({ onLocationUpdate, onErrorUpdate, onLocationMarkerUpdate }: LocateButtonProps) {
  const map = useMap();
  const [open, setOpen] = useState(false);
  // The address field makes the sheet tall, so the keyboard leaves the suggestions visible
  const [searching, setSearching] = useState(false);

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
  const createLocationMarker = (coordinates: [number, number], source: CrosshairSource, bounds?: L.LatLngBoundsExpression) => {
    // Supprimer les anciens marqueurs de position
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer.options.title === CROSSHAIR_TITLE) {
        map.removeLayer(layer);
      }
    });
    
    const marker = L.marker(coordinates, {
      icon: createCrossLocationIcon(),
      title: CROSSHAIR_TITLE,
      zIndexOffset: 1000
    });
    
    marker.addTo(map);
    
    // Appeler les callbacks
    onLocationUpdate(coordinates, source);
    if (onLocationMarkerUpdate) {
      onLocationMarkerUpdate(marker);
    }
    
    // Centrer la carte sur la position, ou sur l'étendue du lieu (rue, commune)
    if (bounds) {
      map.fitBounds(bounds, { maxZoom: ADDRESS_MAX_ZOOM });
    } else {
      map.setView(coordinates, Math.max(map.getZoom(), 15));
    }
    
    return marker;
  };

  const handleLocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newCoordinates: [number, number] = [latitude, longitude];
          
          createLocationMarker(newCoordinates, 'gps');
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
          createLocationMarker([centerCoords.lat, centerCoords.lng], 'center');
          
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
      createLocationMarker([centerCoords.lat, centerCoords.lng], 'center');
      onErrorUpdate("La géolocalisation n'est pas supportée");
    }
  };

  const close = () => {
    setOpen(false);
    setSearching(false);
  };

  const handleMyPosition = () => {
    close();
    handleLocate();
  };

  const handleAddress = (suggestion: AddressSuggestion) => {
    close();
    onErrorUpdate(null);
    createLocationMarker([suggestion.latitude, suggestion.longitude], 'address', suggestion.bounds);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="map-fab"
        aria-label="Position"
        title="Placer le viseur : ma position ou une adresse"
      >
        <i className="bi bi-crosshair" aria-hidden="true" />
      </button>

      <BottomSheet show={open} onHide={close} title="Placer le viseur">
        <div className={searching ? 'locate-sheet-searching' : undefined}>
          {/* The field comes first: its suggestions then open high on the screen */}
          <div onFocus={() => setSearching(true)}>
            <AddressSearch label="Adresse" onSelect={handleAddress} />
          </div>
          <ListGroup variant="flush">
            <ListGroup.Item action onClick={handleMyPosition} className="d-flex align-items-center gap-3 px-1 py-2">
              <span className="fs-4 text-center flex-shrink-0" style={{ width: '2rem' }}>
                <i className="bi bi-geo-alt-fill" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="d-block fw-semibold">Ma position</span>
                <span className="d-block small text-muted">Géolocalisation de l'appareil</span>
              </span>
            </ListGroup.Item>
          </ListGroup>
        </div>
      </BottomSheet>
    </>
  );
}
