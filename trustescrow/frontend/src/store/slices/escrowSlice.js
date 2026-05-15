import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = '/api/v1/escrows';

export const getEscrows = createAsyncThunk('escrow/getAll', async (_, { getState }) => {
  const token = getState().auth.token;
  const { data } = await axios.get(API_URL, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data.data;
});

const initialState = {
  escrows: [],
  loading: false,
  error: null
};

const escrowSlice = createSlice({
  name: 'escrow',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getEscrows.pending, (state) => { state.loading = true; })
      .addCase(getEscrows.fulfilled, (state, action) => {
        state.loading = false;
        state.escrows = action.payload;
      })
      .addCase(getEscrows.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export default escrowSlice.reducer;
