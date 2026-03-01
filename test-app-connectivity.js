#!/usr/bin/env node

/**
 * Comprehensive App Connectivity Test
 * Tests all pages, API endpoints, and user flows
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  AUTH_SERVER: 'http://localhost:3000',
  ML_SERVER: 'http://localhost:5001',
  TIMEOUT: 30000,
  TEST_USER: {
    email: 'test@example.com',
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'User',
    age: 30,
    gender: 'male',
    phone: '+1234567890',
    username: 'testuser'
  }
};

// Test results storage
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  tests: []
};

// Utility functions
const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '🔄';
  console.log(`${prefix} [${timestamp}] ${message}`);
};

const addTestResult = (testName, passed, details = '') => {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    log(`${testName}: PASSED ${details}`, 'success');
  } else {
    testResults.failed++;
    log(`${testName}: FAILED ${details}`, 'error');
  }
  
  testResults.tests.push({
    name: testName,
    passed,
    details,
    timestamp: new Date().toISOString()
  });
};

// Test functions
async function testServerHealth() {
  log('Testing server health...');
  
  try {
    // Test Auth Server
    const authResponse = await axios.get(`${CONFIG.AUTH_SERVER}/api/test`, {
      timeout: CONFIG.TIMEOUT
    });
    addTestResult('Auth Server Health', authResponse.status === 200, `Status: ${authResponse.status}`);
  } catch (error) {
    addTestResult('Auth Server Health', false, error.message);
  }
  
  try {
    // Test ML Server
    const mlResponse = await axios.get(`${CONFIG.ML_SERVER}/health`, {
      timeout: CONFIG.TIMEOUT
    });
    addTestResult('ML Server Health', mlResponse.status === 200, `Status: ${mlResponse.status}`);
  } catch (error) {
    addTestResult('ML Server Health', false, error.message);
  }
}

async function testDatabaseConnection() {
  log('Testing database connection...');
  
  try {
    const response = await axios.get(`${CONFIG.AUTH_SERVER}/api/test/db`, {
      timeout: CONFIG.TIMEOUT
    });
    addTestResult('Database Connection', response.data.connected === true, 'MongoDB connection verified');
  } catch (error) {
    addTestResult('Database Connection', false, error.message);
  }
}

async function testUserRegistration() {
  log('Testing user registration flow...');
  
  try {
    const response = await axios.post(`${CONFIG.AUTH_SERVER}/api/auth/register`, CONFIG.TEST_USER, {
      timeout: CONFIG.TIMEOUT
    });
    
    const success = response.status === 201 || response.status === 200;
    addTestResult('User Registration', success, `User created with ID: ${response.data.user?._id}`);
    return response.data;
  } catch (error) {
    const isExpected = error.response?.status === 400 && error.response?.data?.error?.includes('already exists');
    addTestResult('User Registration', isExpected, isExpected ? 'User already exists (expected)' : error.message);
    return null;
  }
}

async function testUserLogin() {
  log('Testing user login flow...');
  
  try {
    const response = await axios.post(`${CONFIG.AUTH_SERVER}/api/auth/login`, {
      email: CONFIG.TEST_USER.email,
      password: CONFIG.TEST_USER.password
    }, {
      timeout: CONFIG.TIMEOUT
    });
    
    const success = response.status === 200 && response.data.token && response.data.user;
    addTestResult('User Login', success, `Token received: ${!!response.data.token}`);
    return response.data;
  } catch (error) {
    addTestResult('User Login', false, error.message);
    return null;
  }
}

async function testProtectedRoutes(authToken) {
  if (!authToken) {
    addTestResult('Protected Routes', false, 'No auth token available');
    return;
  }
  
  log('Testing protected routes...');
  
  const headers = { Authorization: `Bearer ${authToken}` };
  
  try {
    // Test profile endpoint
    const profileResponse = await axios.get(`${CONFIG.AUTH_SERVER}/api/auth/profile`, {
      headers,
      timeout: CONFIG.TIMEOUT
    });
    addTestResult('Profile Endpoint', profileResponse.status === 200, 'Profile data retrieved');
  } catch (error) {
    addTestResult('Profile Endpoint', false, error.message);
  }
  
  try {
    // Test predictions endpoint
    const predictionsResponse = await axios.get(`${CONFIG.AUTH_SERVER}/api/predictions`, {
      headers,
      timeout: CONFIG.TIMEOUT
    });
    addTestResult('Predictions Endpoint', predictionsResponse.status === 200, 'Predictions retrieved');
  } catch (error) {
    addTestResult('Predictions Endpoint', false, error.message);
  }
}

async function testMLInference() {
  log('Testing ML model inference...');
  
  // Create a simple test image (1x1 pixel base64)
  const testImageBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A';
  
  try {
    const response = await axios.post(`${CONFIG.ML_SERVER}/classify`, {
      image: testImageBase64
    }, {
      timeout: CONFIG.TIMEOUT * 2 // ML processing takes longer
    });
    
    const success = response.status === 200 && response.data.prediction;
    addTestResult('ML Model Inference', success, `Prediction: ${response.data.prediction?.class}`);
  } catch (error) {
    addTestResult('ML Model Inference', false, error.message);
  }
}

async function testFirebaseConfig() {
  log('Testing Firebase configuration...');
  
  const firebaseConfigPath = path.join(__dirname, 'src', 'config', 'firebase.js');
  
  try {
    if (fs.existsSync(firebaseConfigPath)) {
      const configContent = fs.readFileSync(firebaseConfigPath, 'utf8');
      const hasApiKey = configContent.includes('apiKey:');
      const hasProjectId = configContent.includes('projectId:');
      const hasStorageBucket = configContent.includes('storageBucket:');
      
      addTestResult('Firebase Config', hasApiKey && hasProjectId && hasStorageBucket, 
        `API Key: ${hasApiKey}, Project ID: ${hasProjectId}, Storage: ${hasStorageBucket}`);
    } else {
      addTestResult('Firebase Config', false, 'Firebase config file not found');
    }
  } catch (error) {
    addTestResult('Firebase Config', false, error.message);
  }
}

async function testEnvironmentSetup() {
  log('Testing environment setup...');
  
  // Check for required files
  const requiredFiles = [
    'package.json',
    'App.js',
    'backend/auth_server/server.js',
    'backend/ml_server/app.py',
    'backend/models/ulcer_classification_mobilenetv3.pth'
  ];
  
  let filesFound = 0;
  requiredFiles.forEach(file => {
    if (fs.existsSync(path.join(__dirname, file))) {
      filesFound++;
    } else {
      log(`Missing file: ${file}`, 'error');
    }
  });
  
  addTestResult('Environment Files', filesFound === requiredFiles.length, 
    `${filesFound}/${requiredFiles.length} required files found`);
}

async function testNavigationFlow() {
  log('Testing navigation structure...');
  
  const navigationPath = path.join(__dirname, 'src', 'navigation', 'AppNavigator.js');
  
  try {
    if (fs.existsSync(navigationPath)) {
      const navContent = fs.readFileSync(navigationPath, 'utf8');
      
      const hasAuthStack = navContent.includes('AuthStackNavigator');
      const hasPatientTabs = navContent.includes('PatientTabNavigator');
      const hasDoctorTabs = navContent.includes('DoctorTabNavigator');
      const hasAdminTabs = navContent.includes('AdminTabNavigator');
      const hasRoleRouting = navContent.includes('switch (userRole)');
      
      addTestResult('Navigation Structure', 
        hasAuthStack && hasPatientTabs && hasDoctorTabs && hasAdminTabs && hasRoleRouting,
        'All navigation stacks and role-based routing present');
    } else {
      addTestResult('Navigation Structure', false, 'AppNavigator.js not found');
    }
  } catch (error) {
    addTestResult('Navigation Structure', false, error.message);
  }
}

async function testScreenConnectivity() {
  log('Testing screen connectivity...');
  
  const screenPaths = [
    'src/screens/auth/WelcomeScreen.js',
    'src/screens/auth/LoginScreen.js',
    'src/screens/auth/RegisterScreen.js',
    'src/screens/auth/UserInfoScreen.js',
    'src/screens/main/HomeScreen.js',
    'src/screens/main/CameraScreen.js',
    'src/screens/main/HistoryScreen.js',
    'src/screens/main/ProfileScreen.js',
    'src/screens/medical/DiabeticFootHistoryScreen.js',
    'src/screens/doctor/DoctorDashboardScreen.js',
    'src/screens/admin/AdminDashboardScreen.js',
    'src/screens/shared/MessagesScreen.js'
  ];
  
  let screensFound = 0;
  for (const screenPath of screenPaths) {
    if (fs.existsSync(path.join(__dirname, screenPath))) {
      screensFound++;
    }
  }
  
  addTestResult('Screen Files', screensFound === screenPaths.length, 
    `${screensFound}/${screenPaths.length} screen files found`);
}

async function testAPIEndpoints() {
  log('Testing API endpoint definitions...');
  
  const apiPath = path.join(__dirname, 'src', 'services', 'api.js');
  
  try {
    if (fs.existsSync(apiPath)) {
      const apiContent = fs.readFileSync(apiPath, 'utf8');
      
      const hasAuthAPI = apiContent.includes('authAPI');
      const hasMLAPI = apiContent.includes('mlAPI');
      const hasLogin = apiContent.includes('login:');
      const hasRegister = apiContent.includes('register:');
      const hasClassify = apiContent.includes('classifyImage');
      
      addTestResult('API Endpoints', hasAuthAPI && hasMLAPI && hasLogin && hasRegister && hasClassify,
        'All required API endpoints defined');
    } else {
      addTestResult('API Endpoints', false, 'API service file not found');
    }
  } catch (error) {
    addTestResult('API Endpoints', false, error.message);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting comprehensive app connectivity tests...\n');
  
  const startTime = Date.now();
  
  // Run all tests
  await testEnvironmentSetup();
  await testFirebaseConfig();
  await testNavigationFlow();
  await testScreenConnectivity();
  await testAPIEndpoints();
  await testServerHealth();
  await testDatabaseConnection();
  
  const registrationResult = await testUserRegistration();
  const loginResult = await testUserLogin();
  
  if (loginResult?.token) {
    await testProtectedRoutes(loginResult.token);
  }
  
  await testMLInference();
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  // Generate report
  console.log('\n📊 TEST SUMMARY');
  console.log('================');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  console.log(`Duration: ${duration}s`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.tests.filter(t => !t.passed).forEach(test => {
      console.log(`   • ${test.name}: ${test.details}`);
    });
  }
  
  // Save detailed report
  const report = {
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      successRate: ((testResults.passed / testResults.total) * 100).toFixed(1) + '%',
      duration: duration + 's',
      timestamp: new Date().toISOString()
    },
    tests: testResults.tests,
    config: CONFIG
  };
  
  fs.writeFileSync('test-results.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Detailed report saved to: test-results.json');
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  log(`Unhandled rejection: ${error.message}`, 'error');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`, 'error');
  process.exit(1);
});

// Run tests
runAllTests().catch(error => {
  log(`Test runner error: ${error.message}`, 'error');
  process.exit(1);
});
