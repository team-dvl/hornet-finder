import { useState, useEffect } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { useAuth } from 'react-oidc-context';
import { useAppDispatch, useAppSelector, fetchHornets } from './store/store';
import { useUserPermissions } from './hooks/useUserPermissions';
import { Hornet } from './store/slices/hornetsSlice';
import HornetReturnZone from './HornetReturnZone';
import MapControls from './MapControls';
import HornetInfoPopup from './HornetInfoPopup';
import AddHornetPopup from './AddHornetPopup';
import 'bootstrap/dist/css/bootstrap.min.css';
import "leaflet/dist/leaflet.css";
import "leaflet/dist/leaflet.js";

// Composant pour gérer les clics sur la carte
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      // Vérifier si le clic provient d'un élément avec une classe leaflet-interactive
      // Ces éléments incluent les polygones, marqueurs, etc.
      const target = e.originalEvent?.target as HTMLElement;
      if (target && (
        target.classList.contains('leaflet-interactive') ||
        target.closest('.leaflet-interactive') ||
        target.classList.contains('leaflet-marker-icon') ||
        target.closest('.leaflet-marker-icon') ||
        target.classList.contains('map-control-button') ||
        target.closest('.map-control-button')
      )) {
        // Le clic provient d'un élément interactif, ne pas déclencher l'ajout
        return;
      }
      
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function InteractiveMap() {
  const [coordinates, setCoordinates] = useState<[number, number]>([50.491064, 4.884473]);
  const [selectedHornet, setSelectedHornet] = useState<Hornet | null>(null);
  const [showHornetModal, setShowHornetModal] = useState(false);
  
  // États pour l'ajout de frelon
  const [showAddHornetModal, setShowAddHornetModal] = useState(false);
  const [clickPosition, setClickPosition] = useState<{ lat: number; lng: number } | null>(null);
  
  const auth = useAuth();
  const dispatch = useAppDispatch();
  const { canAddHornet } = useUserPermissions();
  
  // Sélectionner les données depuis le store Redux
  const { hornets, loading, error } = useAppSelector((state) => state.hornets);

  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.access_token) {
      // Utiliser le thunk pour récupérer les données
      dispatch(fetchHornets(auth.user.access_token));
    }
  }, [auth.isAuthenticated, auth.user?.access_token, dispatch]);

  // Gestionnaire de clic sur une zone de frelon
  const handleHornetClick = (hornet: Hornet) => {
    setSelectedHornet(hornet);
    setShowHornetModal(true);
  };

  const handleCloseModal = () => {
    setShowHornetModal(false);
    setSelectedHornet(null);
  };

  // Gestionnaire de clic sur la carte pour ajouter un frelon
  const handleMapClick = (lat: number, lng: number) => {
    // Seuls les utilisateurs autorisés peuvent ajouter des frelons
    if (canAddHornet()) {
      setClickPosition({ lat, lng });
      setShowAddHornetModal(true);
    }
  };

  const handleCloseAddModal = () => {
    setShowAddHornetModal(false);
    setClickPosition(null);
  };

  const handleAddSuccess = () => {
    // Optionnel : afficher un message de succès ou recharger les données
    console.log('Frelon ajouté avec succès !');
  };

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
            hornet={hornet}
            onClick={handleHornetClick}
          />
        ))}
        <MapClickHandler onMapClick={handleMapClick} />
      </MapContainer>
      
      <HornetInfoPopup
        show={showHornetModal}
        onHide={handleCloseModal}
        hornet={selectedHornet}
      />
      {showAddHornetModal && clickPosition && (
        <AddHornetPopup
          show={showAddHornetModal}
          onHide={handleCloseAddModal}
          latitude={clickPosition.lat}
          longitude={clickPosition.lng}
          onSuccess={handleAddSuccess}
        />
      )}
    </div>
  );
}