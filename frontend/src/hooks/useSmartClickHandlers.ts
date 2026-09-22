import { useCallback } from 'react';
import { Map } from 'leaflet';
import { useOverlapDetection } from './useOverlapDetection';
import { MapObject } from '../components/map/types';
import { Hornet } from '../store/slices/hornetsSlice';
import { Apiary } from '../store/slices/apiariesSlice';
import { Nest } from '../store/slices/nestsSlice';
import { Trap } from '../store/slices/trapsSlice';

interface UseSmartClickHandlersProps {
  map: Map | null;
  hornets: Hornet[];
  apiaries: Apiary[];
  nests: Nest[];
  traps: Trap[];
  showHornets: boolean;
  showApiaries: boolean;
  showNests: boolean;
  showTraps: boolean;
  onShowOverlapDialog: (objects: MapObject[], position: { lat: number; lng: number }) => void;
  onHornetClick: (hornet: Hornet) => void;
  onApiaryClick: (apiary: Apiary) => void;
  onNestClick: (nest: Nest) => void;
  onTrapClick: (trap: Trap) => void;
}

export const useSmartClickHandlers = ({
  map,
  hornets,
  apiaries,
  nests,
  traps,
  showHornets,
  showApiaries,
  showNests,
  showTraps,
  onShowOverlapDialog,
  onHornetClick,
  onApiaryClick,
  onNestClick,
  onTrapClick
}: UseSmartClickHandlersProps) => {

  const { detectOverlap, zoomToSeparate } = useOverlapDetection({
    map,
    hornets,
    apiaries,
    nests,
    traps,
    showHornets,
    showApiaries,
    showNests,
    showTraps
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

  // Gestionnaire de clic intelligent pour les pièges
  const handleSmartTrapClick = useCallback((trap: Trap) => {
    const overlapResult = detectOverlap(trap.latitude, trap.longitude);

    if (overlapResult.hasOverlap && overlapResult.objects.length > 1) {
      if (overlapResult.canZoomToSeparate) {
        zoomToSeparate(trap.latitude, trap.longitude);
      } else {
        onShowOverlapDialog(overlapResult.objects, { lat: trap.latitude, lng: trap.longitude });
      }
    } else {
      onTrapClick(trap);
    }
  }, [detectOverlap, zoomToSeparate, onShowOverlapDialog, onTrapClick]);

  return {
    handleSmartHornetClick,
    handleSmartApiaryClick,
    handleSmartNestClick,
    handleSmartTrapClick
  };
};
