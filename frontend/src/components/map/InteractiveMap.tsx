import { useState, useEffect } from "react";
import { MapContainer, TileLayer, useMapEvents, ZoomControl } from "react-leaflet";
import { Modal, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useAppDispatch, useAppSelector, fetchHornets, fetchHornetsPublic, fetchApiaries, fetchMyApiaries, selectShowApiaries, selectShowHornets, selectShowReturnZones, fetchNests, selectShowNests } from '../../store/store';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useGeolocation } from '../../hooks/useGeolocation';
import { Hornet } from '../../store/slices/hornetsSlice';
import { Apiary } from '../../store/slices/apiariesSlice';
import { Nest } from '../../store/slices/nestsSlice';
import HornetReturnZone from './HornetReturnZone';
import ApiaryMarker from '../markers/ApiaryMarker';
import NestMarker from '../markers/NestMarker';
import MapControlsContainer from '../map-controls';
import HornetInfoPopup from '../popups/HornetInfoPopup';
import HornetReturnZoneInfoPopup from '../popups/HornetReturnZoneInfoPopup';
import ApiaryInfoPopup from '../popups/ApiaryInfoPopup';
import NestInfoPopup from '../popups/NestInfoPopup';
import AddItemSelector from '../forms/AddItemSelector';
import AddHornetPopup from '../popups/AddHornetPopup';
import AddApiaryPopup from '../popups/AddApiaryPopup';
import AddNestPopup from '../popups/AddNestPopup';
import CompassCapture from './CompassCapture';
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

// Fonction utilitaire pour détecter les appareils mobiles
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
};

