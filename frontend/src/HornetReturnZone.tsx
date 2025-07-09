import { Polygon } from "react-leaflet";

interface HornetReturnZoneProps {
  latitude: number;
  longitude: number;
  direction: number;
  lengthKm?: number;
  angleDeg?: number;
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
  latitude, 
  longitude, 
  direction, 
  lengthKm = 3, 
  angleDeg = 5 
}: HornetReturnZoneProps) {
  const trianglePositions = computeTriangle(latitude, longitude, direction, lengthKm, angleDeg);

  return (
    <Polygon
      positions={trianglePositions}
      pathOptions={{
        color: "red",
        fillColor: "orange",
        fillOpacity: 0.2,
        weight: 2,
      }}
    />
  );
}
