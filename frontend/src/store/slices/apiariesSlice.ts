import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

// Interface pour les paramètres de géolocalisation
export interface GeolocationParams {
  lat: number;
  lon: number;
  radius?: number;
}

// Types pour les données de rucher
export interface Apiary {
  id?: number;
  latitude: number;
  longitude: number;
  infestation_level: 1 | 2 | 3; // Niveau d'infestation selon le backend : 1=Light, 2=Medium, 3=High
  comments?: string;
  created_at?: string;
  created_by?: string; // Email de l'utilisateur qui a créé le rucher
}

// État initial du slice
interface ApiariesState {
  apiaries: Apiary[];
  loading: boolean;
  error: string | null;
  showApiaries: boolean; // Toggle pour afficher/masquer les ruchers
  showApiaryCircles: boolean; // Toggle pour afficher/masquer les cercles de 1km autour des ruchers
  highlightedCircles: number[]; // IDs des cercles de ruchers surlignés
}

const initialState: ApiariesState = {
  apiaries: [],
  loading: false,
  error: null,
  showApiaries: true, // Par défaut, afficher les ruchers
  showApiaryCircles: false, // Par défaut, ne pas afficher les cercles
  highlightedCircles: [], // Aucun cercle surligné par défaut
};

// Thunk async pour récupérer les ruchers
export const fetchApiaries = createAsyncThunk(
  'apiaries/fetchApiaries',
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

      const response = await api.get(`/apiaries?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data as Apiary[];
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      return rejectWithValue(axiosError.response?.data?.message || axiosError.message || 'Une erreur est survenue');
    }
  }
);

// Thunk async pour récupérer les ruchers de l'utilisateur connecté (apiculteur)
export const fetchMyApiaries = createAsyncThunk(
  'apiaries/fetchMyApiaries',
  async (accessToken: string, { rejectWithValue }) => {
    try {
      const response = await api.get('/apiaries/my/', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data as Apiary[];
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      return rejectWithValue(axiosError.response?.data?.message || axiosError.message || 'Une erreur est survenue');
    }
  }
);

// Thunk async pour créer un nouveau rucher
export const createApiary = createAsyncThunk(
  'apiaries/createApiary',
  async ({ 
    latitude, 
    longitude, 
    infestation_level, 
    comments, 
    accessToken 
  }: { 
    latitude: number; 
    longitude: number; 
    infestation_level: number; 
    comments?: string; 
    accessToken: string 
  }, { rejectWithValue }) => {
    try {
      const requestBody: {
        latitude: number;
        longitude: number;
        infestation_level: number;
        comments?: string;
      } = {
        latitude,
        longitude,
        infestation_level,
      };

      // Ajouter les champs optionnels seulement s'ils sont définis
      if (comments) {
        requestBody.comments = comments;
      }

      const response = await api.post('/apiaries/', requestBody, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data as Apiary;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string; detail?: string }; status?: number } };
      const errorMessage = axiosError.response?.data?.message || 
                          axiosError.response?.data?.detail ||
                          `HTTP error! status: ${axiosError.response?.status}`;
      return rejectWithValue(errorMessage || 'Erreur lors de la création du rucher');
    }
  }
);

// Thunk async pour mettre à jour un rucher
export const updateApiary = createAsyncThunk(
  'apiaries/updateApiary',
  async ({ 
    id,
    infestation_level, 
    comments, 
    accessToken 
  }: { 
    id: number;
    infestation_level?: number; 
    comments?: string; 
    accessToken: string 
  }, { rejectWithValue }) => {
    try {
      const requestBody: {
        infestation_level?: number;
        comments?: string;
      } = {};

      // Ajouter les champs à mettre à jour seulement s'ils sont définis
      if (infestation_level !== undefined) {
        requestBody.infestation_level = infestation_level;
      }
      if (comments !== undefined) {
        requestBody.comments = comments;
      }

      const response = await api.patch(`/apiaries/${id}/`, requestBody, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data as Apiary;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string; detail?: string }; status?: number } };
      const errorMessage = axiosError.response?.data?.message || 
                          axiosError.response?.data?.detail ||
                          `HTTP error! status: ${axiosError.response?.status}`;
      return rejectWithValue(errorMessage || 'Erreur lors de la mise à jour du rucher');
    }
  }
);

// Thunk async pour supprimer un rucher
export const deleteApiary = createAsyncThunk(
  'apiaries/deleteApiary',
  async ({ 
    apiaryId, 
    accessToken 
  }: { 
    apiaryId: number; 
    accessToken: string 
  }, { rejectWithValue }) => {
    try {
      await api.delete(`/apiaries/${apiaryId}/`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return apiaryId;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string; detail?: string }; status?: number } };
      const errorMessage = axiosError.response?.data?.message || 
                          axiosError.response?.data?.detail ||
                          `HTTP error! status: ${axiosError.response?.status}`;
      return rejectWithValue(errorMessage || 'Une erreur est survenue lors de la suppression');
    }
  }
);

// Slice pour les ruchers
const apiariesSlice = createSlice({
  name: 'apiaries',
  initialState,
  reducers: {
    // Actions synchrones si nécessaire
    clearError: (state) => {
      state.error = null;
    },
    clearApiaries: (state) => {
      state.apiaries = [];
    },
    toggleApiaries: (state) => {
      state.showApiaries = !state.showApiaries;
    },
    toggleApiaryCircles: (state) => {
      state.showApiaryCircles = !state.showApiaryCircles;
    },
    toggleCircleHighlight: (state, action) => {
      const apiaryIds = action.payload; // Can be a single ID or array of IDs
      const ids = Array.isArray(apiaryIds) ? apiaryIds : [apiaryIds];
      
      // Détermine si on doit allumer ou éteindre en fonction du premier ID
      const firstId = ids[0];
      const shouldHighlight = !state.highlightedCircles.includes(firstId);
      
      // Applique le même état à tous les cercles
      ids.forEach(id => {
        if (shouldHighlight) {
          // Ajouter seulement s'il n'est pas déjà présent
          if (!state.highlightedCircles.includes(id)) {
            state.highlightedCircles.push(id);
          }
        } else {
          // Retirer de la liste
          const index = state.highlightedCircles.indexOf(id);
          if (index > -1) {
            state.highlightedCircles.splice(index, 1);
          }
        }
      });
    },
    clearAllHighlights: (state) => {
      state.highlightedCircles = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Cas de fetchApiaries
      .addCase(fetchApiaries.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchApiaries.fulfilled, (state, action) => {
        state.loading = false;
        state.apiaries = action.payload;
      })
      .addCase(fetchApiaries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Cas de fetchMyApiaries
      .addCase(fetchMyApiaries.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMyApiaries.fulfilled, (state, action) => {
        state.loading = false;
        state.apiaries = action.payload;
      })
      .addCase(fetchMyApiaries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Cas de createApiary
      .addCase(createApiary.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createApiary.fulfilled, (state, action) => {
        state.loading = false;
        state.apiaries.push(action.payload);
      })
      .addCase(createApiary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Cas de updateApiary
      .addCase(updateApiary.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateApiary.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.apiaries.findIndex(apiary => apiary.id === action.payload.id);
        if (index !== -1) {
          state.apiaries[index] = action.payload;
        }
      })
      .addCase(updateApiary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Cas de deleteApiary
      .addCase(deleteApiary.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteApiary.fulfilled, (state, action) => {
        state.loading = false;
        const apiaryId = action.payload;
        state.apiaries = state.apiaries.filter(apiary => apiary.id !== apiaryId);
      })
      .addCase(deleteApiary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// Sélecteurs
export const selectApiaries = (state: { apiaries: ApiariesState }) => state.apiaries.apiaries;
export const selectApiariesLoading = (state: { apiaries: ApiariesState }) => state.apiaries.loading;
export const selectApiariesError = (state: { apiaries: ApiariesState }) => state.apiaries.error;
export const selectShowApiaries = (state: { apiaries: ApiariesState }) => state.apiaries.showApiaries;
export const selectShowApiaryCircles = (state: { apiaries: ApiariesState }) => state.apiaries.showApiaryCircles;
export const selectHighlightedCircles = (state: { apiaries: ApiariesState }) => state.apiaries.highlightedCircles;

// Sélecteur pour récupérer un rucher par ID
export const selectApiaryById = (state: { apiaries: ApiariesState }, id: number | undefined) => 
  id ? state.apiaries.apiaries.find(apiary => apiary.id === id) : null;

export const { clearError, clearApiaries, toggleApiaries, toggleApiaryCircles, toggleCircleHighlight, clearAllHighlights } = apiariesSlice.actions;
export default apiariesSlice.reducer;
