import { Polygon } from "react-leaflet";
import { Hornet } from './store/store';

interface HornetReturnZoneProps {
  hornet: Hornet;
  lengthKm?: number;
  angleDeg?: number;
  onClick?: (hornet: Hornet) => void;
}

// Calculer la distance estimée du nid basée sur la durée
function calculateNestDistance(duration?: number): number {
  if (!duration || duration <= 0) {
    return 3; // Distance max par défaut: 3km
  }
  
  // 100m par minute = 100m / 60s = 1.67m par seconde
  const distanceInMeters = Math.round((duration / 60) * 100);
  const maxDistance = 3000; // 3km max
  const finalDistance = Math.min(distanceInMeters, maxDistance);
  
  // Convertir en kilomètres
  return finalDistance / 1000;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

function computeTriangle(
  lat: number,
  lng: number,
  direction: number,
  lengthKm = 3,
  angleDeg = 5
): [number, number][] {
  const R = 6371;
  const dirRad = deg2rad(direction);
  const d = lengthKm / R;
  const lat1 = deg2rad(lat);
  const lng1 = deg2rad(lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(dirRad)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(dirRad) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  const halfAngle = angleDeg / 2;
  const leftDir = deg2rad(direction - halfAngle);
  const rightDir = deg2rad(direction + halfAngle);

  const latLeft = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(leftDir)
  );
  const lngLeft =
    lng1 +
    Math.atan2(
      Math.sin(leftDir) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(latLeft)
    );

  const latRight = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(rightDir)
  );
  const lngRight =
    lng1 +
    Math.atan2(
      Math.sin(rightDir) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(latRight)
    );

  return [
    [lat * 1, lng * 1],
    [latLeft * (180 / Math.PI), lngLeft * (180 / Math.PI)],
    [lat2 * (180 / Math.PI), lng2 * (180 / Math.PI)],
    [latRight * (180 / Math.PI), lngRight * (180 / Math.PI)],
    [lat * 1, lng * 1],
  ];
}

export default function HornetReturnZone({ 
  hornet,
  lengthKm, 
  angleDeg = 5,
  onClick
}: HornetReturnZoneProps) {
  // Calculer la longueur du cône basée sur la durée si elle n'est pas fournie explicitement
  const calculatedLength = lengthKm ?? calculateNestDistance(hornet.duration);
  
  // Déterminer si la longueur est basée sur une durée réelle ou par défaut
  const isBasedOnDuration = Boolean(hornet.duration && hornet.duration > 0);
  
  const trianglePositions = computeTriangle(
    hornet.latitude, 
    hornet.longitude, 
    hornet.direction, 
    calculatedLength, 
    angleDeg
  );

  const handleClick = () => {
    if (onClick) {
      onClick(hornet);
    }
  };

  return (
    <Polygon
      positions={trianglePositions}
      pathOptions={{
        color: isBasedOnDuration ? "red" : "orange",
        fillColor: isBasedOnDuration ? "red" : "orange",
        fillOpacity: isBasedOnDuration ? 0.3 : 0.2,
        weight: isBasedOnDuration ? 3 : 2,
        dashArray: isBasedOnDuration ? undefined : "5, 5", // Ligne pointillée pour les estimations par défaut
      }}
      eventHandlers={{
        click: handleClick,
      }}
    />
  );
}
