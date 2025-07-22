import { useMap, useMapEvents } from 'react-leaflet';
import { useAppDispatch } from '../store/hooks';
import { updateMapViewport, MapBounds, MapPosition } from '../store/store';

export const useMapEventHandler = () => {
  const dispatch = useAppDispatch();
  const map = useMap();

  useMapEvents({
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
      
      console.log('Map moved - Center:', mapCenter, 'Zoom:', zoom, 'Bounds:', mapBounds);
      
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
      
      console.log('Map zoomed - Center:', mapCenter, 'Zoom:', zoom, 'Bounds:', mapBounds);
      
      dispatch(updateMapViewport({
        center: mapCenter,
        zoom,
        bounds: mapBounds,
      }));
    },
  });

  return null;
};
