import { useCallback } from 'react';
import { Map } from 'leaflet';
import { useOverlapDetection } from './useOverlapDetection';
import { MapObject } from '../components/map/types';
import { Hornet } from '../store/slices/hornetsSlice';
import { Apiary } from '../store/slices/apiariesSlice';
import { Nest } from '../store/slices/nestsSlice';

interface UseSmartClickHandlersProps {
  map: Map | null;
  hornets: Hornet[];
  apiaries: Apiary[];
  nests: Nest[];
  showHornets: boolean;
  showApiaries: boolean;
  showNests: boolean;
  onShowOverlapDialog: (objects: MapObject[], position: { lat: number; lng: number }) => void;
  onHornetClick: (hornet: Hornet) => void;
  onApiaryClick: (apiary: Apiary) => void;
  onNestClick: (nest: Nest) => void;
}

export const useSmartClickHandlers = ({
  map,
  hornets,
  apiaries,
  nests,
  showHornets,
  showApiaries,
  showNests,
  onShowOverlapDialog,
  onHornetClick,
  onApiaryClick,
  onNestClick
}: UseSmartClickHandlersProps) => {

  const { detectOverlap, zoomToSeparate } = useOverlapDetection({
    map,
    hornets,
    apiaries,
    nests,
    showHornets,
    showApiaries,
    showNests
  });

  // Gestionnaire de clic intelligent pour les frelons
  const handleSmartHornetClick = useCallback((hornet: Hornet) => {
    const overlapResult = detectOverlap(hornet.latitude, hornet.longitude);
    
    if (overlapResult.hasOverlap && overlapResult.objects.length > 1) {
      if (overlapResult.canZoomToSeparate) {
        zoomToSeparate(hornet.latitude, hornet.longitude);
      } else {
        onShowOverlapDialog(overlapResult.objects, { lat: hornet.latitude, lng: hornet.longitude });
      }
    } else {
      onHornetClick(hornet);
    }
  }, [detectOverlap, zoomToSeparate, onShowOverlapDialog, onHornetClick]);

  // Gestionnaire de clic intelligent pour les ruchers
  const handleSmartApiaryClick = useCallback((apiary: Apiary) => {
    const overlapResult = detectOverlap(apiary.latitude, apiary.longitude);
    
    if (overlapResult.hasOverlap && overlapResult.objects.length > 1) {
      if (overlapResult.canZoomToSeparate) {
        zoomToSeparate(apiary.latitude, apiary.longitude);
      } else {
        onShowOverlapDialog(overlapResult.objects, { lat: apiary.latitude, lng: apiary.longitude });
      }
    } else {
      onApiaryClick(apiary);
    }
  }, [detectOverlap, zoomToSeparate, onShowOverlapDialog, onApiaryClick]);

  // Gestionnaire de clic intelligent pour les nids
  const handleSmartNestClick = useCallback((nest: Nest) => {
    const overlapResult = detectOverlap(nest.latitude, nest.longitude);
    
    if (overlapResult.hasOverlap && overlapResult.objects.length > 1) {
      if (overlapResult.canZoomToSeparate) {
        zoomToSeparate(nest.latitude, nest.longitude);
      } else {
        onShowOverlapDialog(overlapResult.objects, { lat: nest.latitude, lng: nest.longitude });
      }
    } else {
      onNestClick(nest);
    }
  }, [detectOverlap, zoomToSeparate, onShowOverlapDialog, onNestClick]);

  return {
    handleSmartHornetClick,
    handleSmartApiaryClick,
    handleSmartNestClick
  };
};
