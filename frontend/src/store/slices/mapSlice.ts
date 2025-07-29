import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_GEOLOCATION, DEFAULT_ZOOMFACTOR } from '../../utils/constants';

export interface MapPosition {
  latitude: number;
  longitude: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapState {
  center: MapPosition;
  zoom: number;
  isGeolocationLoading: boolean;
  geolocationError: string | null;
  isInitialized: boolean;
  isAdmin: boolean;
  lastFetchedArea?: {
    center: MapPosition;
    radius: number;
    bounds: MapBounds;
    zoom: number;
  };
}

const initialState: MapState = {
  center: DEFAULT_GEOLOCATION,
  zoom: DEFAULT_ZOOMFACTOR,
  isGeolocationLoading: false,
  geolocationError: null,
  isInitialized: false,
  isAdmin: false,
  lastFetchedArea: undefined,
};

// Fonction pour calculer le rayon basé sur le zoom
const calculateRadiusFromZoom = (zoom: number, isAdmin: boolean): number => {
  // Formule basée sur le zoom : plus le zoom est élevé, plus le rayon est petit
  // Zoom 10 -> ~20km, Zoom 15 -> ~5km, Zoom 20 -> ~1km
  let radius = Math.max(0.5, 25 - (zoom * 1.5));
  
  // Arrondir à 0.5 km près
  radius = Math.round(radius * 2) / 2;
  
  // Appliquer les limites selon les permissions
  if (!isAdmin && radius > 5) {
    radius = 5;
  }
  
  // Minimum de 0.5 km
  radius = Math.max(0.5, radius);
  return radius;
};

// Thunk pour initialiser la géolocalisation
export const initializeGeolocation = createAsyncThunk(
  'map/initializeGeolocation',
  async (_, { dispatch }) => {
    return new Promise<MapPosition>((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newPosition: MapPosition = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            resolve(newPosition);
          },
          (error) => {
            let errorMessage = "Erreur de géolocalisation";
            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = "Géolocalisation refusée par l'utilisateur";
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage = "Position non disponible";
                break;
              case error.TIMEOUT:
                errorMessage = "Timeout de géolocalisation";
                break;
            }
            dispatch(setGeolocationError(errorMessage));
            // Utiliser la position par défaut
            resolve(DEFAULT_GEOLOCATION);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          }
        );
      } else {
        dispatch(setGeolocationError("La géolocalisation n'est pas supportée"));
        // Utiliser la position par défaut
        resolve(DEFAULT_GEOLOCATION);
      }
    });
  }
);

const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    setMapCenter: (state, action: PayloadAction<MapPosition>) => {
      state.center = action.payload;
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = action.payload;
    },
    setGeolocationLoading: (state, action: PayloadAction<boolean>) => {
      state.isGeolocationLoading = action.payload;
    },
    setGeolocationError: (state, action: PayloadAction<string | null>) => {
      state.geolocationError = action.payload;
    },
    setIsAdmin: (state, action: PayloadAction<boolean>) => {
      state.isAdmin = action.payload;
    },
    setLastFetchedArea: (state, action: PayloadAction<{ center: MapPosition; radius: number; bounds: MapBounds; zoom: number }>) => {
      state.lastFetchedArea = action.payload;
    },
    updateMapViewport: (state, action: PayloadAction<{ center: MapPosition; zoom: number; bounds: MapBounds }>) => {
      const { center, zoom } = action.payload;
      state.center = center;
      state.zoom = zoom;
      // Le rayon est maintenant calculé automatiquement via le selector
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeGeolocation.pending, (state) => {
        state.isGeolocationLoading = true;
        state.geolocationError = null;
      })
      .addCase(initializeGeolocation.fulfilled, (state) => {
        state.isGeolocationLoading = false;
        // state.center = action.payload; // Désactivé : ne pas centrer automatiquement la carte sur la géoloc
        state.geolocationError = null;
        state.isInitialized = true;
      })
      .addCase(initializeGeolocation.rejected, (state) => {
        state.isGeolocationLoading = false;
        state.isInitialized = true;
        // L'erreur est déjà gérée dans le thunk
      });
  },
});

export const {
  setMapCenter,
  setZoom,
  setGeolocationLoading,
  setGeolocationError,
  setIsAdmin,
  updateMapViewport,
  setLastFetchedArea,
} = mapSlice.actions;

export default mapSlice.reducer;

// Selectors
export const selectMapCenter = (state: { map: MapState }) => state.map.center;
export const selectZoom = (state: { map: MapState }) => state.map.zoom;
export const selectSearchRadius = (state: { map: MapState }) => 
  calculateRadiusFromZoom(state.map.zoom, state.map.isAdmin);
export const selectGeolocationLoading = (state: { map: MapState }) => state.map.isGeolocationLoading;
export const selectGeolocationError = (state: { map: MapState }) => state.map.geolocationError;
export const selectIsInitialized = (state: { map: MapState }) => state.map.isInitialized;
export const selectIsAdmin = (state: { map: MapState }) => state.map.isAdmin;
export const selectLastFetchedArea = (state: { map: MapState }) => state.map.lastFetchedArea;
