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
  photo_url: string | null;
  photo_thumbnail_url: string | null;
  /** Author and licence of the photo (Wikimedia Commons pictures must be credited) */
  photo_credit: string;
  photo_source_url: string;
  /** Number of journal entries naming this species */
  event_count?: number;
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
  species: {
    slug: string;
    name: string;
    wikipedia_url: string;
    photo_thumbnail_url: string | null;
  } | null;
  quantity: number | null;
  /** Shared by the catch events recorded together during one visit */
  batch: string | null;
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

/** Whose traps the manager lists */
export type TrapScope = 'mine' | 'delegated' | 'all';

/** Sort keys of the manager; a leading `-` sorts in descending order */
export type TrapOrdering =
  | 'last_event_at' | '-last_event_at'
  | 'hornet_catch_count' | '-hornet_catch_count'
  | 'installed_at' | '-installed_at'
  | 'address' | 'id' | '-id'
  | 'distance';

/** Query of the trap manager (`GET /traps/managed/`) */
export interface ManagedTrapsQuery {
  scope: TrapScope;
  active: 'true' | 'false' | 'all';
  ordering: TrapOrdering;
  q?: string;
  group?: string;
  trap_type?: string;
  has_tag?: 'true' | 'false';
  /** Needed by the `distance` ordering */
  lat?: number;
  lon?: number;
}

interface ManagedTrapsState {
  items: Trap[];
  count: number;
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  /** Request whose answer is awaited: an older one is ignored when it lands */
  requestId: string | null;
}

interface TrapsState {
  traps: Trap[];
  managed: ManagedTrapsState;
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
  managed: {
    items: [],
    count: 0,
    page: 0,
    hasMore: false,
    loading: false,
    error: null,
    requestId: null,
  },
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

/** Page size of the trap manager */
export const MANAGED_PAGE_SIZE = 50;

/** One page of the trap manager: owned, delegated or (admins) all traps. */
export const fetchManagedTraps = createAsyncThunk(
  'traps/fetchManagedTraps',
  async ({ query, page = 1 }: { query: ManagedTrapsQuery; page?: number }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(MANAGED_PAGE_SIZE) });
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
      });
      const response = await api.get(`/traps/managed/?${params}`);
      return { page, ...(response.data as { count: number; next: string | null; results: Trap[] }) };
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

/** One species found during a visit, with its optional photo. */
export interface CatchItem {
  species_slug: string;
  quantity: number;
  photo?: File | null;
}

/** Record one visit's catches: one journal entry per species, sharing a batch. */
export const addTrapCatch = createAsyncThunk(
  'traps/addTrapCatch',
  async ({ trapId, performed_at, comments, items }: {
    trapId: number;
    performed_at: string;
    comments?: string;
    items: CatchItem[];
  }, { rejectWithValue, dispatch }) => {
    try {
      const form = new FormData();
      form.append('performed_at', performed_at);
      if (comments) form.append('comments', comments);
      form.append('items', JSON.stringify(
        items.map(({ species_slug, quantity }) => ({ species_slug, quantity })),
      ));
      // A photo is matched to its item by position
      items.forEach((item, index) => {
        if (item.photo) form.append(`photo_${index}`, item.photo);
      });

      const response = await api.post(`/traps/${trapId}/catches/`, form, MULTIPART);
      dispatch(fetchTrapDetail(trapId));
      return response.data as TrapEvent[];
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

/** Remove every catch event of a visit. */
export const deleteTrapCatch = createAsyncThunk(
  'traps/deleteTrapCatch',
  async ({ trapId, batch }: { trapId: number; batch: string }, { rejectWithValue, dispatch }) => {
    try {
      await api.delete(`/traps/${trapId}/catches/${batch}/`);
      dispatch(fetchTrapDetail(trapId));
      return batch;
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

export interface SpeciesFormValues {
  name: string;
  scientific_name?: string;
  wikipedia_url?: string;
  sort_order?: number;
  photo?: File | null;
}

/** Multipart body of a referential form: plain fields plus an optional photo. */
function referentialFormData(values: TrapTypeFormValues | SpeciesFormValues): FormData {
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
      const response = await api.post('/trap-types/', referentialFormData(values), MULTIPART);
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
      const response = await api.patch(`/trap-types/${id}/`, referentialFormData(values), MULTIPART);
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

export const createSpecies = createAsyncThunk(
  'traps/createSpecies',
  async (values: SpeciesFormValues, { rejectWithValue }) => {
    try {
      const response = await api.post('/species/', referentialFormData(values), MULTIPART);
      return response.data as Species;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const updateSpecies = createAsyncThunk(
  'traps/updateSpecies',
  async ({ id, values }: { id: number; values: SpeciesFormValues }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/species/${id}/`, referentialFormData(values), MULTIPART);
      return response.data as Species;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const deleteSpecies = createAsyncThunk(
  'traps/deleteSpecies',
  async (id: number, { rejectWithValue }) => {
    try {
      await api.delete(`/species/${id}/`);
      return id;
    } catch (error: unknown) {
      // A species still named by the journal comes back as a 409
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
      // The manager keeps its own page; refresh the row without its journal
      const row = state.managed.items.findIndex((t) => t.id === trap.id);
      if (row >= 0) {
        const summary: Trap = { ...trap };
        delete summary.events;
        state.managed.items[row] = { ...state.managed.items[row], ...summary };
      }
    };

    builder
      .addCase(fetchManagedTraps.pending, (state, action) => {
        state.managed.loading = true;
        state.managed.error = null;
        state.managed.requestId = action.meta.requestId;
      })
      .addCase(fetchManagedTraps.fulfilled, (state, action) => {
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
          : [...managed.items, ...results.filter((t) => !managed.items.some((i) => i.id === t.id))];
      })
      .addCase(fetchManagedTraps.rejected, (state, action) => {
        if (action.meta.requestId !== state.managed.requestId) return;
        state.managed.loading = false;
        state.managed.error = (action.payload as string) ?? action.error.message ?? null;
      })
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
        if (state.managed.items.some((trap) => trap.id === action.payload)) {
          state.managed.items = state.managed.items.filter((trap) => trap.id !== action.payload);
          state.managed.count = Math.max(0, state.managed.count - 1);
        }
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
      .addCase(createSpecies.fulfilled, (state, action) => {
        state.species.push(action.payload);
      })
      .addCase(updateSpecies.fulfilled, (state, action) => {
        const index = state.species.findIndex((s) => s.id === action.payload.id);
        if (index >= 0) state.species[index] = action.payload;
      })
      .addCase(deleteSpecies.fulfilled, (state, action) => {
        state.species = state.species.filter((s) => s.id !== action.payload);
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
export const selectManagedTraps = (state: { traps: TrapsState }) => state.traps.managed;
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
