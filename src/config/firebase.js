// Firebase temporarily disabled to fix React Native compatibility issues
// Using backend-only authentication instead

console.log('🔧 Firebase disabled - using backend authentication');

// Mock Firebase objects to prevent import errors
const auth = null;
const storage = null;
const messaging = null;
const app = null;

export { auth, storage, messaging };
export default app;
