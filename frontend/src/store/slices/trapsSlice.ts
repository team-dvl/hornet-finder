import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';
import { getAxiosErrorMessage } from '../../utils/axiosTypes';
import type { GeolocationParams } from './nestsSlice';

// --- Types -----------------------------------------------------------------

export interface UserSummary {
  guid: string;
  display_name: string;
}

export interface GroupSummary {
  path: string;
  name: string;
}

export interface TrapType {
  id: number;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  photo_url: string | null;
  photo_thumbnail_url: string | null;
  /** Number of traps using this type; only returned to admins listing the referential */
  trap_count?: number;
}

export interface Species {
  id: number;
  slug: string;
  name: string;
  scientific_name: string;
  wikipedia_url: string;
  sort_order: number;
}

export type TrapEventKind =
  | 'installation'
  | 'inspection'
  | 'cleaning'
  | 'refill'
  | 'repair'
  | 'removal'
  | 'catch';

export interface TrapPhoto {
  id: number;
  url: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

export interface TrapEvent {
  id: number;
  trap: number;
  kind: TrapEventKind;
  performed_at: string;
  performed_by: UserSummary | null;
  species: { slug: string; name: string; wikipedia_url: string } | null;
  quantity: number | null;
  comments: string;
  photos: TrapPhoto[];
  created_at: string;
}

export interface Trap {
  id: number;
  latitude: number;
  longitude: number;
  active: boolean;
  installed_at: string;
  hornet_catch_count: number;
  photo_url: string | null;
  photo_thumbnail_url: string | null;
  trap_type: { id?: number; slug: string; name: string; photo_thumbnail_url?: string | null };
  // Absent from the public (anonymous) representation
  address?: string;
  visibility?: 'public' | 'group';
  comments?: string;
  owner?: UserSummary | null;
  group?: GroupSummary | null;
  last_event_at?: string | null;
  /** Short code of the trap's QR tag, if it has one */
  tag_short?: string | null;
  created_at?: string;
  updated_at?: string;
  events?: TrapEvent[];
}

export interface DelegationInfo {
  group: GroupSummary | null;
  can_set_delegation: boolean;
  /** null means "any group" (platform admin) */
  allowed_groups: GroupSummary[] | null;
}

/** Payload shared by the create and update forms. */
export interface TrapFormValues {
  latitude: number;
  longitude: number;
  trap_type_slug: string;
  installed_at: string;
  address?: string;
  comments?: string;
  active?: boolean;
  photo?: File | null;
}

interface TrapsState {
  traps: Trap[];
  selectedTrap: Trap | null;
  trapTypes: TrapType[];
  species: Species[];
  showTraps: boolean;
  showInactiveTraps: boolean;
  onlyMyTraps: boolean;
  /** Id of the trap currently being dragged to a new position, if any */
  movingTrapId: number | null;
  loading: boolean;
  error: string | null;
}

const initialState: TrapsState = {
  traps: [],
  selectedTrap: null,
  trapTypes: [],
  species: [],
  showTraps: false,
  showInactiveTraps: true,
  onlyMyTraps: false,
  movingTrapId: null,
  loading: false,
  error: null,
};

// --- Helpers ---------------------------------------------------------------

/** Build the multipart body of a trap form, photo included. */
function trapFormData(values: Partial<TrapFormValues>): FormData {
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

// --- Thunks ----------------------------------------------------------------

/** Traps around a position. Works without a token: public traps only. */
export const fetchTraps = createAsyncThunk(
  'traps/fetchTraps',
  async ({ geolocation, onlyMine, showInactive }: {
    geolocation: GeolocationParams;
    onlyMine?: boolean;
    showInactive?: boolean;
  }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({
        lat: geolocation.lat.toString(),
        lon: geolocation.lon.toString(),
        ...(geolocation.radius && { radius: geolocation.radius.toString() }),
        ...(showInactive === false && { active: 'true' }),
        ...(onlyMine && { mine: 'true' }),
      });
      const response = await api.get(`/traps/?${params}`);
      return response.data as Trap[];
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

/** A single trap with its journal. */
export const fetchTrapDetail = createAsyncThunk(
  'traps/fetchTrapDetail',
  async (trapId: number, { rejectWithValue }) => {
    try {
      const response = await api.get(`/traps/${trapId}/`);
      return response.data as Trap;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const createTrap = createAsyncThunk(
  'traps/createTrap',
  async (values: TrapFormValues, { rejectWithValue }) => {
    try {
      const response = await api.post('/traps/', trapFormData(values), MULTIPART);
      return response.data as Trap;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const updateTrap = createAsyncThunk(
  'traps/updateTrap',
  async ({ trapId, values }: { trapId: number; values: Partial<TrapFormValues> }, { rejectWithValue }) => {
    try {
      const { photo, ...fields } = values;
      const response = await api.patch(`/traps/${trapId}/`, fields);
      if (photo) {
        const form = new FormData();
        form.append('photo', photo);
        const withPhoto = await api.post(`/traps/${trapId}/photo/`, form, MULTIPART);
        return withPhoto.data as Trap;
      }
      return response.data as Trap;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const deleteTrap = createAsyncThunk(
  'traps/deleteTrap',
  async (trapId: number, { rejectWithValue }) => {
    try {
      await api.delete(`/traps/${trapId}/`);
      return trapId;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

/** Record a journal entry (catch or maintenance), with its optional photos. */
export const addTrapEvent = createAsyncThunk(
  'traps/addTrapEvent',
  async ({ trapId, kind, performed_at, species_slug, quantity, comments, photos }: {
    trapId: number;
    kind: TrapEventKind;
    performed_at: string;
    species_slug?: string;
    quantity?: number;
    comments?: string;
    photos?: File[];
  }, { rejectWithValue, dispatch }) => {
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('performed_at', performed_at);
      if (kind === 'catch') {
        if (species_slug) form.append('species_slug', species_slug);
        if (quantity !== undefined) form.append('quantity', String(quantity));
      }
      if (comments) form.append('comments', comments);
      (photos ?? []).forEach((photo) => form.append('photos', photo));

      const response = await api.post(`/traps/${trapId}/events/`, form, MULTIPART);
      // The event may have changed the status or the counter of the trap
      dispatch(fetchTrapDetail(trapId));
      return response.data as TrapEvent;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const deleteTrapEvent = createAsyncThunk(
  'traps/deleteTrapEvent',
  async ({ trapId, eventId }: { trapId: number; eventId: number }, { rejectWithValue, dispatch }) => {
    try {
      await api.delete(`/trap-events/${eventId}/`);
      dispatch(fetchTrapDetail(trapId));
      return eventId;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

/** Groups the current user may delegate this trap to, plus the current one. */
export const fetchTrapDelegation = createAsyncThunk(
  'traps/fetchTrapDelegation',
  async (trapId: number, { rejectWithValue }) => {
    try {
      const response = await api.get(`/traps/${trapId}/delegation/`);
      return response.data as DelegationInfo;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const setTrapDelegation = createAsyncThunk(
  'traps/setTrapDelegation',
  async ({ trapId, groupPath, visibility }: {
    trapId: number;
    groupPath: string;
    visibility?: 'public' | 'group';
  }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/traps/${trapId}/delegation/`, {
        group_path: groupPath,
        ...(visibility && { visibility }),
      });
      return response.data as Trap;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const clearTrapDelegation = createAsyncThunk(
  'traps/clearTrapDelegation',
  async (trapId: number, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/traps/${trapId}/delegation/`);
      return response.data as Trap;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

/** Hand a bequeathed trap over to another owner (platform admins only). */
export const setTrapOwner = createAsyncThunk(
  'traps/setTrapOwner',
  async ({ trapId, ownerGuid }: { trapId: number; ownerGuid: string }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/traps/${trapId}/owner/`, { owner_guid: ownerGuid });
      return response.data as Trap;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const fetchTrapTypes = createAsyncThunk(
  'traps/fetchTrapTypes',
  async (_: void, { rejectWithValue }) => {
    try {
      const response = await api.get('/trap-types/');
      return response.data as TrapType[];
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const fetchSpecies = createAsyncThunk(
  'traps/fetchSpecies',
  async (_: void, { rejectWithValue }) => {
    try {
      const response = await api.get('/species/');
      return response.data as Species[];
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

// --- Referential administration (admin only) -------------------------------

export interface TrapTypeFormValues {
  name: string;
  description?: string;
  sort_order?: number;
  photo?: File | null;
}

function trapTypeFormData(values: TrapTypeFormValues): FormData {
  const form = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || key === 'photo') return;
    form.append(key, String(value));
  });
  if (values.photo) form.append('photo', values.photo);
  return form;
}

export const createTrapType = createAsyncThunk(
  'traps/createTrapType',
  async (values: TrapTypeFormValues, { rejectWithValue }) => {
    try {
      const response = await api.post('/trap-types/', trapTypeFormData(values), MULTIPART);
      return response.data as TrapType;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const updateTrapType = createAsyncThunk(
  'traps/updateTrapType',
  async ({ id, values }: { id: number; values: TrapTypeFormValues }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/trap-types/${id}/`, trapTypeFormData(values), MULTIPART);
      return response.data as TrapType;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const deleteTrapType = createAsyncThunk(
  'traps/deleteTrapType',
  async (id: number, { rejectWithValue }) => {
    try {
      await api.delete(`/trap-types/${id}/`);
      return id;
    } catch (error: unknown) {
      // A type still in use comes back as a 409 carrying the trap count
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

// --- Slice -----------------------------------------------------------------

const trapsSlice = createSlice({
  name: 'traps',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearTraps: (state) => {
      state.traps = [];
    },
    toggleTraps: (state) => {
      state.showTraps = !state.showTraps;
    },
    toggleInactiveTraps: (state) => {
      state.showInactiveTraps = !state.showInactiveTraps;
    },
    toggleOnlyMyTraps: (state) => {
      state.onlyMyTraps = !state.onlyMyTraps;
    },
    setShowTraps: (state, action) => {
      state.showTraps = action.payload as boolean;
    },
    setSelectedTrap: (state, action) => {
      state.selectedTrap = action.payload as Trap | null;
    },
    startMovingTrap: (state, action) => {
      state.movingTrapId = action.payload as number;
    },
    stopMovingTrap: (state) => {
      state.movingTrapId = null;
    },
  },
  extraReducers: (builder) => {
    const upsert = (state: TrapsState, trap: Trap) => {
      const index = state.traps.findIndex((t) => t.id === trap.id);
      if (index >= 0) {
        // Keep the journal already loaded when the update did not carry one
        state.traps[index] = { ...state.traps[index], ...trap };
      } else {
        state.traps.push(trap);
      }
      if (state.selectedTrap?.id === trap.id) {
        state.selectedTrap = { ...state.selectedTrap, ...trap };
      }
    };

    builder
      .addCase(fetchTraps.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTraps.fulfilled, (state, action) => {
        state.loading = false;
        state.traps = action.payload;
      })
      .addCase(fetchTraps.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchTrapDetail.fulfilled, (state, action) => {
        state.selectedTrap = action.payload;
        upsert(state, action.payload);
      })
      .addCase(createTrap.fulfilled, (state, action) => {
        state.loading = false;
        state.traps.push(action.payload);
      })
      .addCase(createTrap.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(deleteTrap.fulfilled, (state, action) => {
        state.traps = state.traps.filter((trap) => trap.id !== action.payload);
        if (state.selectedTrap?.id === action.payload) state.selectedTrap = null;
      })
      .addCase(fetchTrapTypes.fulfilled, (state, action) => {
        state.trapTypes = action.payload;
      })
      .addCase(fetchSpecies.fulfilled, (state, action) => {
        state.species = action.payload;
      })
      .addCase(createTrapType.fulfilled, (state, action) => {
        state.trapTypes.push(action.payload);
      })
      .addCase(updateTrapType.fulfilled, (state, action) => {
        const index = state.trapTypes.findIndex((t) => t.id === action.payload.id);
        if (index >= 0) state.trapTypes[index] = action.payload;
      })
      .addCase(deleteTrapType.fulfilled, (state, action) => {
        state.trapTypes = state.trapTypes.filter((t) => t.id !== action.payload);
      })
      // Every trap-returning thunk refreshes the cached copies the same way
      .addMatcher(
        (action): action is { type: string; payload: Trap } =>
          [updateTrap.fulfilled.type, setTrapDelegation.fulfilled.type,
           clearTrapDelegation.fulfilled.type, setTrapOwner.fulfilled.type]
            .includes(action.type),
        (state, action) => {
          state.loading = false;
          upsert(state, action.payload);
        }
      )
      .addMatcher(
        (action): action is { type: string; payload: string } =>
          action.type.startsWith('traps/') && action.type.endsWith('/rejected'),
        (state, action) => {
          state.loading = false;
          state.error = (action.payload as string) ?? null;
        }
      );
  },
});

// --- Selectors -------------------------------------------------------------

export const selectTraps = (state: { traps: TrapsState }) => state.traps.traps;
export const selectSelectedTrap = (state: { traps: TrapsState }) => state.traps.selectedTrap;
export const selectTrapTypes = (state: { traps: TrapsState }) => state.traps.trapTypes;
export const selectSpecies = (state: { traps: TrapsState }) => state.traps.species;
export const selectShowTraps = (state: { traps: TrapsState }) => state.traps.showTraps;
export const selectShowInactiveTraps = (state: { traps: TrapsState }) => state.traps.showInactiveTraps;
export const selectOnlyMyTraps = (state: { traps: TrapsState }) => state.traps.onlyMyTraps;
export const selectMovingTrapId = (state: { traps: TrapsState }) => state.traps.movingTrapId;
export const selectTrapsLoading = (state: { traps: TrapsState }) => state.traps.loading;
export const selectTrapsError = (state: { traps: TrapsState }) => state.traps.error;

export const {
  clearError: clearTrapsError,
  clearTraps,
  toggleTraps,
  toggleInactiveTraps,
  toggleOnlyMyTraps,
  setShowTraps,
  setSelectedTrap,
  startMovingTrap,
  stopMovingTrap,
} = trapsSlice.actions;

export default trapsSlice.reducer;
