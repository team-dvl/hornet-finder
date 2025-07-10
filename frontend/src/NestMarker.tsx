import { Marker } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import * as L from 'leaflet';
import { useRef } from 'react';
import { Nest } from './store/slices/nestsSlice';

// Créer une icône personnalisée pour les nids
const createNestIcon = (destroyed: boolean = false) => {
  const color = destroyed ? '#6c757d' : '#dc3545'; // Gris si détruit, rouge sinon
  const symbol = destroyed ? '💀' : '🪣'; // Crâne si détruit, seau si actif
  
  const svg = `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="16" y="21" text-anchor="middle" font-size="16" fill="white">${symbol}</text>
    </svg>
  `;
  
  return new DivIcon({
    html: svg,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    className: 'nest-icon'
  });
};

interface NestMarkerProps {
  nest: Nest;
  onClick?: (nest: Nest) => void;
}

export default function NestMarker({ nest, onClick }: NestMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);

  const handleMarkerClick = () => {
    if (onClick) {
      onClick(nest);
    }
  };

  return (
    <Marker
      ref={markerRef}
      position={[nest.latitude, nest.longitude]}
      icon={createNestIcon(nest.destroyed)}
      eventHandlers={{
        click: handleMarkerClick,
      }}
    />
  );
}
