import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

// Interface pour les paramètres de géolocalisation
export interface GeolocationParams {
  lat: number;
  lon: number;
  radius?: number;
}

// Types pour les données de frelon
export interface Hornet {
  id?: number;
  latitude: number;
  longitude: number;
  direction: number;
  duration?: number; // Durée en secondes entre retour au nid et réapparition
  mark_color_1?: string; // Première couleur de marquage
  mark_color_2?: string; // Deuxième couleur de marquage
  created_at?: string;
  updated_at?: string;
  user_id?: number;
  created_by?: { guid: string; display_name: string }; // GUID of the user who created the hornet
}

// Interface pour les filtres de couleur
export interface ColorFilters {
  color1: string;
  color2: string;
}

// État initial du slice
interface HornetsState {
  hornets: Hornet[];
  loading: boolean;
  error: string | null;
  showHornets: boolean; // Toggle pour afficher/masquer les frelons
  showReturnZones: boolean; // Toggle pour afficher/masquer les zones de retour
  colorFilters: ColorFilters; // Filtres par couleur
}

const initialState: HornetsState = {
  hornets: [],
  loading: false,
  error: null,
  showHornets: true, // Par défaut, afficher les frelons
  showReturnZones: true, // Par défaut, afficher les zones de retour
  colorFilters: { color1: '', color2: '' }, // Pas de filtre par défaut
};

// Thunk async pour récupérer les frelons avec authentification
export const fetchHornets = createAsyncThunk(
  'hornets/fetchHornets',
  async ({ accessToken, geolocation }: { 
    accessToken: string; 
    geolocation: GeolocationParams 
  }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({
        lat: geolocation.lat.toString(),
        lon: geolocation.lon.toString(),
        ...(geolocation.radius && { radius: geolocation.radius.toString() })
      });

      const response = await api.get(`/hornets?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data as Hornet[];
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      return rejectWithValue(axiosError.response?.data?.message || axiosError.message || 'Une erreur est survenue');
    }
  }
);

// Thunk async pour récupérer les frelons (public, sans authentification)
export const fetchHornetsPublic = createAsyncThunk(
  'hornets/fetchHornetsPublic',
  async (geolocation: GeolocationParams, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({
        lat: geolocation.lat.toString(),
        lon: geolocation.lon.toString(),
        ...(geolocation.radius && { radius: geolocation.radius.toString() })
      });

      const response = await api.get(`/hornets?${params}`);

      return response.data as Hornet[];
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      return rejectWithValue(axiosError.response?.data?.message || axiosError.message || 'Une erreur est survenue');
    }
  }
);

// Thunk async pour mettre à jour la durée d'un frelon
export const updateHornetDuration = createAsyncThunk(
  'hornets/updateHornetDuration',
  async ({ hornetId, duration, accessToken }: { hornetId: number; duration: number; accessToken: string }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/hornets/${hornetId}/`, 
        { duration },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      return { hornetId, updatedHornet: response.data } as { hornetId: number; updatedHornet: Hornet };
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      return rejectWithValue(axiosError.response?.data?.message || axiosError.message || 'Erreur lors de la mise à jour');
    }
  }
);

