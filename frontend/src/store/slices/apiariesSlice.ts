import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

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
}

const initialState: ApiariesState = {
  apiaries: [],
  loading: false,
  error: null,
  showApiaries: true, // Par défaut, afficher les ruchers
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

      const response = await fetch(`/api/apiaries?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data as Apiary[];
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Une erreur est survenue');
    }
  }
);

// Thunk async pour récupérer les ruchers de l'utilisateur connecté (apiculteur)
export const fetchMyApiaries = createAsyncThunk(
  'apiaries/fetchMyApiaries',
  async (accessToken: string, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/apiaries/my/', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data as Apiary[];
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Une erreur est survenue');
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

      const response = await fetch('/api/apiaries/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const newApiary = await response.json();
      return newApiary as Apiary;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Erreur lors de la création du rucher');
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

      const response = await fetch(`/api/apiaries/${id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const updatedApiary = await response.json();
      return updatedApiary as Apiary;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Erreur lors de la mise à jour du rucher');
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
      const response = await fetch(`/api/apiaries/${apiaryId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      return apiaryId;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Une erreur est survenue lors de la suppression');
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

// Sélecteur pour récupérer un rucher par ID
export const selectApiaryById = (state: { apiaries: ApiariesState }, id: number | undefined) => 
  id ? state.apiaries.apiaries.find(apiary => apiary.id === id) : null;

export const { clearError, clearApiaries, toggleApiaries } = apiariesSlice.actions;
export default apiariesSlice.reducer;
