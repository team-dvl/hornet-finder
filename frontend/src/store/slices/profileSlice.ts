import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../utils/api';
import { getAxiosErrorMessage } from '../../utils/axiosTypes';
import { resizeImage } from '../../utils/imageResize';
import type { RootState } from '../index';

/**
 * Profile photo of the signed-in user.
 *
 * The photo normally comes from the `picture` claim of the token (uploaded
 * here, or imported from Google/Facebook). A change made in the app only
 * reaches the token at the next sign-in, so it is kept here meanwhile:
 * `undefined` means "no change, use the claim", `null` "removed".
 */
interface ProfileState {
  avatarOverride: string | null | undefined;
  saving: boolean;
  error: string | null;
}

const initialState: ProfileState = {
  avatarOverride: undefined,
  saving: false,
  error: null,
};

/** Side the photo is downscaled to before upload; the backend crops it to 256 px. */
const UPLOAD_SIDE = 800;

/**
 * Effective photo, read once at sign-in. The backend also brings Keycloak up
 * to date, e.g. with the photo of a Google/Facebook account linked since.
 */
export const fetchAvatar = createAsyncThunk(
  'profile/fetchAvatar',
  async (_: void, { rejectWithValue }) => {
    try {
      const response = await api.get('/me/avatar/');
      return response.data.url as string | null;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const uploadAvatar = createAsyncThunk(
  'profile/uploadAvatar',
  async (file: File, { rejectWithValue }) => {
    try {
      const form = new FormData();
      form.append('photo', await resizeImage(file, UPLOAD_SIDE));
      const response = await api.post('/me/avatar/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.url as string | null;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

export const deleteAvatar = createAsyncThunk(
  'profile/deleteAvatar',
  async (_: void, { rejectWithValue }) => {
    try {
      await api.delete('/me/avatar/');
      return null;
    } catch (error: unknown) {
      return rejectWithValue(getAxiosErrorMessage(error));
    }
  }
);

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    clearProfileError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // A failed read is silent: the token's `picture` claim stays in use
    builder.addCase(fetchAvatar.fulfilled, (state, action) => {
      state.avatarOverride = action.payload;
    });
    for (const thunk of [uploadAvatar, deleteAvatar]) {
      builder
        .addCase(thunk.pending, (state) => {
          state.saving = true;
          state.error = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.saving = false;
          state.avatarOverride = action.payload;
        })
        .addCase(thunk.rejected, (state, action) => {
          state.saving = false;
          state.error = (action.payload as string) || 'Erreur lors de la mise à jour de la photo';
        });
    }
  },
});

export const { clearProfileError } = profileSlice.actions;

export const selectAvatarOverride = (state: RootState) => state.profile.avatarOverride;
export const selectProfileSaving = (state: RootState) => state.profile.saving;
export const selectProfileError = (state: RootState) => state.profile.error;

export default profileSlice.reducer;
