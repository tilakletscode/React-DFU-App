import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAOmDEIz-bk_i4oODFDgado5aEAwMpAkOY",
  authDomain: "diabeticfootulcer-9e9d9.firebaseapp.com",
  projectId: "diabeticfootulcer-9e9d9",
  storageBucket: "diabeticfootulcer-9e9d9.firebasestorage.app",
  messagingSenderId: "450267467157",
  appId: "1:450267467157:web:8fe77abf1b5a3897abba9c",
  measurementId: "G-F912QYEDK9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth - Simple version for React Native
const auth = getAuth(app);

export { auth };
export default app;
