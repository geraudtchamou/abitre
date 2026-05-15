import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

export const fetchWalletBalance = createAsyncThunk(
  'wallet/fetchBalance',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/wallet/balance');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to fetch wallet balance');
    }
  }
);

export const fetchTransactions = createAsyncThunk(
  'wallet/fetchTransactions',
  async ({ page = 1, limit = 20, type }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (type) params.append('type', type);
      const response = await api.get(`/wallet/transactions?${params}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to fetch transactions');
    }
  }
);

export const depositFunds = createAsyncThunk(
  'wallet/depositFunds',
  async ({ amount, currency, paymentMethod }, { rejectWithValue }) => {
    try {
      const response = await api.post('/wallet/deposit', { amount, currency, paymentMethod });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to deposit funds');
    }
  }
);

export const withdrawFunds = createAsyncThunk(
  'wallet/withdrawFunds',
  async ({ amount, currency, withdrawalMethod, accountDetails }, { rejectWithValue }) => {
    try {
      const response = await api.post('/wallet/withdraw', { amount, currency, withdrawalMethod, accountDetails });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to withdraw funds');
    }
  }
);

export const transferFunds = createAsyncThunk(
  'wallet/transferFunds',
  async ({ recipientEmail, amount, currency, note }, { rejectWithValue }) => {
    try {
      const response = await api.post('/wallet/transfer', { recipientEmail, amount, currency, note });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to transfer funds');
    }
  }
);

const initialState = {
  balance: {
    total: 0,
    available: 0,
    locked: 0,
    currency: 'USD',
  },
  transactions: [],
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  },
  loading: false,
  error: null,
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Balance
      .addCase(fetchWalletBalance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWalletBalance.fulfilled, (state, action) => {
        state.loading = false;
        state.balance = action.payload;
      })
      .addCase(fetchWalletBalance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch Transactions
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = action.payload.transactions;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Deposit Funds
      .addCase(depositFunds.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(depositFunds.fulfilled, (state, action) => {
        state.loading = false;
        state.balance = action.payload.balance;
        state.transactions.unshift(action.payload.transaction);
      })
      .addCase(depositFunds.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Withdraw Funds
      .addCase(withdrawFunds.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(withdrawFunds.fulfilled, (state, action) => {
        state.loading = false;
        state.balance = action.payload.balance;
        state.transactions.unshift(action.payload.transaction);
      })
      .addCase(withdrawFunds.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Transfer Funds
      .addCase(transferFunds.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(transferFunds.fulfilled, (state, action) => {
        state.loading = false;
        state.balance = action.payload.balance;
        state.transactions.unshift(action.payload.transaction);
      })
      .addCase(transferFunds.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError } = walletSlice.actions;
export default walletSlice.reducer;
