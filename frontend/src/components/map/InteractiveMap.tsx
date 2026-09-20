import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, ZoomControl, useMapEvents } from "react-leaflet";
import { Modal, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { Map } from 'leaflet';
import { useAppDispatch, useAppSelector, selectShowApiaries, selectShowApiaryCircles, selectShowHornets, selectShowReturnZones, selectShowNests, initializeGeolocation, selectMapCenter, selectGeolocationError, setGeolocationError, setIsAdmin } from '../../store/store';
import { selectFilteredHornets } from '../../store/slices/hornetsSlice';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useMapDataFetching } from '../../hooks/useMapDataFetching';
import { MAX_ZOOM, MAX_NATIVE_ZOOM } from '../../utils/constants';
import { signInFromCurrentPage } from '../../utils/authRedirect';
import { Hornet } from '../../store/slices/hornetsSlice';
import { Apiary } from '../../store/slices/apiariesSlice';
import { Nest } from '../../store/slices/nestsSlice';
import HornetReturnZone from './HornetReturnZone';
import ApiaryMarker from '../markers/ApiaryMarker';
import ApiaryCircle from './ApiaryCircle';
import NestMarker from '../markers/NestMarker';
import MapControlsContainer from '../map-controls';
import MapEventHandler from './MapEventHandler';
import HornetInfoPopup from '../popups/HornetInfoPopup';
import HornetReturnZoneInfoPopup from '../popups/HornetReturnZoneInfoPopup';
import ApiaryInfoPopup from '../popups/ApiaryInfoPopup';
import NestInfoPopup from '../popups/NestInfoPopup';
import AddItemSelector from '../forms/AddItemSelector';
import AddHornetPopup from '../popups/AddHornetPopup';
import AddApiaryPopup from '../popups/AddApiaryPopup';
import AddNestPopup from '../popups/AddNestPopup';
import CompassCapture from './CompassCapture';
import OverlapDialog from './OverlapDialog';
import MapRefHandler from './MapRefHandler';
import { useSmartClickHandlers } from '../../hooks/useSmartClickHandlers';
import { MapObject } from './types';
import "leaflet/dist/leaflet.css";
import "leaflet/dist/leaflet.js";
import geomagnetism from "geomagnetism";

// Fonction utilitaire pour calculer la déclinaison magnétique
function calculateMagneticDeclination(hornet: Hornet): { declination: number; correctedDirection: number } | null {
  if (
    typeof hornet.longitude === 'number' &&
    typeof hornet.latitude === 'number' &&
    typeof hornet.direction === 'number'
  ) {
    const geo = geomagnetism.model().point([
      Number(hornet.latitude),
      Number(hornet.longitude)
    ]);
    return {
      declination: geo.decl,
      correctedDirection: hornet.direction + geo.decl
    };
  }
  return null;
}

// Composant interne pour gérer les clics de carte
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e: L.LeafletMouseEvent) => {
      // Vérifier si le clic provient d'un élément interactif
      const target = e.originalEvent?.target as HTMLElement;
      if (target && (
        target.classList.contains('leaflet-interactive') ||
        target.closest('.leaflet-interactive') ||
        target.classList.contains('leaflet-marker-icon') ||
        target.closest('.leaflet-marker-icon') ||
        target.classList.contains('map-control-button') ||
        target.closest('.map-control-button')
      )) {
        // Le clic provient d'un élément interactif, ne pas déclencher notre logique
        return;
      }
      
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  
  return null;
}

