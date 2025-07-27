import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  fetchHornets, 
  fetchHornetsPublic, 
  fetchApiaries, 
  fetchMyApiaries, 
  fetchNests,
  fetchNestsDestroyedPublic,
  selectMapCenter,
  selectSearchRadius,
  selectIsInitialized,
  selectLastFetchedArea,
  setLastFetchedArea,
  selectZoom
} from '../store/store';
import { useUserPermissions } from './useUserPermissions';

interface GeolocationParams {
  lat: number;
  lon: number;
  radius: number;
}

export const useMapDataFetching = () => {
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const { isAdmin, canAddApiary } = useUserPermissions();
  
  const mapCenter = useAppSelector(selectMapCenter);
  const searchRadius = useAppSelector(selectSearchRadius);
  const isInitialized = useAppSelector(selectIsInitialized);
  const lastFetchedArea = useAppSelector(selectLastFetchedArea);
  const currentZoom = useAppSelector(selectZoom);

  useEffect(() => {
    // Attendre que la géolocalisation soit initialisée avant de faire les fetchs
    if (!isInitialized) {
      return;
    }

    // Si on a déjà une zone fetchée, vérifier si la nouvelle vue est incluse
    if (lastFetchedArea) {
      // Si zoom-in (zoom actuel > zoom précédent), ne rien faire
      if (lastFetchedArea.zoom && currentZoom > lastFetchedArea.zoom) {
        return;
      }
      
      // Si la nouvelle vue est incluse dans la zone précédente, ne rien faire
      // (on approxime avec un cercle)
      const toRad = (deg: number) => deg * Math.PI / 180;
      const earthRadius = 6371; // km
      const dLat = toRad(mapCenter.latitude - lastFetchedArea.center.latitude);
      const dLon = toRad(mapCenter.longitude - lastFetchedArea.center.longitude);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(toRad(mapCenter.latitude)) * Math.cos(toRad(lastFetchedArea.center.latitude)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dist = earthRadius * c;
      
      if ((dist + searchRadius) <= lastFetchedArea.radius) {
        // nous sommes dans la zone déjà fetchée, pas besoin de fetcher à nouveau
        return;
      }
    }

    console.log('Geolocation initialized, fetching data for position:', mapCenter);

    // Convertir le centre de la carte en paramètres de géolocalisation
    const geolocationParams: GeolocationParams = {
      lat: mapCenter.latitude,
      lon: mapCenter.longitude,
      radius: searchRadius,
    };

    // Récupérer les frelons (toujours, même pour les utilisateurs non authentifiés)
    if (auth.isAuthenticated && auth.user?.access_token) {
      // Utilisateur authentifié : récupérer avec le token
      dispatch(fetchHornets({ 
        accessToken: auth.user.access_token, 
        geolocation: geolocationParams 
      }));
    } else {
      // Utilisateur non authentifié : récupérer sans token
      dispatch(fetchHornetsPublic(geolocationParams));
    }

    // Récupérer les nids
    if (auth.isAuthenticated && auth.user?.access_token) {
      // Utilisateur authentifié : récupérer tous les nids (détruits et non détruits)
      dispatch(fetchNests({ 
        accessToken: auth.user.access_token, 
        geolocation: geolocationParams 
      }));
    } else {
      // Utilisateur non authentifié : récupérer seulement les nids détruits
      dispatch(fetchNestsDestroyedPublic(geolocationParams));
    }

    // Récupérer les ruchers seulement pour les utilisateurs authentifiés
    if (auth.isAuthenticated && auth.user?.access_token) {
      if (isAdmin) {
        // Les admins peuvent voir tous les ruchers
        dispatch(fetchApiaries({ 
          accessToken: auth.user.access_token, 
          geolocation: geolocationParams 
        }));
      } else if (canAddApiary) {
        // Les apiculteurs peuvent voir leurs propres ruchers (pas de filtrage géographique pour 'my')
        dispatch(fetchMyApiaries(auth.user.access_token));
      }
    }

    // Après chaque fetch, stocker la nouvelle zone
    dispatch(setLastFetchedArea({
      center: mapCenter,
      radius: searchRadius,
      bounds: {
        north: mapCenter.latitude + searchRadius / 111,
        south: mapCenter.latitude - searchRadius / 111,
        east: mapCenter.longitude + (searchRadius / (111 * Math.cos(mapCenter.latitude * Math.PI / 180))),
        west: mapCenter.longitude - (searchRadius / (111 * Math.cos(mapCenter.latitude * Math.PI / 180))),
      },
      zoom: currentZoom,
    }));
  }, [
    isInitialized,
    mapCenter,
    searchRadius, 
    currentZoom,
    auth.isAuthenticated, 
    auth.user?.access_token, 
    dispatch, 
    isAdmin, 
    canAddApiary,
    lastFetchedArea
  ]);
};