export default function InteractiveMap() {
  const [coordinates, setCoordinates] = useState<[number, number]>([50.491064, 4.884473]);
  
  // État pour la géolocalisation de l'utilisateur
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState<number>(5);
  
  const [selectedHornet, setSelectedHornet] = useState<Hornet | null>(null);
  const [selectedApiary, setSelectedApiary] = useState<Apiary | null>(null);
  const [selectedNest, setSelectedNest] = useState<Nest | null>(null);
  const [selectedReturnZoneHornet, setSelectedReturnZoneHornet] = useState<Hornet | null>(null);
  const [returnZoneClickPosition, setReturnZoneClickPosition] = useState<{lat: number, lng: number} | null>(null);
  const [showHornetModal, setShowHornetModal] = useState(false);
  const [showApiaryModal, setShowApiaryModal] = useState(false);
  const [showNestModal, setShowNestModal] = useState(false);
  const [showReturnZoneModal, setShowReturnZoneModal] = useState(false);
  
  // États pour la sélection d'éléments à ajouter
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [clickPosition, setClickPosition] = useState<{ lat: number; lng: number } | null>(null);
  
  // États pour l'ajout spécifique de chaque type
  const [showAddHornetModal, setShowAddHornetModal] = useState(false);
  const [showAddApiaryModal, setShowAddApiaryModal] = useState(false);
  const [showAddNestModal, setShowAddNestModal] = useState(false);
  
  // États pour la capture rapide avec boussole
  const [showCompassCapture, setShowCompassCapture] = useState(false);
  const [showGeolocationSpinner, setShowGeolocationSpinner] = useState(false);
  const [compassCapturedDirection, setCompassCapturedDirection] = useState<number | null>(null);
  const [compassCapturedPosition, setCompassCapturedPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingHornetData, setPendingHornetData] = useState<{ lat: number; lng: number; direction: number } | null>(null);
  
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

  // Gérer la géolocalisation de l'utilisateur
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          setGeolocationError(null);
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
          
          setGeolocationError(errorMessage);
          // Position par défaut (centre de la France)
          setUserLocation({ lat: 46.227638, lon: 2.213749 });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    } else {
      setGeolocationError("La géolocalisation n'est pas supportée");
      // Position par défaut (centre de la France)
      setUserLocation({ lat: 46.227638, lon: 2.213749 });
    }
  }, []);

  // Charger les données quand la géolocalisation est disponible
  useEffect(() => {
    if (!userLocation) return; // Attendre que la géolocalisation soit disponible

    const geolocationParams = {
      lat: userLocation.lat,
      lon: userLocation.lon,
      radius: searchRadius,
    };

    // Récupérer les frelons (toujours, même pour les utilisateurs non authentifiés)
    if (auth.isAuthenticated && auth.user?.access_token) {
      // Utilisateur authentifié : récupérer avec le token
      dispatch(fetchHornets({ 
        accessToken: auth.user.access_token, 
        geolocation: geolocationParams 
      }));
    } else {
      // Utilisateur non authentifié : récupérer sans token
      dispatch(fetchHornetsPublic(geolocationParams));
    }

    // Récupérer les ruchers et nids seulement pour les utilisateurs authentifiés
    if (auth.isAuthenticated && auth.user?.access_token) {
      // Récupérer les nids (disponibles pour tous les utilisateurs authentifiés)
      dispatch(fetchNests({ 
        accessToken: auth.user.access_token, 
        geolocation: geolocationParams 
      }));
      
      if (isAdmin) {
        // Les admins peuvent voir tous les ruchers
        dispatch(fetchApiaries({ 
          accessToken: auth.user.access_token, 
          geolocation: geolocationParams 
        }));
      } else if (canAddApiary) {
        // Les apiculteurs peuvent voir leurs propres ruchers (pas de filtrage géographique pour 'my')
        dispatch(fetchMyApiaries(auth.user.access_token));
      }
    }
  }, [userLocation, searchRadius, auth.isAuthenticated, auth.user?.access_token, dispatch, isAdmin, canAddApiary]);

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

  // Gestionnaire de clic sur une zone de retour
  const handleReturnZoneClick = (hornet: Hornet, lat?: number, lng?: number) => {
    setSelectedReturnZoneHornet(hornet);
    if (lat !== undefined && lng !== undefined) {
      setReturnZoneClickPosition({ lat, lng });
    } else {
      setReturnZoneClickPosition(null);
    }
    setShowReturnZoneModal(true);
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

  const handleCloseReturnZoneModal = () => {
    setShowReturnZoneModal(false);
    setSelectedReturnZoneHornet(null);
    setReturnZoneClickPosition(null);
  };

  // Gestionnaire de clic sur la carte pour afficher le sélecteur d'éléments
  const handleMapClick = (lat: number, lng: number) => {
    // Désactiver l'ajout d'objets sur mobile
    if (isMobile()) {
      return;
    }
    
    // Vérifier si l'utilisateur peut ajouter quelque chose (y compris les nids pour les utilisateurs authentifiés)
    const canAddNest = auth.isAuthenticated; // Tous les utilisateurs authentifiés peuvent ajouter des nids
    const canAddSomething = canAddHornet || canAddApiary || canAddNest;
    
    if (canAddSomething) {
      setClickPosition({ lat, lng });
      setShowItemSelector(true);
    }
  };

  // Gestionnaire pour ajouter un élément à la position du frelon
  const handleAddAtLocation = (lat: number, lng: number) => {
    setClickPosition({ lat, lng });
    setShowItemSelector(true);
    setShowHornetModal(false); // Fermer la popup du frelon
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
    // Réinitialiser la direction capturée par la boussole
    setCompassCapturedDirection(null);
    setPendingHornetData(null);
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
  };

  // Gestionnaire pour la capture rapide avec boussole
  const handleQuickHornetCapture = () => {
    // Vérifier d'abord si l'utilisateur est authentifié
    if (!auth.isAuthenticated) {
      // Rediriger vers l'authentification
      auth.signinRedirect();
      return;
    }

    // Obtenir la position actuelle pour la capture
    if (navigator.geolocation) {
      // Afficher le spinner de géolocalisation
      setShowGeolocationSpinner(true);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCompassCapturedPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          
          // Masquer le spinner et afficher la capture de boussole
          setShowGeolocationSpinner(false);
          setShowCompassCapture(true);
        },
        (error) => {
          console.error('Erreur de géolocalisation:', error);
          // En cas d'erreur, utiliser la position actuelle de la carte
          setCompassCapturedPosition({
            lat: coordinates[0],
            lng: coordinates[1]
          });
          
          // Masquer le spinner et afficher la capture de boussole
          setShowGeolocationSpinner(false);
          setShowCompassCapture(true);
        }
      );
    } else {
      // Fallback sur la position actuelle de la carte
      setCompassCapturedPosition({
        lat: coordinates[0],
        lng: coordinates[1]
      });
      setShowCompassCapture(true);
    }
  };

  // Gestionnaire pour la capture de direction
  const handleCompassDirectionCapture = (direction: number) => {
    // Stocker toutes les données nécessaires pour le frelon
    if (compassCapturedPosition) {
      setPendingHornetData({
        lat: compassCapturedPosition.lat,
        lng: compassCapturedPosition.lng,
        direction: direction
      });
      setClickPosition(compassCapturedPosition);
    }
    
    setCompassCapturedDirection(direction);
    setShowCompassCapture(false);
    setShowAddHornetModal(true);
  };

  // Gestionnaire pour fermer la capture de boussole
  const handleCloseCompassCapture = () => {
    setShowCompassCapture(false);
    setCompassCapturedDirection(null);
    setCompassCapturedPosition(null);
  };

  // Gestionnaire pour fermer le spinner de géolocalisation
  const handleCloseGeolocationSpinner = () => {
    setShowGeolocationSpinner(false);
  };

  return (
    <div className="position-relative w-100 h-100">
      <MapContainer
        center={coordinates}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: "100vh", width: "100%" }}
        zoomControl={false} // Désactiver les contrôles par défaut
      >
        <MapControlsContainer 
          loading={loading}
          error={error}
          onLocationUpdate={setCoordinates}
          onErrorUpdate={() => {}} // Les erreurs sont maintenant gérées par Redux
          showApiariesButton={auth.isAuthenticated && (isAdmin || canAddApiary)}
          showNestsButton={auth.isAuthenticated} // Tous les utilisateurs authentifiés peuvent voir les nids
          onQuickHornetCapture={handleQuickHornetCapture}
          canAddHornet={canAddHornet}
          searchRadius={searchRadius}
          onRadiusChange={setSearchRadius}
          isAdmin={isAdmin}
        />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="bottomleft" />
        {showHornets && hornets.map((hornet, index) => (
          <HornetReturnZone
            key={hornet.id || index}
            hornet={hornet}
            onClick={handleHornetClick}
            onShowInfo={handleReturnZoneClick}
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
        onAddAtLocation={handleAddAtLocation}
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
      
      <HornetReturnZoneInfoPopup
        show={showReturnZoneModal}
        onHide={handleCloseReturnZoneModal}
        hornet={selectedReturnZoneHornet}
        clickPosition={returnZoneClickPosition}
        onAddAtLocation={handleAddAtLocation}
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
          initialDirection={pendingHornetData?.direction || compassCapturedDirection} // Utiliser pendingHornetData en priorité
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

      {/* Modal de capture de direction avec boussole */}
      <CompassCapture
        show={showCompassCapture}
        onHide={handleCloseCompassCapture}
        onCapture={handleCompassDirectionCapture}
        initialLatitude={compassCapturedPosition?.lat}
        initialLongitude={compassCapturedPosition?.lng}
      />

      {/* Modal de géolocalisation en cours */}
      <Modal 
        show={showGeolocationSpinner} 
        onHide={handleCloseGeolocationSpinner}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Body className="text-center p-4">
          <Spinner animation="border" role="status" className="me-3">
            <span className="visually-hidden">Chargement...</span>
          </Spinner>
          <div className="mt-3">
            <strong>Géolocalisation en cours...</strong>
            <div className="text-muted mt-1">
              Veuillez patienter, ça peut parfois prendre 30 secondes ! 😅
            </div>
          </div>
        </Modal.Body>
      </Modal>

      {/* Notification d'erreur de géolocalisation */}
      {geolocationError && (
        <div 
          className="position-absolute top-0 start-50 translate-middle-x mt-3 alert alert-warning alert-dismissible fade show"
          style={{ zIndex: 1001, maxWidth: '90%' }}
          role="alert"
        >
          <strong>Géolocalisation :</strong> {geolocationError}
          <br />
          <small>Utilisation d'une position par défaut. Les données affichées couvrent un rayon de 5km.</small>
          <button 
            type="button" 
            className="btn-close" 
            onClick={() => setGeolocationError(null)}
            aria-label="Close"
          ></button>
        </div>
      )}
    </div>
  );
}