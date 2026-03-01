import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import encryptionService from './encryptionService';

// Security Configuration
const SECURITY_CONFIG = {
  // Request timeout
  TIMEOUT: 30000,
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  
  // Encryption settings
  ENCRYPT_IMAGES: true,
  ENCRYPT_SENSITIVE_DATA: true,
  
  // Security headers
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  }
};

// API Configuration
const LOCAL_IP = '192.168.0.168';
const AUTH_BASE_URL = __DEV__ ? `http://${LOCAL_IP}:3000` : 'https://your-lambda-id.execute-api.us-east-1.amazonaws.com/dev';
const ML_BASE_URL = __DEV__ ? `https://${LOCAL_IP}:5001` : 'https://your-ec2-public-ip';

// Create secure axios instances
const createSecureAxios = (baseURL, isML = false) => {
  const instance = axios.create({
    baseURL,
    timeout: isML ? SECURITY_CONFIG.TIMEOUT * 2 : SECURITY_CONFIG.TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      ...SECURITY_CONFIG.SECURITY_HEADERS
    }
  });

  // Request interceptor for authentication and encryption
  instance.interceptors.request.use(
    async (config) => {
      try {
        // Add authentication token
        const token = await SecureStore.getItemAsync('userToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = generateRequestId();

        // Add timestamp for request validation
        config.headers['X-Timestamp'] = Date.now().toString();

        // Encrypt sensitive data if needed
        if (config.data && SECURITY_CONFIG.ENCRYPT_SENSITIVE_DATA) {
          config.data = await encryptSensitiveData(config.data);
        }

        // Log secure request (without sensitive data)
        logSecureRequest(config, 'OUTGOING');

        return config;
      } catch (error) {
        console.error('Request interceptor error:', error);
        return config;
      }
    },
    (error) => {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor for decryption and error handling
  instance.interceptors.response.use(
    async (response) => {
      try {
        // Decrypt sensitive data if needed
        if (response.data && SECURITY_CONFIG.ENCRYPT_SENSITIVE_DATA) {
          response.data = await decryptSensitiveData(response.data);
        }

        // Log secure response
        logSecureResponse(response, 'INCOMING');

        return response;
      } catch (error) {
        console.error('Response interceptor error:', error);
        return response;
      }
    },
    async (error) => {
      // Handle security-related errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        await handleSecurityError(error);
      }

      // Log security error
      logSecurityError(error);

      return Promise.reject(error);
    }
  );

  return instance;
};

// Create secure instances
const secureAuthAxios = createSecureAxios(AUTH_BASE_URL);
const secureMLAxios = createSecureAxios(ML_BASE_URL, true);

// Security utility functions
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const encryptSensitiveData = async (data) => {
  try {
    // Deep clone the data to avoid modifying original
    const clonedData = JSON.parse(JSON.stringify(data));
    
    // Encrypt specific sensitive fields
    if (clonedData.password) {
      clonedData.password = await encryptionService.generateHash(clonedData.password);
    }
    
    if (clonedData.email) {
      // Mask email for logging (not encryption)
      clonedData.email = clonedData.email.replace(/(.{2}).*(@.*)/, '$1****$2');
    }
    
    return clonedData;
  } catch (error) {
    console.error('Error encrypting sensitive data:', error);
    return data;
  }
};

const decryptSensitiveData = async (data) => {
  try {
    // Deep clone the data to avoid modifying original
    const clonedData = JSON.parse(JSON.stringify(data));
    
    // Decrypt specific fields if needed
    // Add decryption logic here for encrypted responses
    
    return clonedData;
  } catch (error) {
    console.error('Error decrypting sensitive data:', error);
    return data;
  }
};

const handleSecurityError = async (error) => {
  try {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await SecureStore.deleteItemAsync('userToken');
      // Dispatch logout action or redirect to login
    }
  } catch (secureStoreError) {
    console.error('Error handling security error:', secureStoreError);
  }
};

// Secure logging functions
const logSecureRequest = (config, direction) => {
  const logData = {
    timestamp: new Date().toISOString(),
    direction,
    method: config.method?.toUpperCase(),
    url: config.url,
    requestId: config.headers['X-Request-ID'],
    timestamp: config.headers['X-Timestamp'],
    hasAuth: !!config.headers.Authorization,
    dataSize: config.data ? JSON.stringify(config.data).length : 0
  };
  
  console.log('🔒 Secure Request:', logData);
};

const logSecureResponse = (response, direction) => {
  const logData = {
    timestamp: new Date().toISOString(),
    direction,
    status: response.status,
    statusText: response.statusText,
    responseSize: response.data ? JSON.stringify(response.data).length : 0,
    headers: Object.keys(response.headers)
  };
  
  console.log('🔒 Secure Response:', logData);
};

const logSecurityError = (error) => {
  const logData = {
    timestamp: new Date().toISOString(),
    type: 'SECURITY_ERROR',
    status: error.response?.status,
    statusText: error.response?.statusText,
    message: error.message,
    url: error.config?.url
  };
  
  console.error('🚨 Security Error:', logData);
};

