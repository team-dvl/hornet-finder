import { useEffect, useRef } from 'react';
import { useAuth } from 'react-oidc-context';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  fetchHornets, 
  fetchHornetsPublic, 
  fetchApiaries, 
  fetchNests,
  fetchNestsDestroyedPublic,
  selectMapCenter,
  selectSearchRadius,
  selectLastFetchedArea,
  setLastFetchedArea,
  selectZoom,
  selectShowArchivedHornets,
  selectShowArchivedNests,
  type ArchiveFilterParams
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
  const lastFetchedArea = useAppSelector(selectLastFetchedArea);
  const currentZoom = useAppSelector(selectZoom);
  const showArchivedHornets = useAppSelector(selectShowArchivedHornets);
  const showArchivedNests = useAppSelector(selectShowArchivedNests);
  // Permet de forcer un refetch immédiat quand ce toggle change, même si la zone carte n'a pas bougé
  const previousArchiveFilters = useRef<{ hornets: boolean; nests: boolean } | null>(null);

  useEffect(() => {
    const archiveFiltersChanged = previousArchiveFilters.current === null ||
      previousArchiveFilters.current.hornets !== showArchivedHornets ||
      previousArchiveFilters.current.nests !== showArchivedNests;

    // Si on a déjà une zone fetchée, vérifier si la nouvelle vue est incluse
    if (lastFetchedArea && !archiveFiltersChanged) {
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

    // console.log('Geolocation initialized, fetching data for position:', mapCenter);

    // Convertir le centre de la carte en paramètres de géolocalisation
    const geolocationParams: GeolocationParams = {
      lat: mapCenter.latitude,
      lon: mapCenter.longitude,
      radius: searchRadius,
    };

    // Récupérer les frelons (toujours, même pour les utilisateurs non authentifiés)
    const hornetArchiveFilters: ArchiveFilterParams | undefined = showArchivedHornets
      ? { year: 'all', archived: 'true' }
      : undefined;
    if (auth.isAuthenticated && auth.user?.access_token) {
      // Utilisateur authentifié : récupérer avec le token
      dispatch(fetchHornets({ 
        accessToken: auth.user.access_token, 
        geolocation: geolocationParams,
        archiveFilters: hornetArchiveFilters,
      }));
    } else {
      // Utilisateur non authentifié : récupérer sans token
      dispatch(fetchHornetsPublic({ geolocation: geolocationParams, archiveFilters: hornetArchiveFilters }));
    }

    // Récupérer les nids
    const nestArchiveFilters: ArchiveFilterParams | undefined = showArchivedNests
      ? { year: 'all', archived: 'true' }
      : undefined;
    if (auth.isAuthenticated && auth.user?.access_token) {
      // Utilisateur authentifié : récupérer tous les nids (détruits et non détruits)
      dispatch(fetchNests({ 
        accessToken: auth.user.access_token, 
        geolocation: geolocationParams,
        archiveFilters: nestArchiveFilters,
      }));
    } else {
      // Utilisateur non authentifié : récupérer seulement les nids détruits
      dispatch(fetchNestsDestroyedPublic({ geolocation: geolocationParams, archiveFilters: nestArchiveFilters }));
    }

    // Fetch apiaries only for authenticated users with admin or beekeeper rights
    if (auth.isAuthenticated && auth.user?.access_token && (isAdmin || canAddApiary)) {
      dispatch(fetchApiaries({ 
        accessToken: auth.user.access_token, 
        geolocation: geolocationParams 
      }));
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

    previousArchiveFilters.current = { hornets: showArchivedHornets, nests: showArchivedNests };
  }, [
    mapCenter,
    searchRadius, 
    currentZoom,
    auth.isAuthenticated, 
    auth.user?.access_token, 
    dispatch, 
    isAdmin, 
    canAddApiary,
    lastFetchedArea,
    showArchivedHornets,
    showArchivedNests
  ]);
};
