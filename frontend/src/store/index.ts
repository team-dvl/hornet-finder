import { configureStore } from '@reduxjs/toolkit';
import hornetsReducer from './slices/hornetsSlice.js';
import apiariesReducer from './slices/apiariesSlice.js';
import nestsReducer from './slices/nestsSlice.js';
import trapsReducer from './slices/trapsSlice.js';
import mapReducer from './slices/mapSlice.js';
import profileReducer from './slices/profileSlice.js';

export const store = configureStore({
  reducer: {
    hornets: hornetsReducer,
    apiaries: apiariesReducer,
    nests: nestsReducer,
    traps: trapsReducer,
    map: mapReducer,
    profile: profileReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