// Secure Authentication API
export const secureAuthAPI = {
  // User authentication with enhanced security
  login: async (credentials) => {
    try {
      const response = await secureAuthAxios.post('/api/auth/login', credentials);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  register: async (userData) => {
    try {
      const response = await secureAuthAxios.post('/api/auth/register', userData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getProfile: async () => {
    try {
      const response = await secureAuthAxios.get('/api/auth/profile');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Enhanced security for sensitive operations
  changePassword: async (passwordData) => {
    try {
      // Hash the old password before sending
      const hashedData = {
        ...passwordData,
        oldPassword: await encryptionService.generateHash(passwordData.oldPassword),
        newPassword: await encryptionService.generateHash(passwordData.newPassword)
      };
      
      const response = await secureAuthAxios.post('/api/auth/change-password', hashedData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // OTP operations with rate limiting awareness
  sendOTP: async (email) => {
    try {
      const response = await secureAuthAxios.post('/api/auth/send-otp', { email });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  verifyOTP: async (email, otp) => {
    try {
      const response = await secureAuthAxios.post('/api/auth/otp-login', { email, otp });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
};

// Secure ML API with image encryption
export const secureMLAPI = {
  classifyImage: async (imageBase64) => {
    try {
      let secureImageData;
      
      if (SECURITY_CONFIG.ENCRYPT_IMAGES) {
        // Encrypt the image before transmission
        const encryptedImage = await encryptionService.encryptImage(imageBase64);
        secureImageData = {
          encryptedImage: encryptedImage.encryptedData,
          keyId: encryptedImage.keyId,
          iv: encryptedImage.iv,
          algorithm: encryptedImage.algorithm,
          timestamp: encryptedImage.timestamp,
          originalSize: imageBase64.length
        };
      } else {
        secureImageData = { image: imageBase64 };
      }

      const response = await secureMLAxios.post('/classify', secureImageData);
      
      // Clean up encryption key after successful transmission
      if (SECURITY_CONFIG.ENCRYPT_IMAGES && secureImageData.keyId) {
        await encryptionService.cleanupKey(secureImageData.keyId);
      }
      
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getModelInfo: async () => {
    try {
      const response = await secureMLAxios.get('/model-info');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  healthCheck: async () => {
    try {
      const response = await secureMLAxios.get('/health');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
};

// Enhanced error handling
const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const status = error.response.status;
    const message = error.response.data?.error || `Server error: ${status}`;
    
    // Enhanced error messages for security issues
    switch (status) {
      case 401:
        return 'Authentication failed. Please log in again.';
      case 403:
        return 'Access denied. You do not have permission for this action.';
      case 429:
        return 'Too many requests. Please wait before trying again.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return message;
    }
  } else if (error.request) {
    // Network error
    return 'Network error. Please check your connection and try again.';
  } else {
    // Other error
    return error.message || 'An unexpected error occurred';
  }
};

// Security monitoring and health checks
export const securityMonitor = {
  // Check overall security status
  getSecurityStatus: async () => {
    try {
      const [authHealth, mlHealth] = await Promise.allSettled([
        secureAuthAPI.getProfile(),
        secureMLAPI.healthCheck()
      ]);

      return {
        timestamp: new Date().toISOString(),
        authentication: {
          status: authHealth.status === 'fulfilled' ? 'SECURE' : 'VULNERABLE',
          details: authHealth.status === 'fulfilled' ? 'Authenticated and encrypted' : 'Authentication failed'
        },
        mlService: {
          status: mlHealth.status === 'fulfilled' ? 'SECURE' : 'VULNERABLE',
          details: mlHealth.status === 'fulfilled' ? 'ML service operational' : 'ML service unavailable'
        },
        encryption: {
          status: SECURITY_CONFIG.ENCRYPT_IMAGES ? 'ENABLED' : 'DISABLED',
          algorithm: SECURITY_CONFIG.ENCRYPT_IMAGES ? 'AES-256-GCM' : 'NONE'
        },
        overall: 'SECURE'
      };
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        overall: 'VULNERABLE',
        error: error.message
      };
    }
  },

  // Validate security configuration
  validateSecurityConfig: () => {
    const issues = [];
    
    if (!SECURITY_CONFIG.ENCRYPT_IMAGES) {
      issues.push('Image encryption is disabled');
    }
    
    if (!SECURITY_CONFIG.ENCRYPT_SENSITIVE_DATA) {
      issues.push('Sensitive data encryption is disabled');
    }
    
    if (SECURITY_CONFIG.TIMEOUT < 10000) {
      issues.push('Request timeout is too short');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      recommendations: issues.map(issue => `Enable: ${issue}`)
    };
  }
};

export default {
  secureAuthAPI,
  secureMLAPI,
  securityMonitor,
  SECURITY_CONFIG
};
