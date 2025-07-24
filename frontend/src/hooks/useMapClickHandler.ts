import { useCallback, useState } from 'react';
import { useMap } from 'react-leaflet';
import { useOverlapDetection } from './useOverlapDetection';
import { MapObject } from '../components/map/types';
import { Hornet } from '../store/slices/hornetsSlice';
import { Apiary } from '../store/slices/apiariesSlice';
import { Nest } from '../store/slices/nestsSlice';

interface UseMapClickHandlerProps {
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

interface MapClickState {
  showOverlapDialog: boolean;
  overlappingObjects: MapObject[];
  clickPosition: { lat: number; lng: number } | null;
}

export const useMapClickHandler = ({
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
}: UseMapClickHandlerProps) => {
  
  const map = useMap();
  const [state, setState] = useState<MapClickState>({
    showOverlapDialog: false,
    overlappingObjects: [],
    clickPosition: null
  });

  const { detectOverlap, zoomToSeparate } = useOverlapDetection({
    map,
    hornets,
    apiaries,
    nests,
    showHornets,
    showApiaries,
    showNests
  });

  // Gestionnaire de sélection d'objet depuis le dialogue
  const handleObjectSelection = useCallback((object: MapObject) => {
    switch (object.type) {
      case 'hornet':
        onHornetClick(object.data as Hornet);
        break;
      case 'apiary':
        onApiaryClick(object.data as Apiary);
        break;
      case 'nest':
        onNestClick(object.data as Nest);
        break;
    }
  }, [onHornetClick, onApiaryClick, onNestClick]);

  // Gestionnaire de clic sur la carte
  const handleMapClick = useCallback((lat: number, lng: number) => {
    const overlapResult = detectOverlap(lat, lng);
    
    if (overlapResult.hasOverlap) {
      if (overlapResult.canZoomToSeparate) {
        // Si on peut zoomer pour séparer les objets, on le fait automatiquement
        zoomToSeparate(lat, lng);
      } else {
        // Sinon, on affiche le dialogue de sélection
        setState({
          showOverlapDialog: true,
          overlappingObjects: overlapResult.objects,
          clickPosition: { lat, lng }
        });
      }
    } else if (overlapResult.objects.length === 1) {
      // Un seul objet trouvé, on l'ouvre directement
      handleObjectSelection(overlapResult.objects[0]);
    } else {
      // Aucun objet trouvé, clic sur la carte vide
      if (onMapClick) {
        onMapClick(lat, lng);
      }
    }
  }, [detectOverlap, zoomToSeparate, onMapClick, handleObjectSelection]);

  // Fermer le dialogue de chevauchement
  const closeOverlapDialog = useCallback(() => {
    setState({
      showOverlapDialog: false,
      overlappingObjects: [],
      clickPosition: null
    });
  }, []);

  return {
    ...state,
    handleMapClick,
    handleObjectSelection,
    closeOverlapDialog
  };
};
