import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// API Configuration
// HOTSPOT SETUP: Update these IPs when using mobile hotspot
// Common hotspot IPs: Android=192.168.43.1, iPhone=172.20.10.1, Windows=192.168.137.1

// Development: Local servers
// For testing on real device, use your computer's IP address
// For Expo Go testing, replace 'localhost' with your computer's IP (e.g., '192.168.1.100')

// 🔥 IMPORTANT: Change this IP when switching networks!
// WiFi Network: Usually 192.168.0.1, 192.168.1.1, or 192.168.0.168
// Mobile Hotspot: Usually 192.168.43.1 (Android) or 172.20.10.1 (iPhone)
const LOCAL_IP = '10.160.41.76';  // ✅ UPDATED: Using mobile hotspot IP
// Network IP configured for local connection

const AUTH_BASE_URL = __DEV__ ? `http://${LOCAL_IP}:3000` : 'https://your-lambda-id.execute-api.us-east-1.amazonaws.com/dev';
const ML_BASE_URL = __DEV__ ? `http://${LOCAL_IP}:5001` : 'http://your-ec2-public-ip';

// Create axios instances
const authAxios = axios.create({
  baseURL: AUTH_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const mlAxios = axios.create({
  baseURL: ML_BASE_URL,
  timeout: 30000, // Longer timeout for ML processing
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
authAxios.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token from secure store:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for auth errors
authAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      console.log('🚨 Authentication error detected, clearing stored credentials');
      try {
        await SecureStore.deleteItemAsync('userToken');
        await require('@react-native-async-storage/async-storage').default.removeItem('userData');
        
        // Import store dynamically to avoid circular dependency
        const { store } = await import('../store/store');
        const { logout } = await import('../store/slices/authSlice');
        store.dispatch(logout());
        
        console.log('✅ Credentials cleared, user logged out');
      } catch (secureStoreError) {
        console.error('❌ Error clearing credentials:', secureStoreError);
      }
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  // User authentication
  login: async (credentials) => {
    const response = await authAxios.post('/api/auth/login', credentials);
    return response.data;
  },

  register: async (userData) => {
    const response = await authAxios.post('/api/auth/register', userData);
    return response.data;
  },

  getProfile: async () => {
    const response = await authAxios.get('/api/auth/profile');
    return response.data;
  },

  // Prediction management
  savePrediction: async (predictionData) => {
    const response = await authAxios.post('/api/predictions', predictionData);
    return response.data;
  },

  getPredictionHistory: async () => {
    const response = await authAxios.get('/api/predictions');
    return response.data;
  },

  deletePrediction: async (predictionId) => {
    const response = await authAxios.delete(`/api/predictions/${predictionId}`);
    return response.data;
  },

  // Health check
  healthCheck: async () => {
    const response = await authAxios.get('/api/test');
    return response.data;
  },

  // Save medical information
  saveMedicalInfo: async (medicalData) => {
    const response = await authAxios.post('/api/auth/medical-info', medicalData);
    return response.data;
  },

  // Save diabetic foot history
  saveDiabeticFootHistory: async (historyData) => {
    const response = await authAxios.post('/api/auth/diabetic-foot-history', historyData);
    return response.data;
  },

  // Change password
  changePassword: async (passwordData) => {
    const response = await authAxios.post('/api/auth/change-password', passwordData);
    return response.data;
  },

  // Get unread message count
  getUnreadMessageCount: async () => {
    const response = await authAxios.get('/api/messages/unread-count');
    return response.data;
  },

  // Doctor to Admin messaging
  sendMessageToAdmins: async (message) => {
    const response = await authAxios.post('/api/messages/to-admins', { message });
    return response.data;
  },

  // Admin-Doctor conversations (Admin only)
  getDoctorMessages: async (params = {}) => {
    const response = await authAxios.get('/api/admin/doctor-messages', { params });
    return response.data;
  },

  // Reply to doctor (Admin only)
  replyToDoctor: async (doctorId, message) => {
    const response = await authAxios.post('/api/admin/reply-to-doctor', { doctorId, message });
    return response.data;
  },

  // Admin endpoints
  getUsers: async (params = {}) => {
    const response = await authAxios.get('/api/admin/users', { params });
    return response.data;
  },

  getUserDetails: async (userId) => {
    const response = await authAxios.get(`/api/admin/users/${userId}`);
    return response.data;
  },

  createUser: async (userData) => {
    const response = await authAxios.post('/api/admin/users', userData);
    return response.data;
  },

  updateUser: async (userId, userData) => {
    const response = await authAxios.put(`/api/admin/users/${userId}`, userData);
    return response.data;
  },

  deleteUser: async (userId) => {
    const response = await authAxios.delete(`/api/admin/users/${userId}`);
    return response.data;
  },

  // Activate/Deactivate user
  updateUserStatus: async (userId, isActive) => {
    const response = await authAxios.patch(`/api/admin/users/${userId}/status`, { isActive });
    return response.data;
  },

  // Messaging endpoints
  sendMessage: async (messageData) => {
    const response = await authAxios.post('/api/messages', messageData);
    return response.data;
  },

  getMessages: async (params = {}) => {
    const response = await authAxios.get('/api/messages', { params });
    return response.data;
  },

  markMessageAsRead: async (messageId) => {
    const response = await authAxios.put(`/api/messages/${messageId}/read`);
    return response.data;
  },

  // Doctor endpoints
  getPatients: async (params = {}) => {
    const response = await authAxios.get('/api/doctor/patients', { params });
    return response.data;
  },

  getPatientDetails: async (patientId) => {
    const response = await authAxios.get(`/api/doctor/patients/${patientId}`);
    return response.data;
  },

  // Search endpoints
  searchUsers: async (query, role = 'patient') => {
    const response = await authAxios.get('/api/search/users', { 
      params: { q: query, role } 
    });
    return response.data;
  },

  // OTP endpoints
  sendOTP: async (email) => {
    const response = await authAxios.post('/api/auth/send-otp', { email });
    return response.data;
  },

  verifyOTP: async (email, otp) => {
    const response = await authAxios.post('/api/auth/otp-login', { email, otp });
    return response.data;
  },

  forgotPassword: async (email) => {
    const response = await authAxios.post('/api/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (email, otp, newPassword) => {
    const response = await authAxios.post('/api/auth/reset-password', { 
      email, otp, newPassword 
    });
    return response.data;
  },

  // Messages endpoints
  getMessages: async (params = {}) => {
    const response = await authAxios.get('/api/messages', { params });
    return response.data;
  },

  sendMessage: async (messageData) => {
    const response = await authAxios.post('/api/messages', messageData);
    return response.data;
  },

  markMessagesAsRead: async (senderId) => {
    const response = await authAxios.post('/api/messages/mark-read', { senderId });
    return response.data;
  },

  // Admin-specific endpoints
  getDoctorMessages: async (params = {}) => {
    const response = await authAxios.get('/api/admin/doctor-messages', { params });
    return response.data;
  },

  getUnreadMessagesCount: async () => {
    const response = await authAxios.get('/api/admin/unread-messages-count');
    return response.data;
  },

  // Doctor-specific endpoints
  getAdminMessages: async (params = {}) => {
    const response = await authAxios.get('/api/doctor/admin-messages', { params });
    return response.data;
  },

  getDoctorUnreadMessagesCount: async () => {
    const response = await authAxios.get('/api/doctor/unread-messages-count');
    return response.data;
  },

  getDoctorDashboard: async () => {
    const response = await authAxios.get('/api/doctor/dashboard');
    return response.data;
  },
};

// ML API
export const mlAPI = {
  classifyImage: async (imageBase64) => {
    const response = await mlAxios.post('/classify', {
      image: imageBase64
    });
    return response.data;
  },

  getModelInfo: async () => {
    const response = await mlAxios.get('/model-info');
    return response.data;
  },

  healthCheck: async () => {
    const response = await mlAxios.get('/health');
    return response.data;
  },
};

// Utility functions
export const apiUtils = {
  // Convert image URI to base64
  imageToBase64: async (imageUri) => {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1]; // Remove data:image/jpeg;base64, prefix
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      throw new Error('Failed to convert image to base64');
    }
  },

  // Handle API errors
  handleApiError: (error) => {
    if (error.response) {
      // Server responded with error status
      return error.response.data?.error || `Server error: ${error.response.status}`;
    } else if (error.request) {
      // Network error
      return 'Network error. Please check your connection.';
    } else {
      // Other error
      return error.message || 'An unexpected error occurred';
    }
  },

  // Check if servers are reachable
  checkServerHealth: async () => {
    try {
      const [authHealth, mlHealth] = await Promise.allSettled([
        authAPI.healthCheck(),
        mlAPI.healthCheck()
      ]);

      return {
        auth: authHealth.status === 'fulfilled',
        ml: mlHealth.status === 'fulfilled',
        authError: authHealth.status === 'rejected' ? authHealth.reason.message : null,
        mlError: mlHealth.status === 'rejected' ? mlHealth.reason.message : null,
      };
    } catch (error) {
      return {
        auth: false,
        ml: false,
        error: 'Failed to check server health'
      };
    }
  }
};

export default {
  authAPI,
  mlAPI,
  apiUtils
};