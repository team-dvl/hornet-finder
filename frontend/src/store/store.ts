// Export central pour tous les éléments du store
export { store } from './index';
export type { RootState, AppDispatch } from './index';
export { useAppDispatch, useAppSelector } from './hooks';

// Export des actions et thunks du slice hornets
export { fetchHornets, fetchHornetsPublic, updateHornetDuration, updateHornetColors, createHornet, deleteHornet, clearError, clearHornets, cycleDisplayMode } from './slices/hornetsSlice';
export { selectShowReturnZones, selectShowHornets, selectDisplayMode, selectHornetsLoading } from './slices/hornetsSlice';
export type { Hornet, HornetDisplayMode, GeolocationParams } from './slices/hornetsSlice';

// Export des actions et thunks du slice apiaries
export { fetchApiaries, fetchMyApiaries, createApiary, deleteApiary, clearError as clearApiariesError, clearApiaries, toggleApiaries } from './slices/apiariesSlice';
export { selectApiaries, selectApiariesLoading, selectApiariesError, selectShowApiaries } from './slices/apiariesSlice';
export type { Apiary } from './slices/apiariesSlice';

// Export des actions et thunks du slice nests
export { fetchNests, fetchNestsDestroyedPublic, createNest, deleteNest, clearError as clearNestsError, clearNests, toggleNests } from './slices/nestsSlice';
export { selectNests, selectNestsLoading, selectNestsError, selectShowNests } from './slices/nestsSlice';
export type { Nest } from './slices/nestsSlice';

// Export des actions et selectors du slice map
export { setMapCenter, setZoom, setGeolocationLoading, setGeolocationError, setIsAdmin, updateMapViewport, initializeGeolocation, setLastFetchedArea } from './slices/mapSlice';
export { selectMapCenter, selectZoom, selectSearchRadius, selectGeolocationLoading, selectGeolocationError, selectIsInitialized, selectIsAdmin, selectLastFetchedArea } from './slices/mapSlice';
export type { MapPosition, MapState, MapBounds } from './slices/mapSlice';
