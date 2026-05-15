import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

export const fetchDisputes = createAsyncThunk(
  'dispute/fetchDisputes',
  async ({ status, page = 1, limit = 10 }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (status) params.append('status', status);
      const response = await api.get(`/disputes?${params}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to fetch disputes');
    }
  }
);

export const createDispute = createAsyncThunk(
  'dispute/createDispute',
  async ({ escrowId, reason, description, attachments }, { rejectWithValue }) => {
    try {
      const response = await api.post('/disputes', { escrowId, reason, description, attachments });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to create dispute');
    }
  }
);

export const submitEvidence = createAsyncThunk(
  'dispute/submitEvidence',
  async ({ disputeId, description, attachments }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/disputes/${disputeId}/evidence`, { description, attachments });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to submit evidence');
    }
  }
);

export const getDisputeDetails = createAsyncThunk(
  'dispute/getDisputeDetails',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/disputes/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to fetch dispute details');
    }
  }
);

export const resolveDispute = createAsyncThunk(
  'dispute/resolveDispute',
  async ({ id, resolution, fundSplit }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/disputes/${id}/resolve`, { resolution, fundSplit });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to resolve dispute');
    }
  }
);

const initialState = {
  disputes: [],
  currentDispute: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  },
  loading: false,
  error: null,
};

const disputeSlice = createSlice({
  name: 'dispute',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentDispute: (state, action) => {
      state.currentDispute = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Disputes
      .addCase(fetchDisputes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDisputes.fulfilled, (state, action) => {
        state.loading = false;
        state.disputes = action.payload.disputes;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchDisputes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Create Dispute
      .addCase(createDispute.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createDispute.fulfilled, (state, action) => {
        state.loading = false;
        state.disputes.unshift(action.payload);
      })
      .addCase(createDispute.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Submit Evidence
      .addCase(submitEvidence.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(submitEvidence.fulfilled, (state, action) => {
        state.loading = false;
        if (state.currentDispute?.id === action.payload.disputeId) {
          state.currentDispute = action.payload;
        }
      })
      .addCase(submitEvidence.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get Dispute Details
      .addCase(getDisputeDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getDisputeDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.currentDispute = action.payload;
      })
      .addCase(getDisputeDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Resolve Dispute
      .addCase(resolveDispute.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resolveDispute.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.disputes.findIndex((d) => d.id === action.payload.id);
        if (index !== -1) {
          state.disputes[index] = action.payload;
        }
        if (state.currentDispute?.id === action.payload.id) {
          state.currentDispute = action.payload;
        }
      })
      .addCase(resolveDispute.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, setCurrentDispute } = disputeSlice.actions;
export default disputeSlice.reducer;
