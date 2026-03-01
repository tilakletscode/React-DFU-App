import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../../services/api';

// Temporary: Skip Firebase for now to fix the runtime error
const SKIP_FIREBASE = true;
// import pushNotificationService from '../../services/pushNotificationService';

// Async thunks for authentication
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authAPI.login(credentials);
      
      // Store token securely
      await SecureStore.setItemAsync('userToken', response.token);
      await AsyncStorage.setItem('userData', JSON.stringify(response.user));
      
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Login failed');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authAPI.register(userData);
      
      // Store token securely
      await SecureStore.setItemAsync('userToken', response.token);
      await AsyncStorage.setItem('userData', JSON.stringify(response.user));
      
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Registration failed');
    }
  }
);

export const loadUserFromStorage = createAsyncThunk(
  'auth/loadUserFromStorage',
  async (_, { rejectWithValue }) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const userData = await AsyncStorage.getItem('userData');
      
      if (token && userData) {
        return {
          token,
          user: JSON.parse(userData)
        };
      } else {
        throw new Error('No stored credentials found');
      }
    } catch (error) {
      return rejectWithValue('Failed to load user data');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      await SecureStore.deleteItemAsync('userToken');
      await AsyncStorage.removeItem('userData');
      return null;
    } catch (error) {
      return rejectWithValue('Logout failed');
    }
  }
);

export const fetchUserProfile = createAsyncThunk(
  'auth/fetchUserProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authAPI.getProfile();
      return response.user;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch profile');
    }
  }
);

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isInitialized: false,
  registrationCompleted: true, // true for existing users, false for new registrations
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setInitialized: (state) => {
      state.isInitialized = true;
    },
    completeRegistration: (state) => {
      state.registrationCompleted = true;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
        state.registrationCompleted = true; // Existing users have completed registration
        
        // Initialize push notifications for logged-in user (temporarily disabled)
        // pushNotificationService.initialize().then(() => {
        //   pushNotificationService.sendTokenToServer(
        //     action.payload.user._id, 
        //     action.payload.user.role
        //   );
        // });
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })
      
      // Register
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
        state.registrationCompleted = false; // New registration, medical info needed
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })
      
      // Load from storage
      .addCase(loadUserFromStorage.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadUserFromStorage.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isInitialized = true;
        state.registrationCompleted = true; // Existing users have completed registration
      })
      .addCase(loadUserFromStorage.rejected, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.isInitialized = true;
      })
      
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      
      // Fetch profile
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  }
});

export const { clearError, setInitialized, completeRegistration } = authSlice.actions;
export default authSlice.reducer;