export default function InteractiveMap() {
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const { isAdmin, canAddApiary, canAddHornet } = useUserPermissions();
  
  // Redux state
  const mapCenter = useAppSelector(selectMapCenter);
  const geolocationError = useAppSelector(selectGeolocationError);
  
  // Initialiser la géolocalisation en premier
  useEffect(() => {
    console.log('Initializing geolocation...');
    dispatch(initializeGeolocation());
  }, [dispatch]);
  
  // Use custom hook for data fetching seulement après l'initialisation
  useMapDataFetching();
  
  // Set admin status in Redux on mount
  useEffect(() => {
    dispatch(setIsAdmin(isAdmin));
  }, [dispatch, isAdmin]);
  
  // Local state pour la carte
  const [coordinates, setCoordinates] = useState<[number, number]>([mapCenter.latitude, mapCenter.longitude]);
  
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
  
  // États pour le dialogue de chevauchement
  const [showOverlapDialog, setShowOverlapDialog] = useState(false);
  const [overlappingObjects, setOverlappingObjects] = useState<MapObject[]>([]);
  const [overlapPosition, setOverlapPosition] = useState<{ lat: number; lng: number } | null>(null);
  
  // Ajout du state pour la déclinaison et la direction corrigée
  const [returnZoneDeclination, setReturnZoneDeclination] = useState<number | null>(null);
  const [returnZoneCorrectedDirection, setReturnZoneCorrectedDirection] = useState<number | null>(null);
  
  // Ajout du state pour la déclinaison et la direction corrigée du frelon sélectionné
  const [hornetDeclination, setHornetDeclination] = useState<number | null>(null);
  const [hornetCorrectedDirection, setHornetCorrectedDirection] = useState<number | null>(null);
  
  // Sélectionner les données depuis le store Redux
  const { error } = useAppSelector((state) => state.hornets);
  const filteredHornets = useAppSelector(selectFilteredHornets); // Utiliser les frelons filtrés
  const { apiaries } = useAppSelector((state) => state.apiaries);
  const { nests } = useAppSelector((state) => state.nests);
  const showApiaries = useAppSelector(selectShowApiaries);
  const showApiaryCircles = useAppSelector(selectShowApiaryCircles);
  const showHornets = useAppSelector(selectShowHornets);
  const showReturnZones = useAppSelector(selectShowReturnZones);
  const showNests = useAppSelector(selectShowNests);

  // Référence vers la carte Leaflet
  const mapRef = useRef<Map | null>(null);

  // Fonction pour stocker la référence de la carte
  const handleMapReady = (map: Map) => {
    mapRef.current = map;
    
    // Créer un pane personnalisé pour les frelons avec un z-index plus bas
    if (!map.getPane('hornetPane')) {
      const hornetPane = map.createPane('hornetPane');
      hornetPane.style.zIndex = '250'; // Entre les paths (200) et les markers (600)
    }
  };

  // Fonction pour obtenir la déclinaison d'un frelon donné
  const getHornetDeclinationInfo = (hornet: Hornet) => {
    return calculateMagneticDeclination(hornet);
  };

  // Sync coordinates with map center
  useEffect(() => {
    setCoordinates([mapCenter.latitude, mapCenter.longitude]);
  }, [mapCenter]);

  // Gestionnaire de clic sur une zone de frelon
  const handleHornetClick = (hornet: Hornet) => {
    setSelectedHornet(hornet);
    const declinationInfo = calculateMagneticDeclination(hornet);
    if (declinationInfo) {
      setHornetDeclination(declinationInfo.declination);
      setHornetCorrectedDirection(declinationInfo.correctedDirection);
    } else {
      setHornetDeclination(null);
      setHornetCorrectedDirection(null);
    }
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
  const handleReturnZoneClick = (hornet: Hornet, lat?: number, lng?: number, declination?: number, correctedDirection?: number) => {
    setSelectedReturnZoneHornet(hornet);
    if (lat !== undefined && lng !== undefined) {
      setReturnZoneClickPosition({ lat, lng });
    } else {
      setReturnZoneClickPosition(null);
    }
    setReturnZoneDeclination(declination ?? null);
    setReturnZoneCorrectedDirection(correctedDirection ?? null);
    setShowReturnZoneModal(true);
  };

  // Gestionnaires de clic intelligents avec détection de chevauchement
  const handleShowOverlapDialog = (objects: MapObject[], position: { lat: number; lng: number }) => {
    setOverlappingObjects(objects);
    setOverlapPosition(position);
    setShowOverlapDialog(true);
  };

  const handleObjectSelection = (object: MapObject) => {
    switch (object.type) {
      case 'hornet':
        handleHornetClick(object.data as Hornet);
        break;
      case 'apiary':
        handleApiaryClick(object.data as Apiary);
        break;
      case 'nest':
        handleNestClick(object.data as Nest);
        break;
    }
  };

  const handleCloseOverlapDialog = () => {
    setShowOverlapDialog(false);
    setOverlappingObjects([]);
    setOverlapPosition(null);
  };

  const { handleSmartHornetClick, handleSmartApiaryClick, handleSmartNestClick } = useSmartClickHandlers({
    map: mapRef.current,
    hornets: filteredHornets,
    apiaries,
    nests,
    showHornets,
    showApiaries,
    showNests,
    onShowOverlapDialog: handleShowOverlapDialog,
    onHornetClick: handleHornetClick,
    onApiaryClick: handleApiaryClick,
    onNestClick: handleNestClick
  });

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
    // Vérifier d'abord si l'utilisateur est authentifié
    if (!auth.isAuthenticated) {
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
  const handleSelectHornet = (lat?: number, lng?: number) => {
    setShowItemSelector(false);
    // Mettre à jour la position si des coordonnées sont fournies (admin)
    if (lat !== undefined && lng !== undefined) {
      setClickPosition({ lat, lng });
    }
    setShowAddHornetModal(true);
  };

  const handleSelectApiary = (lat?: number, lng?: number) => {
    setShowItemSelector(false);
    // Mettre à jour la position si des coordonnées sont fournies (admin)
    if (lat !== undefined && lng !== undefined) {
      setClickPosition({ lat, lng });
    }
    setShowAddApiaryModal(true);
  };

  const handleSelectNest = (lat?: number, lng?: number) => {
    setShowItemSelector(false);
    // Mettre à jour la position si des coordonnées sont fournies (admin)
    if (lat !== undefined && lng !== undefined) {
      setClickPosition({ lat, lng });
    }
    setShowAddNestModal(true);
  };

  const handleAddSuccess = () => {
    // Optionnel : afficher un message de succès ou recharger les données
  };

  // Pour la permission boussole iOS
  const [showCompassPermissionModal, setShowCompassPermissionModal] = useState(false);
  const [orientationPermissionGranted, setOrientationPermissionGranted] = useState(false);

  // Handler pour demander la permission orientation (iOS)
  const handleRequestOrientationPermission = async () => {
    if (typeof window.DeviceOrientationEvent !== 'undefined' && typeof (window.DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (window.DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setOrientationPermissionGranted(true);
          setShowCompassPermissionModal(false);
        }
      } catch (e) {
        setShowCompassPermissionModal(false);
      }
    }
  };

  // Handler pour QuickCaptureButton (ou LocateButton si besoin)
  const handleQuickHornetCapture = () => {
    // Vérifier d'abord si l'utilisateur est authentifié
    if (!auth.isAuthenticated) {
      // Rediriger vers l'authentification (retour sur la carte après connexion)
      void signInFromCurrentPage(auth);
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

    // Juste avant d'afficher CompassCapture, vérifier si la permission orientation est requise
    if (typeof window.DeviceOrientationEvent !== 'undefined' && typeof (window.DeviceOrientationEvent as any).requestPermission === 'function' && !orientationPermissionGranted) {
      setShowCompassPermissionModal(true);
    }
    setShowCompassCapture(true);
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
        maxZoom={MAX_ZOOM}
        scrollWheelZoom={true}
        style={{ height: "100vh", width: "100%" }}
        zoomControl={false} // Désactiver les contrôles par défaut
      >
        <MapControlsContainer 
          error={error}
          onLocationUpdate={setCoordinates}
          onErrorUpdate={() => {}} // Les erreurs sont maintenant gérées par Redux
          showApiariesButton={auth.isAuthenticated && (isAdmin || canAddApiary)}
          showNestsButton={true} // Tous les utilisateurs peuvent voir les nids (détruits pour non-authentifiés, tous pour authentifiés)
          onQuickHornetCapture={handleQuickHornetCapture}
          canAddHornet={canAddHornet}
        />
        <MapRefHandler onMapReady={handleMapReady} />
        <MapEventHandler />
        <MapClickHandler onMapClick={handleMapClick} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={MAX_ZOOM}
          maxNativeZoom={MAX_NATIVE_ZOOM}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <ZoomControl position="bottomleft" />
        {/* Frelons et zones de retour - niveau le plus bas */}
        {showHornets && filteredHornets.map((hornet: Hornet, index: number) => {
          const declinationInfo = getHornetDeclinationInfo(hornet);
          return (
            <HornetReturnZone
              key={hornet.id || index}
              hornet={hornet}
              onClick={handleSmartHornetClick}
              onShowInfo={handleReturnZoneClick}
              showReturnZone={showReturnZones}
              declination={declinationInfo?.declination}
              correctedDirection={declinationInfo?.correctedDirection}
            />
          );
        })}
        {/* Disques de ruchers - au-dessus des frelons */}
        {showApiaryCircles && showApiaries && auth.isAuthenticated && (isAdmin || canAddApiary) && apiaries.map((apiary, index) => (
          <ApiaryCircle
            key={`circle-${apiary.id || index}`}
            apiary={apiary}
          />
        ))}
        {/* Marqueurs de ruchers - au-dessus des disques */}
        {showApiaries && auth.isAuthenticated && (isAdmin || canAddApiary) && apiaries.map((apiary, index) => (
          <ApiaryMarker
            key={apiary.id || index}
            apiary={apiary}
            onClick={handleSmartApiaryClick}
          />
        ))}
        {/* Marqueurs de nids - niveau le plus haut */}
        {showNests && nests.map((nest, index) => (
          <NestMarker
            key={nest.id || index}
            nest={nest}
            onClick={handleSmartNestClick}
          />
        ))}
      </MapContainer>
      
      <HornetInfoPopup
        show={showHornetModal}
        onHide={handleCloseModal}
        hornet={selectedHornet}
        onAddAtLocation={handleAddAtLocation}
        declination={hornetDeclination}
        correctedDirection={hornetCorrectedDirection}
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
        declination={returnZoneDeclination}
        correctedDirection={returnZoneCorrectedDirection}
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
        showPermissionModal={showCompassPermissionModal}
        onRequestOrientationPermission={handleRequestOrientationPermission}
        onCancelPermissionModal={() => setShowCompassPermissionModal(false)}
        orientationPermissionGranted={orientationPermissionGranted}
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
            onClick={() => dispatch(setGeolocationError(null))}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* Dialogue de sélection d'objets superposés */}
      {showOverlapDialog && overlapPosition && (
        <OverlapDialog
          show={showOverlapDialog}
          onHide={handleCloseOverlapDialog}
          objects={overlappingObjects}
          onSelectObject={handleObjectSelection}
          position={overlapPosition}
        />
      )}
    </div>
  );
}