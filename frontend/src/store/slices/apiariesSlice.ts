import { createSlice, createAsyncThunk, isAnyOf } from '@reduxjs/toolkit';
import api from '../../utils/api';
import { getAxiosErrorMessage } from '../../utils/axiosTypes';

// Interface pour les paramètres de géolocalisation
export interface GeolocationParams {
  lat: number;
  lon: number;
  radius?: number;
}

export interface ApiaryGroupGrant {
  group: string; // ex: /beekeepers/vsab
  group_name?: string;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

// Types pour les données de rucher
export interface Apiary {
  id?: number;
  latitude: number;
  longitude: number;
  /** Describes the position; '' when unknown */
  address?: string;
  infestation_level: 1 | 2 | 3; // Niveau d'infestation selon le backend : 1=Light, 2=Medium, 3=High
  /** Registration number at the AFSCA, '' when unknown */
  afsca_number?: string;
  photo_url?: string | null;
  photo_thumbnail_url?: string | null;
  comments?: string | null;
  created_at?: string;
  created_by?: { guid: string; display_name: string } | null;
  /** The beekeeper in charge: the creator unless an admin reassigned it */
  owner?: { guid: string; display_name: string } | null;
  extended_permissions?: ApiaryGroupGrant[];
  /** What the current user may do, computed by the backend */
  permissions?: { update: boolean; delete: boolean; share: boolean };
}

/** Payload shared by the create and update forms. */
export interface ApiaryFormValues {
  latitude?: number;
  longitude?: number;
  address?: string;
  infestation_level?: number;
  afsca_number?: string;
  comments?: string;
  photo?: File | null;
}

export interface ApiarySharingInfo {
  can_share: boolean;
  /** null means "any group" (platform admin) */
  allowed_groups: { path: string; name: string }[] | null;
}

/** Whose apiaries the manager lists */
export type ApiaryScope = 'mine' | 'shared' | 'all';

/** Sort keys of the manager; a leading `-` sorts in descending order */
export type ApiaryOrdering =
  | '-infestation_level' | 'infestation_level'
  | '-created_at' | 'created_at'
  | 'address' | '-id' | 'id'
  | 'distance';

/** Query of the apiary manager (`GET /apiaries/managed/`) */
export interface ManagedApiariesQuery {
  scope: ApiaryScope;
  ordering: ApiaryOrdering;
  q?: string;
  group?: string;
  infestation_level?: '1' | '2' | '3';
  /** Needed by the `distance` ordering */
  lat?: number;
  lon?: number;
}

interface ManagedApiariesState {
  items: Apiary[];
  count: number;
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  /** Request whose answer is awaited: an older one is ignored when it lands */
  requestId: string | null;
}

// État initial du slice
interface ApiariesState {
  apiaries: Apiary[];
  managed: ManagedApiariesState;
  loading: boolean;
  error: string | null;
  showApiaries: boolean; // Toggle pour afficher/masquer les ruchers
  showApiaryCircles: boolean; // Toggle pour afficher/masquer les cercles de 1km autour des ruchers
  highlightedCircles: number[]; // IDs des cercles de ruchers surlignés
  onlyMyApiaries: boolean; // Hide the apiaries shared by a group
}

const initialState: ApiariesState = {
  apiaries: [],
  managed: {
    items: [],
    count: 0,
    page: 0,
    hasMore: false,
    loading: false,
    error: null,
    requestId: null,
  },
  loading: false,
  error: null,
  showApiaries: true, // Par défaut, afficher les ruchers
  showApiaryCircles: false, // Par défaut, ne pas afficher les cercles
  highlightedCircles: [], // Aucun cercle surligné par défaut
  onlyMyApiaries: false,
};

/** Build the multipart body of an apiary form, photo included. */
function apiaryFormData(values: ApiaryFormValues): FormData {
  const form = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || key === 'photo') return;
    form.append(key, String(value));
  });
  if (values.photo) {
    form.append('photo', values.photo);
  }
  return form;
}

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

