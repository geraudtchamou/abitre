import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import escrowReducer from './slices/escrowSlice';
import walletReducer from './slices/walletSlice';
import chatReducer from './slices/chatSlice';
import notificationReducer from './slices/notificationSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    escrow: escrowReducer,
    wallet: walletReducer,
    chat: chatReducer,
    notifications: notificationReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['chat/setSocket'],
        ignoredPaths: ['chat.socket']
      }
    })
});

export default store;
