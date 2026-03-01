const admin = require('firebase-admin');

let firebaseApp = null;

const initializeFirebase = () => {
  try {
    if (!firebaseApp) {
      // Firebase Admin SDK configuration
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI,
        token_uri: process.env.FIREBASE_TOKEN_URI,
      };

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });

      console.log('✅ Firebase Admin SDK initialized successfully');
    }
    return firebaseApp;
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    throw error;
  }
};

const getAuth = () => {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.auth();
};

const verifyIdToken = async (idToken) => {
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    throw new Error('Invalid Firebase ID token');
  }
};

const createCustomToken = async (uid, additionalClaims = {}) => {
  try {
    const customToken = await getAuth().createCustomToken(uid, additionalClaims);
    return customToken;
  } catch (error) {
    throw new Error('Failed to create custom token');
  }
};

const createUser = async (userData) => {
  try {
    const userRecord = await getAuth().createUser(userData);
    return userRecord;
  } catch (error) {
    throw new Error(`Failed to create Firebase user: ${error.message}`);
  }
};

const updateUser = async (uid, userData) => {
  try {
    const userRecord = await getAuth().updateUser(uid, userData);
    return userRecord;
  } catch (error) {
    throw new Error(`Failed to update Firebase user: ${error.message}`);
  }
};

const deleteUser = async (uid) => {
  try {
    await getAuth().deleteUser(uid);
    return true;
  } catch (error) {
    throw new Error(`Failed to delete Firebase user: ${error.message}`);
  }
};

const getUserByEmail = async (email) => {
  try {
    const userRecord = await getAuth().getUserByEmail(email);
    return userRecord;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return null;
    }
    throw new Error(`Failed to get user by email: ${error.message}`);
  }
};

const setCustomClaims = async (uid, claims) => {
  try {
    await getAuth().setCustomUserClaims(uid, claims);
    return true;
  } catch (error) {
    throw new Error(`Failed to set custom claims: ${error.message}`);
  }
};

module.exports = {
  initializeFirebase,
  getAuth,
  verifyIdToken,
  createCustomToken,
  createUser,
  updateUser,
  deleteUser,
  getUserByEmail,
  setCustomClaims,
};
