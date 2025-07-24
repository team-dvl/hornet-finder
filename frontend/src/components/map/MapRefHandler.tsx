import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { Map } from 'leaflet';

interface MapRefHandlerProps {
  onMapReady: (map: Map) => void;
}

export default function MapRefHandler({ onMapReady }: MapRefHandlerProps) {
  const map = useMap();

  useEffect(() => {
    if (map) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  return null;
}
