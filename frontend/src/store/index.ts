import { configureStore } from '@reduxjs/toolkit';
import hornetsReducer from './slices/hornetsSlice.js';

export const store = configureStore({
  reducer: {
    hornets: hornetsReducer,
    // Ici on peut ajouter d'autres slices plus tard
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
