import { useCallback } from 'react';
import { Map } from 'leaflet';
import { Hornet } from '../store/slices/hornetsSlice';
import { Apiary } from '../store/slices/apiariesSlice';
import { Nest } from '../store/slices/nestsSlice';
import { Trap } from '../store/slices/trapsSlice';
import { MapObject, MapObjectType } from '../components/map/types';
import { OVERLAP_THRESHOLD_PIXELS, MIN_ZOOM_TO_SEPARATE } from '../utils/constants';

// Below this difference (about 10 cm) two objects are considered at the same spot
const SAME_SPOT_DEGREES = 1e-6;

interface UseOverlapDetectionProps {
  map: Map | null;
  hornets: Hornet[];
  apiaries: Apiary[];
  nests: Nest[];
  traps: Trap[];
  showHornets: boolean;
  showApiaries: boolean;
  showNests: boolean;
  showTraps: boolean;
}

interface OverlapDetectionResult {
  hasOverlap: boolean;
  objects: MapObject[];
}

export const useOverlapDetection = ({
  map,
  hornets,
  apiaries,
  nests,
  traps,
  showHornets,
  showApiaries,
  showNests,
  showTraps
}: UseOverlapDetectionProps) => {

  // Fonction pour convertir un frelon en MapObject
  const hornetToMapObject = useCallback((hornet: Hornet): MapObject => {
    const colors: string[] = [];
    if (hornet.mark_color_1) colors.push(hornet.mark_color_1);
    if (hornet.mark_color_2) colors.push(hornet.mark_color_2);

    return {
      id: hornet.id || `hornet-${Math.random()}`,
      type: MapObjectType.HORNET,
      latitude: hornet.latitude,
      longitude: hornet.longitude,
      data: hornet,
      symbol: '🐝',
      title: `Frelon #${hornet.id || 'N/A'}`,
      subtitle: `Direction: ${hornet.direction}°`,
      colors: colors.length > 0 ? colors : undefined
    };
  }, []);

  // Fonction pour convertir un rucher en MapObject
  const apiaryToMapObject = useCallback((apiary: Apiary): MapObject => {
    const infestationLabels: { [key in 1 | 2 | 3]: string } = {
      1: 'Infestation faible',
      2: 'Infestation modérée', 
      3: 'Infestation élevée'
    };

    return {
      id: apiary.id || `apiary-${Math.random()}`,
      type: MapObjectType.APIARY,
      latitude: apiary.latitude,
      longitude: apiary.longitude,
      data: apiary,
      symbol: '🍯',
      title: `Rucher #${apiary.id || 'N/A'}`,
      subtitle: infestationLabels[apiary.infestation_level]
    };
  }, []);

  // Fonction pour convertir un nid en MapObject
  const nestToMapObject = useCallback((nest: Nest): MapObject => {
    return {
      id: nest.id || `nest-${Math.random()}`,
      type: MapObjectType.NEST,
      latitude: nest.latitude,
      longitude: nest.longitude,
      data: nest,
      symbol: nest.destroyed ? '💀' : '🏴',
      title: `Nid #${nest.id || 'N/A'}`,
      subtitle: nest.destroyed ? 'Détruit' : 'Actif'
    };
  }, []);

  // Fonction pour convertir un piège en MapObject
  const trapToMapObject = useCallback((trap: Trap): MapObject => {
    return {
      id: trap.id,
      type: MapObjectType.TRAP,
      latitude: trap.latitude,
      longitude: trap.longitude,
      data: trap,
      symbol: '🪤',
      title: `Piège #${trap.id}`,
      subtitle: trap.active ? trap.trap_type.name : `${trap.trap_type.name} (remisé)`
    };
  }, []);

  // Fonction pour calculer la distance en pixels entre deux points sur la carte
  const getPixelDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    if (!map) return Infinity;
    
    const point1 = map.latLngToContainerPoint([lat1, lng1]);
    const point2 = map.latLngToContainerPoint([lat2, lng2]);
    
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    
    return Math.sqrt(dx * dx + dy * dy);
  }, [map]);

  // Fonction principale pour détecter les chevauchements
  const detectOverlap = useCallback((clickLat: number, clickLng: number): OverlapDetectionResult => {
    if (!map) {
      return { hasOverlap: false, objects: [] };
    }

    const allObjects: MapObject[] = [];

    // Ajouter les frelons visibles
    if (showHornets) {
      hornets.forEach(hornet => {
        const distance = getPixelDistance(clickLat, clickLng, hornet.latitude, hornet.longitude);
        if (distance <= OVERLAP_THRESHOLD_PIXELS) {
          allObjects.push(hornetToMapObject(hornet));
        }
      });
    }

    // Ajouter les ruchers visibles
    if (showApiaries) {
      apiaries.forEach(apiary => {
        const distance = getPixelDistance(clickLat, clickLng, apiary.latitude, apiary.longitude);
        if (distance <= OVERLAP_THRESHOLD_PIXELS) {
          allObjects.push(apiaryToMapObject(apiary));
        }
      });
    }

    // Ajouter les nids visibles
    if (showNests) {
      nests.forEach(nest => {
        const distance = getPixelDistance(clickLat, clickLng, nest.latitude, nest.longitude);
        if (distance <= OVERLAP_THRESHOLD_PIXELS) {
          allObjects.push(nestToMapObject(nest));
        }
      });
    }

    // Ajouter les pièges visibles
    if (showTraps) {
      traps.forEach(trap => {
        const distance = getPixelDistance(clickLat, clickLng, trap.latitude, trap.longitude);
        if (distance <= OVERLAP_THRESHOLD_PIXELS) {
          allObjects.push(trapToMapObject(trap));
        }
      });
    }

    return {
      hasOverlap: allObjects.length > 1,
      objects: allObjects
    };
  }, [
    map, 
    hornets, 
    apiaries, 
    nests, 
    traps,
    showHornets, 
    showApiaries, 
    showNests,
    showTraps,
    getPixelDistance,
    hornetToMapObject,
    apiaryToMapObject,
    nestToMapObject,
    trapToMapObject
  ]);

  // Zoomer n'aide que si la carte peut encore grossir et que les objets ne
  // sont pas tous exactement au même endroit.
  const canZoomToSeparate = useCallback((objects: MapObject[]): boolean => {
    if (!map || map.getZoom() >= MIN_ZOOM_TO_SEPARATE || objects.length < 2) return false;
    const [first, ...others] = objects;
    return others.some(object =>
      Math.abs(object.latitude - first.latitude) > SAME_SPOT_DEGREES
      || Math.abs(object.longitude - first.longitude) > SAME_SPOT_DEGREES
    );
  }, [map]);

  // Fonction pour zoomer afin de tenter de séparer les objets
  const zoomToSeparate = useCallback((lat: number, lng: number) => {
    if (!map) return;
    
    const currentZoom = map.getZoom();
    const newZoom = Math.min(currentZoom + 2, MIN_ZOOM_TO_SEPARATE);
    
    map.setView([lat, lng], newZoom);
  }, [map]);

  return {
    detectOverlap,
    canZoomToSeparate,
    zoomToSeparate
  };
};
