import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Types pour les données de nid
export interface Nest {
  id?: number;
  latitude: number;
  longitude: number;
  public_place?: boolean;
  address?: string;
  destroyed?: boolean;
  destroyed_at?: string;
  created_at?: string;
  created_by?: string;
  comments?: string;
}

// État initial du slice
interface NestsState {
  nests: Nest[];
  loading: boolean;
  error: string | null;
  showNests: boolean; // Contrôle l'affichage des nids
}

const initialState: NestsState = {
  nests: [],
  loading: false,
  error: null,
  showNests: true, // Par défaut, afficher les nids pour les utilisateurs authentifiés
};

// Thunk async pour récupérer les nids
export const fetchNests = createAsyncThunk(
  'nests/fetchNests',
  async (accessToken: string, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/nests', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data as Nest[];
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Une erreur est survenue');
    }
  }
);

// Thunk async pour créer un nouveau nid
export const createNest = createAsyncThunk(
  'nests/createNest',
  async ({ 
    latitude, 
    longitude, 
    public_place,
    address,
    comments,
    accessToken 
  }: { 
    latitude: number; 
    longitude: number; 
    public_place?: boolean;
    address?: string;
    comments?: string;
    accessToken: string 
  }, { rejectWithValue }) => {
    try {
      const requestBody: {
        latitude: number;
        longitude: number;
        public_place?: boolean;
        address?: string;
        comments?: string;
      } = {
        latitude,
        longitude,
      };

      // Ajouter les champs optionnels seulement s'ils sont définis
      if (public_place !== undefined) {
        requestBody.public_place = public_place;
      }
      if (address) {
        requestBody.address = address;
      }
      if (comments) {
        requestBody.comments = comments;
      }

      const response = await fetch('/api/nests/', {
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

      const newNest = await response.json();
      return newNest as Nest;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Erreur lors de la création du nid');
    }
  }
);

// Slice pour les nids
const nestsSlice = createSlice({
  name: 'nests',
  initialState,
  reducers: {
    // Actions synchrones
    clearError: (state) => {
      state.error = null;
    },
    clearNests: (state) => {
      state.nests = [];
    },
    // Action pour ajouter un nid localement (pour l'ajout en temps réel)
    addNest: (state, action) => {
      state.nests.push(action.payload);
    },
    // Basculer l'affichage des nids
    toggleNests: (state) => {
      state.showNests = !state.showNests;
    },
  },
  extraReducers: (builder) => {
    builder
      // Cas de fetchNests
      .addCase(fetchNests.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNests.fulfilled, (state, action) => {
        state.loading = false;
        state.nests = action.payload;
      })
      .addCase(fetchNests.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Cas de createNest
      .addCase(createNest.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createNest.fulfilled, (state, action) => {
        state.loading = false;
        state.nests.push(action.payload);
      })
      .addCase(createNest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// Sélecteurs
export const selectNests = (state: { nests: NestsState }) => state.nests.nests;
export const selectNestsLoading = (state: { nests: NestsState }) => state.nests.loading;
export const selectNestsError = (state: { nests: NestsState }) => state.nests.error;
export const selectShowNests = (state: { nests: NestsState }) => state.nests.showNests;

export const { clearError, clearNests, addNest, toggleNests } = nestsSlice.actions;
export default nestsSlice.reducer;