// Thunk async pour mettre à jour les couleurs de marquage d'un frelon
export const updateHornetColors = createAsyncThunk(
  'hornets/updateHornetColors',
  async ({ hornetId, markColor1, markColor2, accessToken }: { 
    hornetId: number; 
    markColor1: string; 
    markColor2: string; 
    accessToken: string 
  }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/hornets/${hornetId}/`, 
        { 
          mark_color_1: markColor1, 
          mark_color_2: markColor2 
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      return { hornetId, updatedHornet: response.data } as { hornetId: number; updatedHornet: Hornet };
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      return rejectWithValue(axiosError.response?.data?.message || axiosError.message || 'Erreur lors de la mise à jour des couleurs');
    }
  }
);

// Thunk async pour créer un nouveau frelon
export const createHornet = createAsyncThunk(
  'hornets/createHornet',
  async ({ 
    latitude, 
    longitude, 
    direction, 
    duration, 
    mark_color_1, 
    mark_color_2, 
    accessToken, 
    userGuid 
  }: { 
    latitude: number; 
    longitude: number; 
    direction: number; 
    duration?: number; 
    mark_color_1?: string; 
    mark_color_2?: string; 
    accessToken: string; 
    userGuid: string; // GUID Keycloak
  }, { rejectWithValue }) => {
    try {
      const requestBody: {
        latitude: number;
        longitude: number;
        direction: number;
        duration?: number;
        mark_color_1?: string;
        mark_color_2?: string;
        created_by: string;
      } = {
        latitude,
        longitude,
        direction,
        created_by: userGuid,
      };
      if (duration !== undefined) {
        requestBody.duration = duration;
      }
      if (mark_color_1) {
        requestBody.mark_color_1 = mark_color_1;
      }
      if (mark_color_2) {
        requestBody.mark_color_2 = mark_color_2;
      }
      const response = await api.post('/hornets/', requestBody, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      return response.data as Hornet;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string; detail?: string }; status?: number } };
      const errorMessage = axiosError.response?.data?.message || 
                          axiosError.response?.data?.detail ||
                          `HTTP error! status: ${axiosError.response?.status}`;
      return rejectWithValue(errorMessage || 'Erreur lors de la création du frelon');
    }
  }
);

// Thunk async pour supprimer un frelon
export const deleteHornet = createAsyncThunk(
  'hornets/deleteHornet',
  async ({ 
    hornetId, 
    accessToken 
  }: { 
    hornetId: number; 
    accessToken: string 
  }, { rejectWithValue }) => {
    try {
      await api.delete(`/hornets/${hornetId}/`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return hornetId;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string; detail?: string }; status?: number } };
      const errorMessage = axiosError.response?.data?.message || 
                          axiosError.response?.data?.detail ||
                          `HTTP error! status: ${axiosError.response?.status}`;
      return rejectWithValue(errorMessage || 'Une erreur est survenue lors de la suppression');
    }
  }
);

// Slice pour les frelons
const hornetsSlice = createSlice({
  name: 'hornets',
  initialState,
  reducers: {
    // Actions synchrones si nécessaire
    clearError: (state) => {
      state.error = null;
    },
    clearHornets: (state) => {
      state.hornets = [];
    },
    // Action pour ajouter un frelon localement (pour l'ajout en temps réel)
    addHornet: (state, action) => {
      state.hornets.push(action.payload);
    },
    // Actions simples pour gérer l'affichage (comme les ruchers)
    toggleHornets: (state) => {
      state.showHornets = !state.showHornets;
      // Si on cache les frelons, cacher aussi les zones automatiquement
      if (!state.showHornets) {
        state.showReturnZones = false;
      }
    },
    toggleReturnZones: (state) => {
      state.showReturnZones = !state.showReturnZones;
    },
    // Actions pour gérer les filtres par couleur
    setColorFilters: (state, action) => {
      state.colorFilters = action.payload;
    },
    clearColorFilters: (state) => {
      state.colorFilters = { color1: '', color2: '' };
    },
  },
  extraReducers: (builder) => {
    builder
      // Cas de fetchHornets
      .addCase(fetchHornets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHornets.fulfilled, (state, action) => {
        state.loading = false;
        state.hornets = action.payload;
      })
      .addCase(fetchHornets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Cas de fetchHornetsPublic
      .addCase(fetchHornetsPublic.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHornetsPublic.fulfilled, (state, action) => {
        state.loading = false;
        state.hornets = action.payload;
      })
      .addCase(fetchHornetsPublic.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Cas de updateHornetDuration
      .addCase(updateHornetDuration.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateHornetDuration.fulfilled, (state, action) => {
        state.loading = false;
        const { hornetId, updatedHornet } = action.payload;
        const index = state.hornets.findIndex(hornet => hornet.id === hornetId);
        if (index !== -1) {
          state.hornets[index] = updatedHornet;
        }
      })
      .addCase(updateHornetDuration.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Cas de updateHornetColors
      .addCase(updateHornetColors.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateHornetColors.fulfilled, (state, action) => {
        state.loading = false;
        const { hornetId, updatedHornet } = action.payload;
        const index = state.hornets.findIndex(hornet => hornet.id === hornetId);
        if (index !== -1) {
          state.hornets[index] = updatedHornet;
        }
      })
      .addCase(updateHornetColors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Cas de createHornet
      .addCase(createHornet.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createHornet.fulfilled, (state, action) => {
        state.loading = false;
        state.hornets.push(action.payload);
      })
      .addCase(createHornet.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Cas de deleteHornet
      .addCase(deleteHornet.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteHornet.fulfilled, (state, action) => {
        state.loading = false;
        const hornetId = action.payload;
        state.hornets = state.hornets.filter(hornet => hornet.id !== hornetId);
      })
      .addCase(deleteHornet.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// Sélecteurs
export const selectHornets = (state: { hornets: HornetsState }) => state.hornets.hornets;
export const selectHornetsLoading = (state: { hornets: HornetsState }) => state.hornets.loading;
export const selectHornetsError = (state: { hornets: HornetsState }) => state.hornets.error;
export const selectShowHornets = (state: { hornets: HornetsState }) => state.hornets.showHornets;
export const selectShowReturnZones = (state: { hornets: HornetsState }) => state.hornets.showReturnZones;
export const selectColorFilters = (state: { hornets: HornetsState }) => state.hornets.colorFilters;

// Sélecteur pour les frelons filtrés par couleur
export const selectFilteredHornets = (state: { hornets: HornetsState }) => {
  const hornets = state.hornets.hornets;
  const filters = state.hornets.colorFilters;
  
  // Si aucun filtre n'est actif, retourner tous les frelons
  if (!filters.color1 && !filters.color2) {
    return hornets;
  }
  
  // Filtrer les frelons selon les couleurs sélectionnées
  return hornets.filter(hornet => {
    // Si le frelon n'a aucune couleur de marquage et qu'un filtre est actif, l'exclure
    if (!hornet.mark_color_1 && !hornet.mark_color_2) {
      return false;
    }
    
    const hornetColors = [hornet.mark_color_1, hornet.mark_color_2].filter((color): color is string => Boolean(color));
    const filterColors = [filters.color1, filters.color2].filter((color): color is string => Boolean(color));
    
    // Si un seul filtre est défini, le frelon doit avoir au moins cette couleur
    if (filterColors.length === 1) {
      return hornetColors.includes(filterColors[0]);
    }
    
    // Si deux filtres sont définis, le frelon doit avoir exactement ces deux couleurs
    if (filterColors.length === 2) {
      return hornetColors.length === 2 && 
             filterColors.every(filterColor => hornetColors.includes(filterColor));
    }
    
    return false;
  });
};

export const { clearError, clearHornets, addHornet, toggleHornets, toggleReturnZones, setColorFilters, clearColorFilters } = hornetsSlice.actions;
export default hornetsSlice.reducer;
