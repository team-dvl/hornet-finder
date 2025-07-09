import { useState, useEffect } from "react";
import { Button, Alert, Spinner } from "react-bootstrap";
import { MapContainer, TileLayer, useMap, Polygon } from "react-leaflet";
import { useAuth } from 'react-oidc-context';
import 'bootstrap/dist/css/bootstrap.min.css';
import "leaflet/dist/leaflet.css";
import "leaflet/dist/leaflet.js";

type Hornet = {
  latitude: number;
  longitude: number;
  direction: number;
};

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

export default function InteractiveMap() {
  const [coordinates, setCoordinates] = useState<[number, number]>([50.491064, 4.884473]);
  const [hornets, setHornets] = useState<Hornet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();

  useEffect(() => {
    if (auth.isAuthenticated) {
      setLoading(true);
      setError(null);
      
      fetch("/api/hornets", {
        headers: {
          "Authorization": `Bearer ${auth.user?.access_token}`,
          "Content-Type": "application/json"
        }
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          setHornets(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Erreur chargement frelons :", err);
          setError("Erreur lors du chargement des données");
          setLoading(false);
        });
    }
  }, [auth.isAuthenticated, auth.user?.access_token]);

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
            setError("Impossible d'obtenir votre position");
          }
        );
      } else {
        setError("La géolocalisation n'est pas supportée");
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

  function LoadingIndicator() {
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

  function ErrorAlert() {
    if (!error) return null;
    
    return (
      <Alert 
        variant="danger" 
        className="position-absolute top-0 start-0 m-3"
        style={{ zIndex: 1001, maxWidth: "300px" }}
        dismissible
        onClose={() => setError(null)}
      >
        {error}
      </Alert>
    );
  }

  return (
    <div className="position-relative w-100">
      <MapContainer
        center={coordinates}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: "80vh", width: "100%" }}
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
      <LoadingIndicator />
      <ErrorAlert />
    </div>
  );
}