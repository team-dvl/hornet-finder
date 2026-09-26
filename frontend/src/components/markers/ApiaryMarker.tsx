import { Marker } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import { useAppSelector } from '../../store/hooks';
import { selectHighlightedCircles } from '../../store/store';
import { Apiary } from '../../store/slices/apiariesSlice';
import '../../styles/markerFocus.css';

// Couleurs selon le niveau d'infestation
const getInfestationColor = (level: 1 | 2 | 3): string => {
  switch (level) {
    case 1: return '#ffc107'; // Jaune - Infestation faible (Light)
    case 2: return '#fd7e14'; // Orange - Infestation modérée (Medium)
    case 3: return '#dc3545'; // Rouge - Infestation élevée (High)
    default: return '#6c757d'; // Gris - Inconnu
  }
};

// Créer une icône personnalisée avec le niveau d'infestation
const createApiaryIcon = (infestationLevel: 1 | 2 | 3, isGlowing: boolean = false, highlighted: boolean = false) => {
  const color = getInfestationColor(infestationLevel);
  
  // Créer des styles pour l'animation si nécessaire
  const animationStyle = isGlowing ? `
    <style>
      @keyframes strokeGlow {
        0% { stroke: white; }
        50% { stroke: #FF0000; }
        100% { stroke: white; }
      }
      .glow-stroke { animation: strokeGlow 2s ease-in-out infinite; }
    </style>
  ` : '';
  
  const circleClass = isGlowing ? 'glow-stroke' : '';
  
  const svg = `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      ${animationStyle}
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2" class="${circleClass}"/>
      <text x="16" y="21" text-anchor="middle" font-size="16" fill="white">🍯</text>
    </svg>
  `;
  
  return new DivIcon({
    html: svg,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    className: highlighted ? 'apiary-icon map-marker-focus' : 'apiary-icon'
  });
};

interface ApiaryMarkerProps {
  apiary: Apiary;
  onClick?: (apiary: Apiary) => void;
  /** Apiary reached from "Voir sur la carte" in the apiary manager: pulses to be spotted */
  highlighted?: boolean;
}

export default function ApiaryMarker({ apiary, onClick, highlighted = false }: ApiaryMarkerProps) {
  const highlightedCircles = useAppSelector(selectHighlightedCircles);
  
  // Vérifier si ce rucher a son cercle surligné
  const isCircleHighlighted = apiary.id ? highlightedCircles.includes(apiary.id) : false;
  
  const handleMarkerClick = () => {
    if (onClick) {
      onClick(apiary);
    }
  };

  return (
    <Marker
      position={[apiary.latitude, apiary.longitude]}
      icon={createApiaryIcon(apiary.infestation_level, isCircleHighlighted, highlighted)}
      // Above the hornets; a highlighted apiary above everything
      zIndexOffset={highlighted ? 1000 : 100}
      eventHandlers={{
        click: handleMarkerClick,
      }}
    />
  );
}