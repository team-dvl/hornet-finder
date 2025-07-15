import { useState } from "react";
import { Button } from "react-bootstrap";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, useMapEvents } from "react-leaflet";
import 'bootstrap/dist/css/bootstrap.min.css';
import "leaflet/dist/leaflet.css";
import "leaflet/dist/leaflet.js";

const range = 3000; // Distance in meters

export default function CompassMap() {
  const [coordinates, setCoordinates] = useState<[number, number]>([50.491064, 4.884473]);
  const [direction, setDirection] = useState<number | null>(null);
  const [choosingDirection, setChoosingDirection] = useState<boolean>(false);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(null);
  const [circlePosition, setCirclePosition] = useState<{ x: number; y: number } | null>(null);
  const [circlePagePosition, setCirclePagePosition] = useState<{ x: number; y: number } | null>(null);
  const [recentlyFinishedDirection, setRecentlyFinishedDirection] = useState(false);


  function LocateButton() {
    const map = useMap();

    const handleLocate = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setCoordinates([latitude, longitude]);
            map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
          },
          (error) => {
            console.error("Error fetching location:", error);
          }
        );
      } else {
        console.error("Geolocation is not supported by this browser.");
      }
    };

    return (
      <Button
        onClick={handleLocate}
        variant="primary"
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 1000,
        }}
      >
        Ma position
      </Button>
    );
  }

  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const destination = (coord: [number, number], angle: number, distance: number): [number, number] => {
    const R = 6371e3;
    const δ = distance / R;
    const θ = toRadians(angle);

    const φ1 = toRadians(coord[0]);
    const λ1 = toRadians(coord[1]);

    const φ2 = Math.asin(
      Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
    );
    const λ2 = λ1 + Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

    return [φ2 * 180 / Math.PI, λ2 * 180 / Math.PI];
  };

  const lineEnd = direction !== null && markerPosition ? destination(markerPosition, direction, range) : null;

  const generateCone = (
    origin: [number, number],
    direction: number,
    spreadAngle: number,
    distance: number
  ): [number, number][] => {
    const steps = 10;
    const halfAngle = spreadAngle / 2;
    const points: [number, number][] = [];
  
    // Compute edge points from left to right
    for (let i = 0; i <= steps; i++) {
      const angle = direction - halfAngle + (i * spreadAngle) / steps;
      points.push(destination(origin, angle, distance));
    }
  
    // Start and end with origin to form a closed polygon
    return [origin, ...points, origin];
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!choosingDirection || direction === null || !markerPosition || !circlePagePosition) return;
  
    const dx = e.clientX - circlePagePosition.x;
    const dy = circlePagePosition.y - e.clientY; // Invert Y for angle
  
    let angle = Math.atan2(dx, dy) * (180 / Math.PI);
    angle = (angle + 360) % 360;
    setDirection(angle);
  };

  const handleMouseUp = () => {
    if (choosingDirection) {
      setChoosingDirection(false); // Confirme la direction en relâchant la souris
      setRecentlyFinishedDirection(true); // blocage le choix de la direction pendant un petit temps
      setTimeout(() => setRecentlyFinishedDirection(false), 250); // 250ms de délai
    }
  };

  function MapClickHandler() {
    const map = useMapEvents({
      click(e) {
        if (choosingDirection || recentlyFinishedDirection) return; // ← IGNORE si on choisit déjà une direction
  
        const { lat, lng } = e.latlng;
        setMarkerPosition([lat, lng]);
        setChoosingDirection(true);
        setDirection(0); // direction initiale par défaut
  
        const containerPoint = map.latLngToContainerPoint(e.latlng);
        setCirclePosition({ x: containerPoint.x, y: containerPoint.y });
  
        const mapContainer = map.getContainer();
        const rect = mapContainer.getBoundingClientRect();
        setCirclePagePosition({
          x: rect.left + containerPoint.x,
          y: rect.top + containerPoint.y,
        });
      },
    });
    return null;
  }
  

  return (
    <div 
      style={{ width: "100%", position: "relative" }}
      onMouseMove={choosingDirection ? handleMouseMove : undefined}
      onMouseUp={choosingDirection ? handleMouseUp : undefined}
      onTouchEnd={choosingDirection ? handleMouseUp : undefined}
    >
      <MapContainer
        center={coordinates}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: "80vh" }}
      >
        <LocateButton />
        <MapClickHandler />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markerPosition && (
          <Marker position={markerPosition}>
            <Popup>Marqueur ajouté ici.</Popup>
          </Marker>
        )}
        {lineEnd && !choosingDirection && (
        <Polygon
            positions={generateCone(markerPosition!, direction!, 10, range)}
            pathOptions={{
              color: "red",           // Border color
              weight: 2,              // Border thickness
              fillColor: "rgba(255,0,0,0.3)", // Semi-transparent fill
              fillOpacity: 0.3,
            }}
          />
        )}
      </MapContainer>
      {choosingDirection && direction !== null && circlePosition && (
        <div
          style={{
            position: "absolute",
            top: `${circlePosition.y - 150}px`, // Centrer le cercle
            left: `${circlePosition.x - 150}px`, // Centrer le cercle
            width: "300px", // Cercle plus grand
            height: "300px", // Cercle plus grand
            borderRadius: "50%",
            border: "2px solid red",
            zIndex: 1000,
            cursor: "pointer",
            pointerEvents: "none", // Désactiver les événements de la souris
            userSelect: "none", // Désactiver la sélection de texte
          }}
        >
          <div
            style={{
              width: "2px",
              height: "150px",
              backgroundColor: "red",
              position: "absolute",
              top: "0",
              left: "calc(50% - 1px)",
              transform: `rotate(${direction}deg)`,
              transformOrigin: "bottom center",
            }}
          />
          {['N', 'E', 'S', 'O'].map((label, idx) => {
            const angle = idx * 90;
            const rad = toRadians(angle);
            const x = 150 + 140 * Math.sin(rad); // Ajusté pour le cercle plus grand
            const y = 150 - 140 * Math.cos(rad); // Ajusté pour le cercle plus grand
            return (
              <div
                key={label}
                style={{
                  position: "absolute",
                  left: `${x - 6}px`,
                  top: `${y - 6}px`,
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}