import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, ZoomControl, useMapEvents } from "react-leaflet";
import { Modal, Spinner } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { Map } from 'leaflet';
import { useAppDispatch, useAppSelector, selectShowApiaries, selectShowApiaryCircles, selectShowHornets, selectShowReturnZones, selectShowNests, initializeGeolocation, selectMapCenter, selectGeolocationError, setGeolocationError, setIsAdmin, selectTraps, selectShowTraps, selectMovingTrapId, setShowTraps, toggleNests, toggleApiaries, stopMovingTrap, updateTrap, setMapCenter } from '../../store/store';
import { selectFilteredHornets } from '../../store/slices/hornetsSlice';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useMapDataFetching } from '../../hooks/useMapDataFetching';
import { MAX_ZOOM, MAX_NATIVE_ZOOM } from '../../utils/constants';
import { signInFromCurrentPage } from '../../utils/authRedirect';
import { reverseGeocode } from '../../utils/geocoding';
import { Hornet } from '../../store/slices/hornetsSlice';
import { Apiary } from '../../store/slices/apiariesSlice';
import { Nest } from '../../store/slices/nestsSlice';
import { Trap } from '../../store/slices/trapsSlice';
import HornetReturnZone from './HornetReturnZone';
import ApiaryMarker from '../markers/ApiaryMarker';
import ApiaryCircle from './ApiaryCircle';
import NestMarker from '../markers/NestMarker';
import TrapMarker from '../markers/TrapMarker';
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
import { TrapAddressChangeModal, TrapFormModal, TrapInfoPopup } from '../traps';
import CompassCapture from './CompassCapture';
import OverlapDialog from './OverlapDialog';
import MapRefHandler from './MapRefHandler';
import { useSmartClickHandlers } from '../../hooks/useSmartClickHandlers';
import { useMapModals, type MapPoint } from '../../hooks/useMapModals';
import { useTagDeepLink } from '../../hooks/useTagDeepLink';
import { TagAssociateModal, TagScannerModal } from '../tags';
import type { TagResolution } from '../../utils/tagsApi';
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

interface InteractiveMapProps {
  /**
   * Which layers the map opens with. The map itself is the same everywhere: a
   * view over all the data, filtered by type, so the user can then overlay
   * whatever they need from the layer controls.
   */
  preset?: 'nests' | 'traps';
}

