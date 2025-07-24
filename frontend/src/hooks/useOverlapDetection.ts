import { useCallback } from 'react';
import { Map } from 'leaflet';
import { Hornet } from '../store/slices/hornetsSlice';
import { Apiary } from '../store/slices/apiariesSlice';
import { Nest } from '../store/slices/nestsSlice';
import { MapObject, MapObjectType } from '../components/map/types';

interface UseOverlapDetectionProps {
  map: Map | null;
  hornets: Hornet[];
  apiaries: Apiary[];
  nests: Nest[];
  showHornets: boolean;
  showApiaries: boolean;
  showNests: boolean;
}

interface OverlapDetectionResult {
  hasOverlap: boolean;
  objects: MapObject[];
  canZoomToSeparate: boolean;
}

const OVERLAP_THRESHOLD_PIXELS = 50; // Distance en pixels pour considérer un chevauchement
const MIN_ZOOM_TO_SEPARATE = 18; // Zoom minimum pour tenter de séparer les objets

export const useOverlapDetection = ({
  map,
  hornets,
  apiaries,
  nests,
  showHornets,
  showApiaries,
  showNests
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
      return { hasOverlap: false, objects: [], canZoomToSeparate: false };
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

    const hasOverlap = allObjects.length > 1;
    const currentZoom = map.getZoom();
    const canZoomToSeparate = hasOverlap && currentZoom < MIN_ZOOM_TO_SEPARATE;

    return {
      hasOverlap,
      objects: allObjects,
      canZoomToSeparate
    };
  }, [
    map, 
    hornets, 
    apiaries, 
    nests, 
    showHornets, 
    showApiaries, 
    showNests,
    getPixelDistance,
    hornetToMapObject,
    apiaryToMapObject,
    nestToMapObject
  ]);

  // Fonction pour zoomer afin de tenter de séparer les objets
  const zoomToSeparate = useCallback((lat: number, lng: number) => {
    if (!map) return;
    
    const currentZoom = map.getZoom();
    const newZoom = Math.min(currentZoom + 2, MIN_ZOOM_TO_SEPARATE);
    
    map.setView([lat, lng], newZoom);
  }, [map]);

  return {
    detectOverlap,
    zoomToSeparate
  };
};
