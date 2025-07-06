import { useState, useEffect } from "react";
import { Button } from "react-bootstrap";
import { MapContainer, TileLayer, useMap, Polygon } from "react-leaflet";
import 'bootstrap/dist/css/bootstrap.min.css';
import "leaflet/dist/leaflet.css";
import "leaflet/dist/leaflet.js";

type Hornet = {
  latitude: number;
  longitude: number;
  direction: number; // en degrés
};

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// Calcule les sommets du triangle à partir d'une position, direction, longueur et angle
function computeTriangle(
  lat: number,
  lng: number,
  direction: number,
  lengthKm = 3,
  angleDeg = 5
): [number, number][] {
  // Rayon de la Terre en km
  const R = 6371;
  // Direction en radians
  const dirRad = deg2rad(direction);

  // Calcul du sommet (pointe du triangle)
  const d = lengthKm / R; // distance angulaire
  const lat1 = deg2rad(lat);
  const lng1 = deg2rad(lng);

  // Pointe du triangle
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

  // Les deux bases du triangle (angle à gauche et à droite)
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

  // Retourne les sommets du triangle (base gauche, base droite, pointe, base gauche pour fermer)
  return [
    [lat * 1, lng * 1],
    [latLeft * (180 / Math.PI), lngLeft * (180 / Math.PI)],
    [lat2 * (180 / Math.PI), lng2 * (180 / Math.PI)],
    [latRight * (180 / Math.PI), lngRight * (180 / Math.PI)],
    [lat * 1, lng * 1],
  ];
}

export default function InteractiveMap() {
  const [coordinates, setCoordinates] = useState<[number, number]>([50.491064, 4.884473]);
  const [hornets, setHornets] = useState<Hornet[]>([]);

  useEffect(() => {
    fetch("/api/hornets")
      .then((res) => res.json())
      .then((data) => setHornets(data))
      .catch((err) => console.error("Erreur chargement frelons :", err));
  }, []);

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

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <MapContainer
        center={coordinates}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: "80vh" }}
      >
        <LocateButton />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hornets.map((h, i) => (
          <Polygon
            key={i}
            positions={computeTriangle(h.latitude, h.longitude, h.direction)}
            pathOptions={{
              color: "red",
              fillColor: "orange",
              fillOpacity: 0.2,
              weight: 2,
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}