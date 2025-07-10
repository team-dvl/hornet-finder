import { useState, useEffect } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { useAuth } from 'react-oidc-context';
import { useAppDispatch, useAppSelector, fetchHornets, fetchHornetsPublic, fetchApiaries, fetchMyApiaries, selectShowApiaries, selectShowHornets, selectShowReturnZones, fetchNests, selectShowNests } from './store/store';
import { useUserPermissions } from './hooks/useUserPermissions';
import { Hornet } from './store/slices/hornetsSlice';
import { Apiary } from './store/slices/apiariesSlice';
import { Nest } from './store/slices/nestsSlice';
import HornetReturnZone from './HornetReturnZone';
import ApiaryMarker from './ApiaryMarker';
import NestMarker from './NestMarker';
import MapControls from './MapControls';
import HornetInfoPopup from './HornetInfoPopup';
import ApiaryInfoPopup from './ApiaryInfoPopup';
import NestInfoPopup from './NestInfoPopup';
import AddItemSelector from './AddItemSelector';
import AddHornetPopup from './AddHornetPopup';
import AddApiaryPopup from './AddApiaryPopup';
import AddNestPopup from './AddNestPopup';
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
  const [selectedApiary, setSelectedApiary] = useState<Apiary | null>(null);
  const [selectedNest, setSelectedNest] = useState<Nest | null>(null);
  const [showHornetModal, setShowHornetModal] = useState(false);
  const [showApiaryModal, setShowApiaryModal] = useState(false);
  const [showNestModal, setShowNestModal] = useState(false);
  
  // États pour la sélection d'éléments à ajouter
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [clickPosition, setClickPosition] = useState<{ lat: number; lng: number } | null>(null);
  
  // États pour l'ajout spécifique de chaque type
  const [showAddHornetModal, setShowAddHornetModal] = useState(false);
  const [showAddApiaryModal, setShowAddApiaryModal] = useState(false);
  const [showAddNestModal, setShowAddNestModal] = useState(false);
  
  const auth = useAuth();
  const dispatch = useAppDispatch();
  const { canAddHornet, canAddApiary, isAdmin } = useUserPermissions();
  
  // Sélectionner les données depuis le store Redux
  const { hornets, loading, error } = useAppSelector((state) => state.hornets);
  const { apiaries } = useAppSelector((state) => state.apiaries);
  const { nests } = useAppSelector((state) => state.nests);
  const showApiaries = useAppSelector(selectShowApiaries);
  const showHornets = useAppSelector(selectShowHornets);
  const showReturnZones = useAppSelector(selectShowReturnZones);
  const showNests = useAppSelector(selectShowNests);

  useEffect(() => {
    // Récupérer les frelons (toujours, même pour les utilisateurs non authentifiés)
    if (auth.isAuthenticated && auth.user?.access_token) {
      // Utilisateur authentifié : récupérer avec le token
      dispatch(fetchHornets(auth.user.access_token));
    } else {
      // Utilisateur non authentifié : récupérer sans token
      dispatch(fetchHornetsPublic());
    }

    // Récupérer les ruchers et nids seulement pour les utilisateurs authentifiés
    if (auth.isAuthenticated && auth.user?.access_token) {
      // Récupérer les nids (disponibles pour tous les utilisateurs authentifiés)
      dispatch(fetchNests(auth.user.access_token));
      
      if (isAdmin) {
        // Les admins peuvent voir tous les ruchers
        dispatch(fetchApiaries(auth.user.access_token));
      } else if (canAddApiary) {
        // Les apiculteurs peuvent voir leurs propres ruchers
        dispatch(fetchMyApiaries(auth.user.access_token));
      }
    }
  }, [auth.isAuthenticated, auth.user?.access_token, dispatch, isAdmin, canAddApiary]);

  // Gestionnaire de clic sur une zone de frelon
  const handleHornetClick = (hornet: Hornet) => {
    setSelectedHornet(hornet);
    setShowHornetModal(true);
  };

  // Gestionnaire de clic sur un rucher
  const handleApiaryClick = (apiary: Apiary) => {
    setSelectedApiary(apiary);
    setShowApiaryModal(true);
  };

  // Gestionnaire de clic sur un nid
  const handleNestClick = (nest: Nest) => {
    setSelectedNest(nest);
    setShowNestModal(true);
  };

  const handleCloseModal = () => {
    setShowHornetModal(false);
    setSelectedHornet(null);
  };

  const handleCloseApiaryModal = () => {
    setShowApiaryModal(false);
    setSelectedApiary(null);
  };

  const handleCloseNestModal = () => {
    setShowNestModal(false);
    setSelectedNest(null);
  };

  // Gestionnaire de clic sur la carte pour afficher le sélecteur d'éléments
  const handleMapClick = (lat: number, lng: number) => {
    // Vérifier si l'utilisateur peut ajouter quelque chose (y compris les nids pour les utilisateurs authentifiés)
    const canAddNest = auth.isAuthenticated; // Tous les utilisateurs authentifiés peuvent ajouter des nids
    const canAddSomething = canAddHornet || canAddApiary || canAddNest;
    
    if (canAddSomething) {
      setClickPosition({ lat, lng });
      setShowItemSelector(true);
    }
  };

  // Gestionnaires pour la fermeture des modales
  const handleCloseItemSelector = () => {
    setShowItemSelector(false);
    setClickPosition(null);
  };

  const handleCloseAddModals = () => {
    setShowAddHornetModal(false);
    setShowAddApiaryModal(false);
    setShowAddNestModal(false);
    setClickPosition(null);
  };

  // Gestionnaires de sélection d'éléments
  const handleSelectHornet = () => {
    setShowItemSelector(false);
    setShowAddHornetModal(true);
  };

  const handleSelectApiary = () => {
    setShowItemSelector(false);
    setShowAddApiaryModal(true);
  };

  const handleSelectNest = () => {
    setShowItemSelector(false);
    setShowAddNestModal(true);
  };

  const handleAddSuccess = () => {
    // Optionnel : afficher un message de succès ou recharger les données
    console.log('Élément ajouté avec succès !');
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
          showApiariesButton={auth.isAuthenticated && (isAdmin || canAddApiary)}
          showNestsButton={auth.isAuthenticated} // Tous les utilisateurs authentifiés peuvent voir les nids
        />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {showHornets && hornets.map((hornet, index) => (
          <HornetReturnZone
            key={hornet.id || index}
            hornet={hornet}
            onClick={handleHornetClick}
            showReturnZone={showReturnZones}
          />
        ))}
        {showApiaries && auth.isAuthenticated && (isAdmin || canAddApiary) && apiaries.map((apiary, index) => (
          <ApiaryMarker
            key={apiary.id || index}
            apiary={apiary}
            onClick={handleApiaryClick}
          />
        ))}
        {showNests && auth.isAuthenticated && nests.map((nest, index) => (
          <NestMarker
            key={nest.id || index}
            nest={nest}
            onClick={handleNestClick}
          />
        ))}
        <MapClickHandler onMapClick={handleMapClick} />
      </MapContainer>
      
      <HornetInfoPopup
        show={showHornetModal}
        onHide={handleCloseModal}
        hornet={selectedHornet}
      />
      
      <ApiaryInfoPopup
        show={showApiaryModal}
        onHide={handleCloseApiaryModal}
        apiary={selectedApiary}
      />
      
      <NestInfoPopup
        show={showNestModal}
        onHide={handleCloseNestModal}
        nest={selectedNest}
      />
      
      {showItemSelector && clickPosition && (
        <AddItemSelector
          show={showItemSelector}
          onHide={handleCloseItemSelector}
          latitude={clickPosition.lat}
          longitude={clickPosition.lng}
          onSelectHornet={handleSelectHornet}
          onSelectApiary={handleSelectApiary}
          onSelectNest={handleSelectNest}
        />
      )}
      
      {showAddHornetModal && clickPosition && (
        <AddHornetPopup
          show={showAddHornetModal}
          onHide={handleCloseAddModals}
          latitude={clickPosition.lat}
          longitude={clickPosition.lng}
          onSuccess={handleAddSuccess}
        />
      )}

      {showAddApiaryModal && clickPosition && (
        <AddApiaryPopup
          show={showAddApiaryModal}
          onHide={handleCloseAddModals}
          latitude={clickPosition.lat}
          longitude={clickPosition.lng}
          onSuccess={handleAddSuccess}
        />
      )}

      {showAddNestModal && clickPosition && (
        <AddNestPopup
          show={showAddNestModal}
          onHide={handleCloseAddModals}
          latitude={clickPosition.lat}
          longitude={clickPosition.lng}
          onSuccess={handleAddSuccess}
        />
      )}
    </div>
  );
}