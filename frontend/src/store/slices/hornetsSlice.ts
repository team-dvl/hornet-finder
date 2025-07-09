import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Types pour les données de frelon
export interface Hornet {
  id?: number;
  latitude: number;
  longitude: number;
  direction: number;
  // Ajouter d'autres champs retournés par l'API si nécessaire
  created_at?: string;
  updated_at?: string;
  user_id?: number;
}

// État initial du slice
interface HornetsState {
  hornets: Hornet[];
  loading: boolean;
  error: string | null;
}

const initialState: HornetsState = {
  hornets: [],
  loading: false,
  error: null,
};

// Thunk async pour récupérer les frelons
export const fetchHornets = createAsyncThunk(
  'hornets/fetchHornets',
  async (accessToken: string, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/hornets', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data as Hornet[];
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Une erreur est survenue');
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
      });
  },
});

// Sélecteurs
export const selectHornets = (state: { hornets: HornetsState }) => state.hornets.hornets;
export const selectHornetsLoading = (state: { hornets: HornetsState }) => state.hornets.loading;
export const selectHornetsError = (state: { hornets: HornetsState }) => state.hornets.error;

export const { clearError, clearHornets, addHornet } = hornetsSlice.actions;
export default hornetsSlice.reducer;
