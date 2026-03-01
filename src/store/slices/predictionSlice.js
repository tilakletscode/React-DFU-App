import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { mlAPI, authAPI } from '../../services/api';

// Async thunks for predictions
export const classifyImage = createAsyncThunk(
  'prediction/classifyImage',
  async (imageData, { rejectWithValue }) => {
    try {
      const response = await mlAPI.classifyImage(imageData);
      return response; // Return the full response, not response.result
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Classification failed');
    }
  }
);

export const savePrediction = createAsyncThunk(
  'prediction/savePrediction',
  async (predictionData, { rejectWithValue }) => {
    try {
      const response = await authAPI.savePrediction(predictionData);
      return response.prediction;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to save prediction');
    }
  }
);

export const fetchPredictionHistory = createAsyncThunk(
  'prediction/fetchHistory',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authAPI.getPredictionHistory();
      return response.predictions;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch history');
    }
  }
);

export const deletePrediction = createAsyncThunk(
  'prediction/deletePrediction',
  async (predictionId, { rejectWithValue }) => {
    try {
      await authAPI.deletePrediction(predictionId);
      return predictionId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to delete prediction');
    }
  }
);

const initialState = {
  currentPrediction: null,
  history: [],
  loading: false,
  saving: false,
  error: null,
  classifying: false
};

const predictionSlice = createSlice({
  name: 'prediction',
  initialState,
  reducers: {
    clearCurrentPrediction: (state) => {
      state.currentPrediction = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    setCurrentPrediction: (state, action) => {
      state.currentPrediction = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Classify image
      .addCase(classifyImage.pending, (state) => {
        state.classifying = true;
        state.error = null;
      })
      .addCase(classifyImage.fulfilled, (state, action) => {
        state.classifying = false;
        state.currentPrediction = action.payload;
        state.error = null;
      })
      .addCase(classifyImage.rejected, (state, action) => {
        state.classifying = false;
        state.error = action.payload;
      })
      
      // Save prediction
      .addCase(savePrediction.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(savePrediction.fulfilled, (state, action) => {
        state.saving = false;
        state.history.unshift(action.payload); // Add to beginning of history
        state.error = null;
      })
      .addCase(savePrediction.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      
      // Fetch history
      .addCase(fetchPredictionHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPredictionHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.history = action.payload;
        state.error = null;
      })
      .addCase(fetchPredictionHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Delete prediction
      .addCase(deletePrediction.fulfilled, (state, action) => {
        state.history = state.history.filter(pred => pred._id !== action.payload);
      });
  }
});

export const { clearCurrentPrediction, clearError, setCurrentPrediction } = predictionSlice.actions;
export default predictionSlice.reducer;