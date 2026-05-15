import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import dashboardReducer from './slices/dashboardSlice';
import escrowReducer from './slices/escrowSlice';
import walletReducer from './slices/walletSlice';
import disputeReducer from './slices/disputeSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer,
    escrow: escrowReducer,
    wallet: walletReducer,
    dispute: disputeReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
        ignoredPaths: ['auth.user'],
      },
    }),
});

export default store;
