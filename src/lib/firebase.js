// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, setLogLevel } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

console.log('Firebase project:', import.meta.env.VITE_FIREBASE_PROJECT_ID);

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// App Check (browser only)
if (typeof window !== 'undefined') {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

// Core SDKs
const firestore = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const storage = getStorage(app);

// Functions MUST use the same region you deployed to.
const functions = getFunctions(app, 'europe-west3');

// setLogLevel("debug");

// Connect to emulators in development mode
// Check for emulator environment variable or dev mode
// VITE_USE_EMULATORS must be explicitly set to 'false' (string) to disable emulators
const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== 'false';

// Debug logging
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  console.log('Emulator check:', {
    DEV: import.meta.env.DEV,
    VITE_USE_EMULATORS: import.meta.env.VITE_USE_EMULATORS,
    useEmulators,
  });
}

if (useEmulators && typeof window !== 'undefined') {
  // Use a flag to prevent multiple connection attempts
  if (!window.__firebaseEmulatorsConnected) {
    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(firestore, '127.0.0.1', 8081);
      connectStorageEmulator(storage, '127.0.0.1', 9199);
      connectFunctionsEmulator(functions, '127.0.0.1', 5001);
      window.__firebaseEmulatorsConnected = true;
      console.log('🔥 Connected to Firebase Emulators');
    } catch (error) {
      // Ignore errors if already connected (e.g., hot reload)
      if (!error.message?.includes('already been called')) {
        console.warn('Failed to connect to emulators:', error);
      }
    }
  }
} else if (typeof window !== 'undefined' && import.meta.env.DEV) {
  console.log('🔥 Using real Firebase project (emulators disabled)');
}

export { app, firestore, auth, storage, functions, googleProvider };
