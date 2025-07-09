import { useState, useEffect } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import { useAuth } from 'react-oidc-context';
import HornetReturnZone from './HornetReturnZone';
import MapControls from './MapControls';
import 'bootstrap/dist/css/bootstrap.min.css';
import "leaflet/dist/leaflet.css";
import "leaflet/dist/leaflet.js";

type Hornet = {
  latitude: number;
  longitude: number;
  direction: number;
};

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

  return (
    <div className="position-relative w-100">
      <MapContainer
        center={coordinates}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: "80vh", width: "100%" }}
      >
        <MapControls 
          loading={loading}
          error={error}
          onLocationUpdate={setCoordinates}
          onErrorUpdate={setError}
        />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hornets.map((hornet, index) => (
          <HornetReturnZone
            key={index}
            latitude={hornet.latitude}
            longitude={hornet.longitude}
            direction={hornet.direction}
          />
        ))}
      </MapContainer>
    </div>
  );
}