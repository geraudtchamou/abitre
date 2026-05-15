import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const getNotifications = createAsyncThunk('notifications/get', async ({ unreadOnly = false }, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/notifications?unreadOnly=${unreadOnly}`);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.error);
  }
});

export const markAsRead = createAsyncThunk('notifications/read', async (id, { rejectWithValue }) => {
  try {
    await api.patch(`/notifications/${id}/read`);
    return id;
  } catch (error) {
    return rejectWithValue(error.response?.data?.error);
  }
});

export const markAllAsRead = createAsyncThunk('notifications/readAll', async (_, { rejectWithValue }) => {
  try {
    await api.patch('/notifications/read-all');
    return true;
  } catch (error) {
    return rejectWithValue(error.response?.data?.error);
  }
});

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    list: [],
    unreadCount: 0,
    loading: false,
    error: null,
  },
  reducers: {
    addNotification: (state, action) => {
      state.list.unshift(action.payload);
      state.unreadCount += 1;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getNotifications.fulfilled, (state, action) => {
        state.list = action.payload;
        state.unreadCount = action.payload.filter(n => !n.read).length;
      })
      .addCase(markAsRead.fulfilled, (state, action) => {
        const notification = state.list.find(n => n.id === action.payload);
        if (notification) notification.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      })
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.list.forEach(n => n.read = true);
        state.unreadCount = 0;
      });
  },
});

export const { addNotification, clearError } = notificationSlice.actions;
export default notificationSlice.reducer;
