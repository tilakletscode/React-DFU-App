// Temporary Firebase configuration - Disabled to fix runtime errors
// This creates mock Firebase objects to prevent crashes

console.log('⚠️ Firebase temporarily disabled due to compatibility issues');

// Mock auth object to prevent crashes
const auth = {
  currentUser: null,
  onAuthStateChanged: (callback) => {
    // Return unsubscribe function
    return () => {};
  },
  signInWithEmailAndPassword: async (email, password) => {
    throw new Error('Firebase auth is temporarily disabled');
  },
  createUserWithEmailAndPassword: async (email, password) => {
    throw new Error('Firebase auth is temporarily disabled');
  },
  signOut: async () => {
    console.log('Mock sign out');
  }
};

// Mock storage object
const storage = null;

// Mock messaging
const messaging = null;

export { auth, storage, messaging };
export default { auth, storage, messaging };
