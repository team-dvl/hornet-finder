import { useMapEvents } from 'react-leaflet';
import { useMapClickHandler } from '../../hooks/useMapClickHandler';
import OverlapDialog from './OverlapDialog';
import { Hornet } from '../../store/slices/hornetsSlice';
import { Apiary } from '../../store/slices/apiariesSlice';
import { Nest } from '../../store/slices/nestsSlice';

interface SmartMapClickHandlerProps {
  hornets: Hornet[];
  apiaries: Apiary[];
  nests: Nest[];
  showHornets: boolean;
  showApiaries: boolean;
  showNests: boolean;
  onHornetClick: (hornet: Hornet) => void;
  onApiaryClick: (apiary: Apiary) => void;
  onNestClick: (nest: Nest) => void;
  onMapClick?: (lat: number, lng: number) => void;
}

export default function SmartMapClickHandler({
  hornets,
  apiaries,
  nests,
  showHornets,
  showApiaries,
  showNests,
  onHornetClick,
  onApiaryClick,
  onNestClick,
  onMapClick
}: SmartMapClickHandlerProps) {
  
  const {
    showOverlapDialog,
    overlappingObjects,
    clickPosition,
    handleMapClick,
    handleObjectSelection,
    closeOverlapDialog
  } = useMapClickHandler({
    hornets,
    apiaries,
    nests,
    showHornets,
    showApiaries,
    showNests,
    onHornetClick,
    onApiaryClick,
    onNestClick,
    onMapClick
  });

  // Gérer les clics sur la carte avec détection d'éléments interactifs
  useMapEvents({
    click: (e) => {
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
      
      handleMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <>
      {showOverlapDialog && clickPosition && (
        <OverlapDialog
          show={showOverlapDialog}
          onHide={closeOverlapDialog}
          objects={overlappingObjects}
          onSelectObject={handleObjectSelection}
          position={clickPosition}
        />
      )}
    </>
  );
}