// Thunk async pour récupérer les ruchers
export const fetchApiaries = createAsyncThunk(
  'apiaries/fetchApiaries',
  async ({ accessToken, geolocation, onlyMine }: { 
    accessToken: string; 
    geolocation: GeolocationParams;
    onlyMine?: boolean;
  }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({
        lat: geolocation.lat.toString(),
        lon: geolocation.lon.toString(),
        ...(geolocation.radius && { radius: geolocation.radius.toString() }),
        ...(onlyMine && { mine: 'true' }),
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

/** Page size of the apiary manager */
export const MANAGED_APIARIES_PAGE_SIZE = 50;

/** One page of the apiary manager: owned, shared or (admins) all apiaries. */
export const fetchManagedApiaries = createAsyncThunk(
  'apiaries/fetchManagedApiaries',
  async ({ query, page = 1 }: { query: ManagedApiariesQuery; page?: number }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(MANAGED_APIARIES_PAGE_SIZE) });
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
      });
      const response = await api.get(`/apiaries/managed/?${params}`);
      return { page, ...(response.data as { count: number; next: string | null; results: Apiary[] }) };
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

/** A single apiary, e.g. to centre the map on it wherever it lies. */
export const fetchApiaryDetail = createAsyncThunk(
  'apiaries/fetchApiaryDetail',
  async (id: number, { rejectWithValue }) => {
    try {
      const response = await api.get(`/apiaries/${id}/`);
      return response.data as Apiary;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

// Thunk async pour créer un nouveau rucher (le backend en fait le propriétaire)
export const createApiary = createAsyncThunk(
  'apiaries/createApiary',
  async (values: ApiaryFormValues, { rejectWithValue }) => {
    try {
      const response = await api.post('/apiaries/', apiaryFormData(values), MULTIPART);
      return response.data as Apiary;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

// Thunk async pour mettre à jour un rucher, photo comprise
export const updateApiary = createAsyncThunk(
  'apiaries/updateApiary',
  async ({ id, values }: { id: number; values: ApiaryFormValues }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/apiaries/${id}/`, apiaryFormData(values), MULTIPART);
      return response.data as Apiary;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const deleteApiaryPhoto = createAsyncThunk(
  'apiaries/deleteApiaryPhoto',
  async (id: number, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/apiaries/${id}/photo/`);
      return response.data as Apiary;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

/** Groups the current user may share this apiary with. */
export const fetchApiarySharing = createAsyncThunk(
  'apiaries/fetchApiarySharing',
  async (id: number, { rejectWithValue }) => {
    try {
      const response = await api.get(`/apiaries/${id}/sharing/`);
      return response.data as ApiarySharingInfo;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

/** Share with a group, or change whether it may modify the apiary. */
export const shareApiary = createAsyncThunk(
  'apiaries/shareApiary',
  async ({ id, groupPath, canUpdate }: { id: number; groupPath: string; canUpdate: boolean }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/apiaries/${id}/sharing/`, { group_path: groupPath, can_update: canUpdate });
      return response.data as Apiary;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const unshareApiary = createAsyncThunk(
  'apiaries/unshareApiary',
  async ({ id, groupPath }: { id: number; groupPath: string }, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/apiaries/${id}/sharing/`, { params: { group_path: groupPath } });
      return response.data as Apiary;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

// Thunk async pour supprimer un rucher
export const deleteApiary = createAsyncThunk(
  'apiaries/deleteApiary',
  async (apiaryId: number, { rejectWithValue }) => {
    try {
      await api.delete(`/apiaries/${apiaryId}/`);
      return apiaryId;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
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
    setShowApiaries: (state, action) => {
      state.showApiaries = action.payload as boolean;
    },
    toggleApiaryCircles: (state) => {
      state.showApiaryCircles = !state.showApiaryCircles;
    },
    toggleOnlyMyApiaries: (state) => {
      state.onlyMyApiaries = !state.onlyMyApiaries;
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
    /** Apply a fresh copy of an apiary to the map data and to the manager page. */
    const refresh = (state: ApiariesState, apiary: Apiary) => {
      const index = state.apiaries.findIndex((a) => a.id === apiary.id);
      if (index !== -1) state.apiaries[index] = apiary;
      const row = state.managed.items.findIndex((a) => a.id === apiary.id);
      if (row !== -1) state.managed.items[row] = apiary;
    };

    builder
      .addCase(fetchManagedApiaries.pending, (state, action) => {
        state.managed.loading = true;
        state.managed.error = null;
        state.managed.requestId = action.meta.requestId;
      })
      .addCase(fetchManagedApiaries.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.managed.requestId) return;
        const { page, count, next, results } = action.payload;
        const managed = state.managed;
        managed.loading = false;
        managed.count = count;
        managed.page = page;
        managed.hasMore = Boolean(next);
        managed.items = page === 1
          ? results
          // A row may have shifted to the next page since the previous load
          : [...managed.items, ...results.filter((a) => !managed.items.some((i) => i.id === a.id))];
      })
      .addCase(fetchManagedApiaries.rejected, (state, action) => {
        if (action.meta.requestId !== state.managed.requestId) return;
        state.managed.loading = false;
        state.managed.error = (action.payload as string) ?? action.error.message ?? null;
      })
      // The focused apiary may lie outside the area loaded around the map centre
      .addCase(fetchApiaryDetail.fulfilled, (state, action) => {
        if (state.apiaries.some((a) => a.id === action.payload.id)) refresh(state, action.payload);
        else state.apiaries.push(action.payload);
      })
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
        refresh(state, action.payload);
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
        if (state.managed.items.some((apiary) => apiary.id === apiaryId)) {
          state.managed.items = state.managed.items.filter((apiary) => apiary.id !== apiaryId);
          state.managed.count = Math.max(0, state.managed.count - 1);
        }
      })
      .addCase(deleteApiary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Photo removal and sharing return the updated apiary
      .addMatcher(
        isAnyOf(deleteApiaryPhoto.fulfilled, shareApiary.fulfilled, unshareApiary.fulfilled),
        (state, action) => refresh(state, action.payload)
      );
  },
});

// Sélecteurs
export const selectApiaries = (state: { apiaries: ApiariesState }) => state.apiaries.apiaries;
export const selectApiariesLoading = (state: { apiaries: ApiariesState }) => state.apiaries.loading;
export const selectApiariesError = (state: { apiaries: ApiariesState }) => state.apiaries.error;
export const selectShowApiaries = (state: { apiaries: ApiariesState }) => state.apiaries.showApiaries;
export const selectShowApiaryCircles = (state: { apiaries: ApiariesState }) => state.apiaries.showApiaryCircles;
export const selectHighlightedCircles = (state: { apiaries: ApiariesState }) => state.apiaries.highlightedCircles;
export const selectOnlyMyApiaries = (state: { apiaries: ApiariesState }) => state.apiaries.onlyMyApiaries;
export const selectManagedApiaries = (state: { apiaries: ApiariesState }) => state.apiaries.managed;

/** Latest copy of an apiary: from the map data, or else from the manager page. */
export const selectApiaryById = (state: { apiaries: ApiariesState }, id: number | undefined) =>
  id
    ? state.apiaries.apiaries.find((apiary) => apiary.id === id)
      ?? state.apiaries.managed.items.find((apiary) => apiary.id === id)
      ?? null
    : null;

export const { clearError, clearApiaries, toggleApiaries, setShowApiaries, toggleApiaryCircles, toggleOnlyMyApiaries, toggleCircleHighlight, clearAllHighlights } = apiariesSlice.actions;
export default apiariesSlice.reducer;
