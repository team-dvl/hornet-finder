import { configureStore } from '@reduxjs/toolkit';
import hornetsReducer from './slices/hornetsSlice.js';
import apiariesReducer from './slices/apiariesSlice.js';
import nestsReducer from './slices/nestsSlice.js';

export const store = configureStore({
  reducer: {
    hornets: hornetsReducer,
    apiaries: apiariesReducer,
    nests: nestsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
