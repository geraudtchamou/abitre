import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = '/api/v1/wallets';

export const getWallet = createAsyncThunk('wallet/get', async (_, { getState }) => {
  const token = getState().auth.token;
  const { data } = await axios.get(API_URL, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data.data;
});

const initialState = {
  wallet: null,
  loading: false,
  error: null
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getWallet.pending, (state) => { state.loading = true; })
      .addCase(getWallet.fulfilled, (state, action) => {
        state.loading = false;
        state.wallet = action.payload;
      })
      .addCase(getWallet.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export default walletSlice.reducer;
