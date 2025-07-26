import { Circle } from 'react-leaflet';
import * as L from 'leaflet';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectHighlightedCircles, selectApiaries, toggleCircleHighlight } from '../../store/store';
import { Apiary } from '../../store/slices/apiariesSlice';
import { findOverlappingCircles } from '../../utils/circleOverlap';
import {
  APIARY_CIRCLE_RADIUS_M,
  APIARY_CIRCLE_COLOR,
  APIARY_CIRCLE_FILL_OPACITY_NORMAL,
  APIARY_CIRCLE_BORDER_OPACITY_NORMAL,
  APIARY_CIRCLE_FILL_OPACITY_HIGHLIGHTED,
  APIARY_CIRCLE_BORDER_OPACITY_HIGHLIGHTED
} from '../../utils/constants';

interface ApiaryCircleProps {
  apiary: Apiary;
}

export default function ApiaryCircle({ apiary }: ApiaryCircleProps) {
  const dispatch = useAppDispatch();
  const highlightedCircles = useAppSelector(selectHighlightedCircles);
  const allApiaries = useAppSelector(selectApiaries);
  
  // Vérifier si ce cercle est surligné
  const isHighlighted = apiary.id ? highlightedCircles.includes(apiary.id) : false;

  const handleClick = (event: L.LeafletMouseEvent) => {
    // Empêcher la propagation vers la carte
    event.originalEvent?.stopPropagation();
    
    if (!apiary.id) return;

    // Obtenir les coordonnées du clic
    const clickLat = event.latlng.lat;
    const clickLon = event.latlng.lng;

    // Trouver tous les cercles qui se chevauchent à cette position
    const overlappingIds = findOverlappingCircles(clickLat, clickLon, allApiaries);
    
    // Toggle l'état de tous les cercles qui se chevauchent
    if (overlappingIds.length > 0) {
      dispatch(toggleCircleHighlight(overlappingIds));
    }
  };

  return (
    <Circle
      center={[apiary.latitude, apiary.longitude]}
      radius={APIARY_CIRCLE_RADIUS_M}
      pathOptions={{
        color: APIARY_CIRCLE_COLOR,
        fillColor: APIARY_CIRCLE_COLOR,
        fillOpacity: isHighlighted ? APIARY_CIRCLE_FILL_OPACITY_HIGHLIGHTED : APIARY_CIRCLE_FILL_OPACITY_NORMAL,
        weight: 2,
        opacity: isHighlighted ? APIARY_CIRCLE_BORDER_OPACITY_HIGHLIGHTED : APIARY_CIRCLE_BORDER_OPACITY_NORMAL,
      }}
      eventHandlers={{
        click: handleClick,
      }}
    />
  );
}
