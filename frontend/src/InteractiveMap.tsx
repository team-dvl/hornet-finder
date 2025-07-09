import { useState, useEffect } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import { useAuth } from 'react-oidc-context';
import { useAppDispatch, useAppSelector, fetchHornets } from './store/store';
import HornetReturnZone from './HornetReturnZone';
import MapControls from './MapControls';
import 'bootstrap/dist/css/bootstrap.min.css';
import "leaflet/dist/leaflet.css";
import "leaflet/dist/leaflet.js";

export default function InteractiveMap() {
  const [coordinates, setCoordinates] = useState<[number, number]>([50.491064, 4.884473]);
  const auth = useAuth();
  const dispatch = useAppDispatch();
  
  // Sélectionner les données depuis le store Redux
  const { hornets, loading, error } = useAppSelector((state) => state.hornets);

  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.access_token) {
      // Utiliser le thunk pour récupérer les données
      dispatch(fetchHornets(auth.user.access_token));
    }
  }, [auth.isAuthenticated, auth.user?.access_token, dispatch]);

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
          onErrorUpdate={() => {}} // Les erreurs sont maintenant gérées par Redux
        />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hornets.map((hornet, index) => (
          <HornetReturnZone
            key={hornet.id || index}
            latitude={hornet.latitude}
            longitude={hornet.longitude}
            direction={hornet.direction}
          />
        ))}
      </MapContainer>
    </div>
  );
}