export default function InteractiveMap({ preset = 'nests' }: InteractiveMapProps) {
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const { isAdmin, canAddApiary, canAddHornet, canAddTrap, userGuid } = useUserPermissions();
  
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
  
  // Une seule modale est ouverte à la fois : fiche d'un objet, sélecteur
  // d'ajout, formulaire de création ou dialogue de chevauchement.
  const { modal, open: openModal, close: closeModal, modalOfKind } = useMapModals();

  // États pour la capture rapide avec boussole
  const [showCompassCapture, setShowCompassCapture] = useState(false);
  const [showGeolocationSpinner, setShowGeolocationSpinner] = useState(false);
  const [compassCapturedPosition, setCompassCapturedPosition] = useState<MapPoint | null>(null);

  // Position en attente pendant un déplacement de piège (avant validation)
  const [pendingTrapPosition, setPendingTrapPosition] = useState<MapPoint | null>(null);
  // Address found at the new position, when it differs from the stored one
  const [trapAddressChange, setTrapAddressChange] = useState<{ current: string; found: string } | null>(null);
  const [savingTrapMove, setSavingTrapMove] = useState(false);
  
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
  const traps = useAppSelector(selectTraps);
  const showTraps = useAppSelector(selectShowTraps);
  const movingTrapId = useAppSelector(selectMovingTrapId);

  // Couches ouvertes par défaut selon la route d'entrée. L'utilisateur reste
  // libre de tout superposer ensuite depuis le contrôle des couches.
  const presetApplied = useRef(false);
  useEffect(() => {
    if (presetApplied.current) return;
    presetApplied.current = true;
    if (preset === 'traps') {
      dispatch(setShowTraps(true));
      // Les nids et les ruchers restent disponibles, mais masqués au départ
      if (showNests) dispatch(toggleNests());
      if (showApiaries) dispatch(toggleApiaries());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, dispatch]);

  // Carte Leaflet, gardée en état pour que la détection des chevauchements
  // la reçoive dès qu'elle est prête (une ref ne déclencherait pas de rendu)
  const [leafletMap, setLeafletMap] = useState<Map | null>(null);

  // Fonction pour stocker la référence de la carte
  const handleMapReady = (map: Map) => {
    setLeafletMap(map);
    
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
    const declinationInfo = calculateMagneticDeclination(hornet);
    openModal({
      kind: 'hornet',
      hornet,
      declination: declinationInfo?.declination ?? null,
      correctedDirection: declinationInfo?.correctedDirection ?? null,
    });
  };

  // Gestionnaire de clic sur un rucher
  const handleApiaryClick = (apiary: Apiary) => openModal({ kind: 'apiary', apiary });

  // Gestionnaire de clic sur un nid
  const handleNestClick = (nest: Nest) => openModal({ kind: 'nest', nest });

  // Gestionnaire de clic sur un piège
  const handleTrapClick = (trap: Trap) => openModal({ kind: 'trap', trap });

  // --- QR Codes -----------------------------------------------------------
  const navigate = useNavigate();
  const [tagError, setTagError] = useState<string | null>(null);

  /** Centre the map on a trap reached from its tag, then open its sheet. */
  const focusTrap = useCallback((trap: Trap) => {
    if (leafletMap) {
      leafletMap.setView([trap.latitude, trap.longitude], Math.max(leafletMap.getZoom(), 17));
    } else {
      dispatch(setMapCenter({ latitude: trap.latitude, longitude: trap.longitude }));
    }
    dispatch(setShowTraps(true));
    openModal({ kind: 'trap', trap });
  }, [leafletMap, dispatch, openModal]);

  const handleTagResolved = useCallback((value: string, resolution: TagResolution) => {
    setTagError(null);
    if (resolution.status === 'associated') {
      focusTrap(resolution.trap);
    } else {
      openModal({ kind: 'tag-associate', value, short: resolution.short });
    }
  }, [focusTrap, openModal]);

  const { needsSignIn: tagNeedsSignIn, resolving: resolvingTag } = useTagDeepLink({
    onResolved: handleTagResolved,
    onError: setTagError,
  });

  // The scanner only extracts the value: `/tag/<value>` does the rest, as for
  // a tag scanned outside the app
  const handleScannedTag = (value: string) => {
    closeModal();
    navigate(`/tag/${value}`);
  };

  // `/scan` (shortcut of the installed app): open the scanner once signed in,
  // and go back to `/traps` so a reload does not reopen it
  const location = useLocation();
  const scanRequested = location.pathname === '/scan';
  const scanNeedsSignIn = scanRequested && !auth.isLoading && !auth.isAuthenticated;
  useEffect(() => {
    if (!scanRequested || auth.isLoading || !auth.isAuthenticated) return;
    dispatch(setShowTraps(true));
    openModal({ kind: 'tag-scanner' });
    navigate('/traps', { replace: true });
  }, [scanRequested, auth.isLoading, auth.isAuthenticated, dispatch, openModal, navigate]);

  // Gestionnaire de clic sur une zone de retour
  const handleReturnZoneClick = (hornet: Hornet, lat?: number, lng?: number, declination?: number, correctedDirection?: number) => {
    openModal({
      kind: 'returnZone',
      hornet,
      position: lat !== undefined && lng !== undefined ? { lat, lng } : null,
      declination: declination ?? null,
      correctedDirection: correctedDirection ?? null,
    });
  };

  // Gestionnaires de clic intelligents avec détection de chevauchement
  const handleShowOverlapDialog = (objects: MapObject[], position: MapPoint) => {
    openModal({ kind: 'overlap', objects, position });
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
      case 'trap':
        handleTrapClick(object.data as Trap);
        break;
    }
  };

  // Les ruchers ne sont affichés qu'aux apiculteurs et aux administrateurs
  const apiariesVisible = showApiaries && auth.isAuthenticated && (isAdmin || canAddApiary);

  const {
    handleSmartHornetClick, handleSmartApiaryClick, handleSmartNestClick, handleSmartTrapClick,
    canZoomToSeparate, zoomToSeparate
  } = useSmartClickHandlers({
    map: leafletMap,
    hornets: filteredHornets,
    apiaries,
    nests,
    traps,
    showHornets,
    showApiaries: apiariesVisible,
    showNests,
    showTraps,
    onShowOverlapDialog: handleShowOverlapDialog,
    onHornetClick: handleHornetClick,
    onApiaryClick: handleApiaryClick,
    onNestClick: handleNestClick,
    onTrapClick: handleTrapClick
  });

  // Gestionnaire de clic sur la carte pour afficher le sélecteur d'éléments
  const handleMapClick = (lat: number, lng: number) => {
    // Vérifier d'abord si l'utilisateur est authentifié
    if (!auth.isAuthenticated) {
      return;
    }

    // Vérifier si l'utilisateur peut ajouter quelque chose (y compris les nids pour les utilisateurs authentifiés)
    const canAddNest = auth.isAuthenticated; // Tous les utilisateurs authentifiés peuvent ajouter des nids
    const canAddSomething = canAddHornet || canAddApiary || canAddNest || canAddTrap;

    if (canAddSomething) {
      openModal({ kind: 'item-selector', position: { lat, lng } });
    }
  };

  // Gestionnaire pour ajouter un élément à la position d'un objet existant
  const handleAddAtLocation = (lat: number, lng: number) => {
    openModal({ kind: 'item-selector', position: { lat, lng } });
  };

  // Gestionnaires de sélection d'éléments : la position du sélecteur peut avoir
  // été ajustée par un administrateur avant de choisir le type d'objet.
  const selectorPosition = (lat?: number, lng?: number): MapPoint => {
    const current = modalOfKind('item-selector')?.position;
    if (lat !== undefined && lng !== undefined) return { lat, lng };
    return current ?? { lat: coordinates[0], lng: coordinates[1] };
  };

  const handleSelectHornet = (lat?: number, lng?: number) => {
    openModal({ kind: 'add-hornet', position: selectorPosition(lat, lng), direction: null });
  };

  const handleSelectApiary = (lat?: number, lng?: number) => {
    openModal({ kind: 'add-apiary', position: selectorPosition(lat, lng) });
  };

  const handleSelectNest = (lat?: number, lng?: number) => {
    openModal({ kind: 'add-nest', position: selectorPosition(lat, lng) });
  };

  const handleSelectTrap = (lat?: number, lng?: number) => {
    openModal({ kind: 'add-trap', position: selectorPosition(lat, lng) });
  };

  // Déplacement d'un piège : le marqueur devient déplaçable, la nouvelle
  // position n'est enregistrée qu'après validation.
  const handleTrapMoved = (_trap: Trap, latitude: number, longitude: number) => {
    setPendingTrapPosition({ lat: latitude, lng: longitude });
  };

  const saveTrapMove = async (address?: string) => {
    if (movingTrapId && pendingTrapPosition) {
      setSavingTrapMove(true);
      await dispatch(updateTrap({
        trapId: movingTrapId,
        values: {
          latitude: pendingTrapPosition.lat,
          longitude: pendingTrapPosition.lng,
          ...(address && { address }),
        },
      }));
      setSavingTrapMove(false);
    }
    setTrapAddressChange(null);
    setPendingTrapPosition(null);
    dispatch(stopMovingTrap());
  };

  const handleConfirmTrapMove = async () => {
    if (!movingTrapId || !pendingTrapPosition) {
      await saveTrapMove();
      return;
    }
    setSavingTrapMove(true);
    const found = await reverseGeocode(pendingTrapPosition.lat, pendingTrapPosition.lng);
    setSavingTrapMove(false);
    const current = traps.find((trap) => trap.id === movingTrapId)?.address?.trim() ?? '';
    // The coordinates are the trap's position; the address only describes it,
    // and may have been written by hand. Moving the trap therefore proposes a
    // new address instead of overwriting the one already there.
    if (found && current && found !== current) {
      setTrapAddressChange({ current, found });
      return;
    }
    await saveTrapMove(found && !current ? found : undefined);
  };

  const handleCancelTrapMove = () => {
    setTrapAddressChange(null);
    setPendingTrapPosition(null);
    dispatch(stopMovingTrap());
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
    const position = compassCapturedPosition ?? { lat: coordinates[0], lng: coordinates[1] };
    setShowCompassCapture(false);
    openModal({ kind: 'add-hornet', position, direction });
  };

  // Gestionnaire pour fermer la capture de boussole
  const handleCloseCompassCapture = () => {
    setShowCompassCapture(false);
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
        style={{ height: "100%", width: "100%" }}
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
          onAddTrap={canAddTrap && showTraps
            ? () => openModal({ kind: 'add-trap', position: null })
            : undefined}
          onScanTag={auth.isAuthenticated && showTraps
            ? () => openModal({ kind: 'tag-scanner' })
            : undefined}
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
        {showApiaryCircles && apiariesVisible && apiaries.map((apiary, index) => (
          <ApiaryCircle
            key={`circle-${apiary.id || index}`}
            apiary={apiary}
          />
        ))}
        {/* Marqueurs de ruchers - au-dessus des disques */}
        {apiariesVisible && apiaries.map((apiary, index) => (
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
        {/* Marqueurs de pièges */}
        {showTraps && traps.map((trap) => (
          <TrapMarker
            key={`trap-${trap.id}`}
            trap={trap}
            isMine={Boolean(trap.owner && trap.owner.guid === userGuid)}
            isMoving={movingTrapId === trap.id}
            pendingPosition={movingTrapId === trap.id ? pendingTrapPosition : null}
            onClick={handleSmartTrapClick}
            onMoved={handleTrapMoved}
          />
        ))}
      </MapContainer>

      {/* Barre de validation du déplacement d'un piège */}
      {movingTrapId !== null && (
        <div
          className="position-absolute bottom-0 start-50 translate-middle-x mb-4 p-3 bg-white rounded shadow text-center"
          style={{ zIndex: 1002, maxWidth: '90%' }}
        >
          <div className="mb-2 small">
            Faites glisser le marqueur du piège vers sa nouvelle position.
          </div>
          <div className="d-flex gap-2 justify-content-center">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleConfirmTrapMove}
              disabled={!pendingTrapPosition || savingTrapMove}
            >
              Valider
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleCancelTrapMove}>
              Annuler
            </button>
          </div>
        </div>
      )}
      
      {trapAddressChange && (
        <TrapAddressChangeModal
          currentAddress={trapAddressChange.current}
          foundAddress={trapAddressChange.found}
          saving={savingTrapMove}
          onReplace={() => void saveTrapMove(trapAddressChange.found)}
          onKeep={() => void saveTrapMove()}
          onHide={() => setTrapAddressChange(null)}
        />
      )}

      <HornetInfoPopup
        show={modal?.kind === 'hornet'}
        onHide={closeModal}
        hornet={modalOfKind('hornet')?.hornet ?? null}
        onAddAtLocation={handleAddAtLocation}
        declination={modalOfKind('hornet')?.declination ?? null}
        correctedDirection={modalOfKind('hornet')?.correctedDirection ?? null}
      />

      <ApiaryInfoPopup
        show={modal?.kind === 'apiary'}
        onHide={closeModal}
        apiary={modalOfKind('apiary')?.apiary ?? null}
        onAddAtLocation={handleAddAtLocation}
      />

      <NestInfoPopup
        show={modal?.kind === 'nest'}
        onHide={closeModal}
        nest={modalOfKind('nest')?.nest ?? null}
        onAddAtLocation={handleAddAtLocation}
      />

      <TrapInfoPopup
        show={modal?.kind === 'trap'}
        onHide={closeModal}
        trap={modalOfKind('trap')?.trap ?? null}
        onAddAtLocation={handleAddAtLocation}
      />

      <HornetReturnZoneInfoPopup
        show={modal?.kind === 'returnZone'}
        onHide={closeModal}
        hornet={modalOfKind('returnZone')?.hornet ?? null}
        clickPosition={modalOfKind('returnZone')?.position ?? null}
        onAddAtLocation={handleAddAtLocation}
        declination={modalOfKind('returnZone')?.declination ?? null}
        correctedDirection={modalOfKind('returnZone')?.correctedDirection ?? null}
      />

      {modalOfKind('item-selector') && (
        <AddItemSelector
          key={`${modalOfKind('item-selector')!.position.lat},${modalOfKind('item-selector')!.position.lng}`}
          show
          onHide={closeModal}
          latitude={modalOfKind('item-selector')!.position.lat}
          longitude={modalOfKind('item-selector')!.position.lng}
          onSelectHornet={handleSelectHornet}
          onSelectApiary={handleSelectApiary}
          onSelectNest={handleSelectNest}
          onSelectTrap={handleSelectTrap}
        />
      )}

      {modalOfKind('add-hornet') && (
        <AddHornetPopup
          show
          onHide={closeModal}
          latitude={modalOfKind('add-hornet')!.position.lat}
          longitude={modalOfKind('add-hornet')!.position.lng}
          onSuccess={handleAddSuccess}
          initialDirection={modalOfKind('add-hornet')!.direction}
        />
      )}

      {modalOfKind('add-apiary') && (
        <AddApiaryPopup
          show
          onHide={closeModal}
          latitude={modalOfKind('add-apiary')!.position.lat}
          longitude={modalOfKind('add-apiary')!.position.lng}
          onSuccess={handleAddSuccess}
        />
      )}

      {modalOfKind('add-nest') && (
        <AddNestPopup
          show
          onHide={closeModal}
          latitude={modalOfKind('add-nest')!.position.lat}
          longitude={modalOfKind('add-nest')!.position.lng}
          onSuccess={handleAddSuccess}
        />
      )}

      {modalOfKind('add-trap') && (
        <TrapFormModal
          onHide={closeModal}
          latitude={modalOfKind('add-trap')!.position?.lat ?? coordinates[0]}
          longitude={modalOfKind('add-trap')!.position?.lng ?? coordinates[1]}
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
            aria-label="Fermer"
          ></button>
        </div>
      )}

      {/* QR Codes : scanner, association, lecture d'un lien /tag/<valeur> */}
      {modalOfKind('tag-scanner') && (
        <TagScannerModal onHide={closeModal} onTag={handleScannedTag} />
      )}

      {modalOfKind('tag-associate') && (
        <TagAssociateModal
          value={modalOfKind('tag-associate')!.value}
          short={modalOfKind('tag-associate')!.short}
          onHide={closeModal}
          onAssociated={focusTrap}
        />
      )}

      {(tagError || tagNeedsSignIn || scanNeedsSignIn || resolvingTag) && (
        <div
          className={`position-absolute top-0 start-50 translate-middle-x mt-5 alert ${tagError ? 'alert-danger alert-dismissible' : 'alert-info'}`}
          style={{ zIndex: 1001, maxWidth: '90%' }}
          role="alert"
        >
          {tagError ? (
            <>
              <strong>QR Code :</strong> {tagError}
              <button type="button" className="btn-close" onClick={() => setTagError(null)} aria-label="Fermer" />
            </>
          ) : tagNeedsSignIn || scanNeedsSignIn ? (
            <>
              {scanNeedsSignIn ? 'Connectez-vous pour scanner un QR Code.' : 'Connectez-vous pour lire ce QR Code.'}{' '}
              <button type="button" className="btn btn-sm btn-primary ms-2" onClick={() => void signInFromCurrentPage(auth)}>
                Connexion
              </button>
            </>
          ) : (
            <><Spinner animation="border" size="sm" className="me-2" />Lecture du QR Code…</>
          )}
        </div>
      )}

      {/* Dialogue de sélection d'objets superposés */}
      {modalOfKind('overlap') && (
        <OverlapDialog
          show
          onHide={closeModal}
          objects={modalOfKind('overlap')!.objects}
          onSelectObject={handleObjectSelection}
          position={modalOfKind('overlap')!.position}
          onZoomToSeparate={canZoomToSeparate(modalOfKind('overlap')!.objects)
            ? () => zoomToSeparate(modalOfKind('overlap')!.position.lat, modalOfKind('overlap')!.position.lng)
            : undefined}
        />
      )}
    </div>
  );
}