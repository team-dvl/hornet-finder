// Export central pour tous les éléments du store
export { store } from './index';
export type { RootState, AppDispatch } from './index';
export { useAppDispatch, useAppSelector } from './hooks';

// Export des actions et thunks du slice hornets
export { fetchHornets, fetchHornetsPublic, updateHornetDuration, updateHornetColors, createHornet, deleteHornet, archiveHornet, bulkArchiveHornets, clearError, clearHornets, toggleHornets, toggleReturnZones, toggleShowArchived as toggleShowArchivedHornets } from './slices/hornetsSlice';
export { selectShowReturnZones, selectShowHornets, selectHornetsLoading, selectShowArchivedHornets } from './slices/hornetsSlice';
export type { Hornet, GeolocationParams, ArchiveFilterParams } from './slices/hornetsSlice';

// Export des actions et thunks du slice apiaries
export { fetchApiaries, fetchMyApiaries, createApiary, deleteApiary, clearError as clearApiariesError, clearApiaries, toggleApiaries, toggleApiaryCircles, toggleCircleHighlight, clearAllHighlights } from './slices/apiariesSlice';
export { selectApiaries, selectApiariesLoading, selectApiariesError, selectShowApiaries, selectShowApiaryCircles, selectHighlightedCircles } from './slices/apiariesSlice';
export type { Apiary } from './slices/apiariesSlice';

// Export des actions et thunks du slice nests
export { fetchNests, fetchNestsDestroyedPublic, createNest, deleteNest, archiveNest, bulkArchiveNests, clearError as clearNestsError, clearNests, toggleNests, toggleShowArchived as toggleShowArchivedNests } from './slices/nestsSlice';
export { selectNests, selectNestsLoading, selectNestsError, selectShowNests, selectShowArchivedNests } from './slices/nestsSlice';
export type { Nest } from './slices/nestsSlice';

// Export des actions et thunks du slice traps
export {
  fetchTraps, fetchTrapDetail, createTrap, updateTrap, deleteTrap, addTrapEvent,
  deleteTrapEvent, fetchTrapDelegation, setTrapDelegation, clearTrapDelegation,
  setTrapOwner, fetchTrapTypes, fetchSpecies, createTrapType, updateTrapType,
  deleteTrapType, addTrapCatch, deleteTrapCatch, createSpecies, updateSpecies, deleteSpecies,
  clearTrapsError, clearTraps, toggleTraps, toggleInactiveTraps,
  toggleOnlyMyTraps, setShowTraps, setSelectedTrap, startMovingTrap, stopMovingTrap,
} from './slices/trapsSlice';
export {
  selectTraps, selectSelectedTrap, selectTrapTypes, selectSpecies, selectShowTraps,
  selectShowInactiveTraps, selectOnlyMyTraps, selectMovingTrapId, selectTrapsLoading,
  selectTrapsError,
} from './slices/trapsSlice';
export type {
  Trap, TrapEvent, TrapEventKind, TrapPhoto, TrapType, Species, DelegationInfo,
  TrapFormValues, TrapTypeFormValues, SpeciesFormValues, CatchItem, UserSummary, GroupSummary,
} from './slices/trapsSlice';

// Export des actions et selectors du slice map
export { setMapCenter, setZoom, setGeolocationLoading, setGeolocationError, setIsAdmin, updateMapViewport, initializeGeolocation, setLastFetchedArea } from './slices/mapSlice';
export { selectMapCenter, selectZoom, selectSearchRadius, selectGeolocationLoading, selectGeolocationError, selectIsInitialized, selectIsAdmin, selectLastFetchedArea } from './slices/mapSlice';
export type { MapPosition, MapState, MapBounds } from './slices/mapSlice';

// Export des actions et selectors du slice profile
export { fetchAvatar, uploadAvatar, deleteAvatar, clearProfileError } from './slices/profileSlice';
export { selectAvatarOverride, selectProfileSaving, selectProfileError } from './slices/profileSlice';
