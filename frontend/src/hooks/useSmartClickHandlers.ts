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

  const { detectOverlap, canZoomToSeparate, zoomToSeparate } = useOverlapDetection({
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

  // Objects placed at the same spot never separate by zooming, so a click on
  // overlapping markers always asks which one is meant before opening a sheet.
  const smartClick = useCallback(
    <T extends { latitude: number; longitude: number }>(object: T, onClick: (object: T) => void) => {
      const overlapResult = detectOverlap(object.latitude, object.longitude);
      if (overlapResult.hasOverlap) {
        onShowOverlapDialog(overlapResult.objects, { lat: object.latitude, lng: object.longitude });
      } else {
        onClick(object);
      }
    },
    [detectOverlap, onShowOverlapDialog]
  );

  const handleSmartHornetClick = useCallback((hornet: Hornet) => smartClick(hornet, onHornetClick), [smartClick, onHornetClick]);
  const handleSmartApiaryClick = useCallback((apiary: Apiary) => smartClick(apiary, onApiaryClick), [smartClick, onApiaryClick]);
  const handleSmartNestClick = useCallback((nest: Nest) => smartClick(nest, onNestClick), [smartClick, onNestClick]);
  const handleSmartTrapClick = useCallback((trap: Trap) => smartClick(trap, onTrapClick), [smartClick, onTrapClick]);

  return {
    handleSmartHornetClick,
    handleSmartApiaryClick,
    handleSmartNestClick,
    handleSmartTrapClick,
    canZoomToSeparate,
    zoomToSeparate
  };
};
