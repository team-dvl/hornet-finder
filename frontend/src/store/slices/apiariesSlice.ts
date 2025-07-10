import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

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
  async (accessToken: string, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/apiaries', {
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
      });
  },
});

// Sélecteurs
export const selectApiaries = (state: { apiaries: ApiariesState }) => state.apiaries.apiaries;
export const selectApiariesLoading = (state: { apiaries: ApiariesState }) => state.apiaries.loading;
export const selectApiariesError = (state: { apiaries: ApiariesState }) => state.apiaries.error;
export const selectShowApiaries = (state: { apiaries: ApiariesState }) => state.apiaries.showApiaries;

export const { clearError, clearApiaries, toggleApiaries } = apiariesSlice.actions;
export default apiariesSlice.reducer;
