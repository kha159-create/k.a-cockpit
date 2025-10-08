import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

// Validate Firebase environment variables
const requiredEnvVars = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.warn(`⚠️ Missing Firebase environment variables: ${missingVars.join(', ')}`);
  console.warn('Using fallback values for Firebase configuration');
}

const firebaseConfig = {
  apiKey: requiredEnvVars.VITE_FIREBASE_API_KEY || "REDACTED_FIREBASE_API_KEY",
  authDomain: requiredEnvVars.VITE_FIREBASE_AUTH_DOMAIN || "REDACTED_FIREBASE_DOMAIN",
  projectId: requiredEnvVars.VITE_FIREBASE_PROJECT_ID || "alsani-cockpit-v3",
  storageBucket: requiredEnvVars.VITE_FIREBASE_STORAGE_BUCKET || "alsani-cockpit-v3.firebasestorage.app",
  messagingSenderId: requiredEnvVars.VITE_FIREBASE_MESSAGING_SENDER_ID || "REDACTED_SENDER_ID",
  appId: requiredEnvVars.VITE_FIREBASE_APP_ID || "1:REDACTED_SENDER_ID:web:64428acfb48922fbc76898"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();