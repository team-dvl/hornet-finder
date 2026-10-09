import { useMap, useMapEvents } from 'react-leaflet';
import { useAppDispatch } from '../store/hooks';
import { updateMapViewport, MapBounds, MapPosition } from '../store/store';
import { saveMapView } from '../utils/mapMemory';

export const useMapEventHandler = () => {
  const dispatch = useAppDispatch();
  const map = useMap();

  useMapEvents({
    // Only a drag by the user is remembered: a locate fix, a focus on an object
    // or a zoom animation moves the map without the user choosing the spot
    dragend: () => {
      const center = map.getCenter();
      saveMapView({ latitude: center.lat, longitude: center.lng, zoom: map.getZoom() });
    },
    moveend: () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const bounds = map.getBounds();
      
      const mapCenter: MapPosition = {
        latitude: center.lat,
        longitude: center.lng,
      };
      
      const mapBounds: MapBounds = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      };
      
      dispatch(updateMapViewport({
        center: mapCenter,
        zoom,
        bounds: mapBounds,
      }));
    },
    zoomend: () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const bounds = map.getBounds();
      
      const mapCenter: MapPosition = {
        latitude: center.lat,
        longitude: center.lng,
      };
      
      const mapBounds: MapBounds = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      };
      
      dispatch(updateMapViewport({
        center: mapCenter,
        zoom,
        bounds: mapBounds,
      }));
    },
  });

  return null;
};
