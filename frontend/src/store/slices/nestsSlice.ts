import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';
import { getAxiosErrorMessage, type AxiosErrorResponse } from '../../utils/axiosTypes';

// Interface pour les paramètres de géolocalisation
export interface GeolocationParams {
  lat: number;
  lon: number;
  radius?: number;
}

// `year`: 'all' pour désactiver le filtre année (défaut backend = année en cours)
// `archived`: 'true' pour ne voir que les archives, 'all' pour désactiver le filtre (défaut backend = non archivé)
export interface ArchiveFilterParams {
  year?: 'all' | number;
  archived?: 'true' | 'all';
}

export interface NestPhoto {
  id: number;
  /** Private media: shown through `AuthImage` */
  url: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

/** What the requester may do on a nest, computed by the backend (absent from the public list) */
export interface NestPermissions {
  update: boolean;
  photos: boolean;
  /** Turn a destroyed nest back into an active one (admins) */
  reactivate: boolean;
  delete: boolean;
  nearby_apiaries: boolean;
}

// Types pour les données de nid
export interface Nest {
  id?: number;
  latitude: number;
  longitude: number;
  public_place?: boolean;
  address?: string;
  destroyed?: boolean;
  /** Date of the destruction (neutralisation), kept by the backend */
  destroyed_at?: string | null;
  created_at?: string;
  created_by?: { guid: string; display_name: string }; // GUID of the user who created the nest
  comments?: string | null;
  archived?: boolean;
  archived_at?: string;
  photos?: NestPhoto[];
  permissions?: NestPermissions;
}

/** Fields a nest manager may change */
export interface NestUpdateValues {
  latitude?: number;
  longitude?: number;
  public_place?: boolean;
  address?: string;
  comments?: string;
  destroyed?: boolean;
  /** ISO datetime; left out to keep the recorded date */
  destroyed_at?: string;
}

/** First message of a DRF error, field errors included (`{"destroyed": ["…"]}`) */
function nestErrorMessage(error: unknown): string {
  const data = (error as AxiosErrorResponse).response?.data;
  if (data && !data.detail && !data.message) {
    const first = Object.values(data).flat().find((value) => typeof value === 'string');
    if (first) return first as string;
  }
  return getAxiosErrorMessage(error);
}

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

// État initial du slice
interface NestsState {
  nests: Nest[];
  loading: boolean;
  error: string | null;
  showNests: boolean; // Contrôle l'affichage des nids
  showArchived: boolean; // Toggle pour afficher les données archivées (années passées)
}

const initialState: NestsState = {
  nests: [],
  loading: false,
  error: null,
  showNests: true, // Par défaut, afficher les nids pour les utilisateurs authentifiés
  showArchived: false, // Par défaut, ne montrer que l'année en cours (non archivé)
};

// Thunk async pour récupérer les nids (authentifié). `ownAndDestroyed` : sans
// accès à tous les nids (piégeur), ses propres signalements plus les nids détruits.
export const fetchNests = createAsyncThunk(
  'nests/fetchNests',
  async ({ accessToken, geolocation, archiveFilters, ownAndDestroyed }: { 
    accessToken: string; 
    geolocation: GeolocationParams;
    archiveFilters?: ArchiveFilterParams;
    ownAndDestroyed?: boolean;
  }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({
        lat: geolocation.lat.toString(),
        lon: geolocation.lon.toString(),
        ...(geolocation.radius && { radius: geolocation.radius.toString() }),
        ...(archiveFilters?.year !== undefined && { year: archiveFilters.year.toString() }),
        ...(archiveFilters?.archived !== undefined && { archived: archiveFilters.archived }),
      });

      const headers = { 'Authorization': `Bearer ${accessToken}` };
      if (ownAndDestroyed) {
        const [own, destroyed] = await Promise.all([
          api.get(`/nests/my/?${params}`, { headers }),
          api.get(`/nests/destroyed?${params}`),
        ]);
        // One's own destroyed nest comes back from both
        const byId = new Map<number | undefined, Nest>();
        [...(destroyed.data as Nest[]), ...(own.data as Nest[])].forEach((nest) => byId.set(nest.id, nest));
        return Array.from(byId.values());
      }

      const response = await api.get(`/nests?${params}`, { headers });

      return response.data as Nest[];
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

// Thunk async pour récupérer les nids détruits (public, sans authentification)
export const fetchNestsDestroyedPublic = createAsyncThunk(
  'nests/fetchNestsDestroyedPublic',
  async ({ geolocation, archiveFilters }: { geolocation: GeolocationParams; archiveFilters?: ArchiveFilterParams }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({
        lat: geolocation.lat.toString(),
        lon: geolocation.lon.toString(),
        ...(geolocation.radius && { radius: geolocation.radius.toString() }),
        ...(archiveFilters?.year !== undefined && { year: archiveFilters.year.toString() }),
        ...(archiveFilters?.archived !== undefined && { archived: archiveFilters.archived }),
      });

      const response = await api.get(`/nests/destroyed?${params}`);

      return response.data as Nest[];
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

// Thunk async pour créer un nouveau nid, avec ses photos éventuelles.
// Le signaleur est le demandeur, déduit du jeton par le backend.
export const createNest = createAsyncThunk(
  'nests/createNest',
  async ({ latitude, longitude, public_place, address, comments, photos = [] }: {
    latitude: number;
    longitude: number;
    public_place?: boolean;
    address?: string;
    comments?: string;
    photos?: File[];
  }, { rejectWithValue }) => {
    try {
      const form = new FormData();
      form.append('latitude', String(latitude));
      form.append('longitude', String(longitude));
      if (public_place !== undefined) form.append('public_place', String(public_place));
      if (address) form.append('address', address);
      if (comments) form.append('comments', comments);
      photos.forEach((photo) => form.append('photos', photo));
      const response = await api.post('/nests/', form, MULTIPART);
      return response.data as Nest;
    } catch (error: unknown) {
      return rejectWithValue(nestErrorMessage(error) || 'Erreur lors de la création du nid');
    }
  }
);

// Modifier un nid (administrateurs, coordinateurs des chasseurs)
export const updateNest = createAsyncThunk(
  'nests/updateNest',
  async ({ id, values }: { id: number; values: NestUpdateValues }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/nests/${id}/`, values);
      return response.data as Nest;
    } catch (error: unknown) {
      return rejectWithValue(nestErrorMessage(error));
    }
  }
);

// Ajouter une ou plusieurs photos à un nid
export const addNestPhotos = createAsyncThunk(
  'nests/addNestPhotos',
  async ({ id, photos }: { id: number; photos: File[] }, { rejectWithValue }) => {
    try {
      const form = new FormData();
      photos.forEach((photo) => form.append('photos', photo));
      const response = await api.post(`/nests/${id}/photos/`, form, MULTIPART);
      return response.data as Nest;
    } catch (error: unknown) {
      return rejectWithValue(nestErrorMessage(error));
    }
  }
);

// Retirer une photo d'un nid
export const deleteNestPhoto = createAsyncThunk(
  'nests/deleteNestPhoto',
  async ({ id, photoId }: { id: number; photoId: number }, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/nests/${id}/photos/${photoId}/`);
      return response.data as Nest;
    } catch (error: unknown) {
      return rejectWithValue(nestErrorMessage(error));
    }
  }
);

/**
 * AFSCA numbers of the apiaries within 1 km of a nest, sorted by number (not
 * kept in the store). No distance, no order by distance: they would locate the apiaries.
 */
export async function fetchNearbyApiaries(id: number): Promise<string[]> {
  const response = await api.get(`/nests/${id}/nearby-apiaries/`);
  return response.data as string[];
}

// Thunk async pour supprimer un nid (admin uniquement)
export const deleteNest = createAsyncThunk(
  'nests/deleteNest',
  async ({ nestId }: { nestId: number }, { rejectWithValue }) => {
    try {
      await api.delete(`/nests/${nestId}/`);
      return nestId;
    } catch (error: unknown) {
      return rejectWithValue(nestErrorMessage(error) || 'Une erreur est survenue lors de la suppression');
    }
  }
);

// Thunk async pour archiver un nid (admin uniquement)
export const archiveNest = createAsyncThunk(
  'nests/archiveNest',
  async ({ nestId }: { nestId: number }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/nests/${nestId}/archive/`, {});
      return response.data as Nest;
    } catch (error: unknown) {
      return rejectWithValue(nestErrorMessage(error) || "Erreur lors de l'archivage du nid");
    }
  }
);

function replaceNest(state: NestsState, nest: Nest) {
  const index = state.nests.findIndex((item) => item.id === nest.id);
  if (index >= 0) state.nests[index] = nest;
}

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
    setShowNests: (state, action) => {
      state.showNests = action.payload as boolean;
    },
    toggleShowArchived: (state) => {
      state.showArchived = !state.showArchived;
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
      // Cas de fetchNestsDestroyedPublic
      .addCase(fetchNestsDestroyedPublic.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNestsDestroyedPublic.fulfilled, (state, action) => {
        state.loading = false;
        state.nests = action.payload;
      })
      .addCase(fetchNestsDestroyedPublic.rejected, (state, action) => {
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
      })
      // Cas de deleteNest
      .addCase(deleteNest.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteNest.fulfilled, (state, action) => {
        state.loading = false;
        const nestId = action.payload;
        state.nests = state.nests.filter(nest => nest.id !== nestId);
      })
      .addCase(deleteNest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Modification et photos : la copie du store suit la réponse du backend
      .addCase(updateNest.fulfilled, (state, action) => replaceNest(state, action.payload))
      .addCase(addNestPhotos.fulfilled, (state, action) => replaceNest(state, action.payload))
      .addCase(deleteNestPhoto.fulfilled, (state, action) => replaceNest(state, action.payload))
      // Cas de archiveNest : l'élément archivé disparaît de la vue courante (par défaut non-archivée)
      .addCase(archiveNest.fulfilled, (state, action) => {
        state.nests = state.nests.filter(nest => nest.id !== action.payload.id);
      })
      .addCase(archiveNest.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

// Sélecteurs
export const selectNests = (state: { nests: NestsState }) => state.nests.nests;
export const selectNestsLoading = (state: { nests: NestsState }) => state.nests.loading;
export const selectNestsError = (state: { nests: NestsState }) => state.nests.error;
export const selectShowNests = (state: { nests: NestsState }) => state.nests.showNests;
export const selectShowArchivedNests = (state: { nests: NestsState }) => state.nests.showArchived;
export const selectNestById = (state: { nests: NestsState }, id?: number) =>
  id === undefined ? undefined : state.nests.nests.find((nest) => nest.id === id);

export const { clearError, clearNests, addNest, toggleNests, setShowNests, toggleShowArchived } = nestsSlice.actions;
export default nestsSlice.reducer;
