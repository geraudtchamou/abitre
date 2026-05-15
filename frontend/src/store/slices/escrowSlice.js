import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

export const fetchEscrows = createAsyncThunk(
  'escrow/fetchEscrows',
  async ({ status, page = 1, limit = 10 }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (status) params.append('status', status);
      const response = await api.get(`/escrows?${params}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to fetch escrows');
    }
  }
);

export const createEscrow = createAsyncThunk(
  'escrow/createEscrow',
  async (escrowData, { rejectWithValue }) => {
    try {
      const response = await api.post('/escrows', escrowData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to create escrow');
    }
  }
);

export const fundEscrow = createAsyncThunk(
  'escrow/fundEscrow',
  async ({ id, paymentMethod }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/escrows/${id}/fund`, { paymentMethod });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to fund escrow');
    }
  }
);

export const releaseEscrow = createAsyncThunk(
  'escrow/releaseEscrow',
  async ({ id, milestoneId }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/escrows/${id}/release`, { milestoneId });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to release escrow');
    }
  }
);

export const cancelEscrow = createAsyncThunk(
  'escrow/cancelEscrow',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.post(`/escrows/${id}/cancel`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to cancel escrow');
    }
  }
);

export const getEscrowDetails = createAsyncThunk(
  'escrow/getEscrowDetails',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/escrows/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to fetch escrow details');
    }
  }
);

const initialState = {
  escrows: [],
  currentEscrow: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  },
  loading: false,
  error: null,
};

const escrowSlice = createSlice({
  name: 'escrow',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentEscrow: (state, action) => {
      state.currentEscrow = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Escrows
      .addCase(fetchEscrows.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEscrows.fulfilled, (state, action) => {
        state.loading = false;
        state.escrows = action.payload.escrows;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchEscrows.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Create Escrow
      .addCase(createEscrow.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createEscrow.fulfilled, (state, action) => {
        state.loading = false;
        state.escrows.unshift(action.payload);
      })
      .addCase(createEscrow.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fund Escrow
      .addCase(fundEscrow.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fundEscrow.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.escrows.findIndex((e) => e.id === action.payload.id);
        if (index !== -1) {
          state.escrows[index] = action.payload;
        }
        if (state.currentEscrow?.id === action.payload.id) {
          state.currentEscrow = action.payload;
        }
      })
      .addCase(fundEscrow.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Release Escrow
      .addCase(releaseEscrow.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(releaseEscrow.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.escrows.findIndex((e) => e.id === action.payload.id);
        if (index !== -1) {
          state.escrows[index] = action.payload;
        }
        if (state.currentEscrow?.id === action.payload.id) {
          state.currentEscrow = action.payload;
        }
      })
      .addCase(releaseEscrow.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Cancel Escrow
      .addCase(cancelEscrow.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelEscrow.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.escrows.findIndex((e) => e.id === action.payload.id);
        if (index !== -1) {
          state.escrows[index] = action.payload;
        }
        if (state.currentEscrow?.id === action.payload.id) {
          state.currentEscrow = action.payload;
        }
      })
      .addCase(cancelEscrow.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get Escrow Details
      .addCase(getEscrowDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getEscrowDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.currentEscrow = action.payload;
      })
      .addCase(getEscrowDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, setCurrentEscrow } = escrowSlice.actions;
export default escrowSlice.reducer;
