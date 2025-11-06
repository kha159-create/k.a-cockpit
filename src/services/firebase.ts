import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

// Firebase configuration - must read from environment variables (GitHub Secrets at build time)
// Vite automatically loads .env.local in development mode and injects env vars at build time
// Debug: Log what import.meta.env contains
console.log('🔍 import.meta.env check:', {
  hasVITE_FIREBASE_API_KEY: !!import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_API_KEY_type: typeof import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_API_KEY_value: import.meta.env.VITE_FIREBASE_API_KEY ? `${String(import.meta.env.VITE_FIREBASE_API_KEY).substring(0, 10)}...` : 'undefined',
  allViteKeys: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')),
});

const requiredEnvVars = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

// Validate required environment variables
const envVarMap: Record<string, string> = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
};

const missingVars: string[] = [];
Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (!value || value.trim() === '') {
    missingVars.push(envVarMap[key]);
  }
});

if (missingVars.length > 0) {
  const isProduction = import.meta.env.PROD;
  const errorMsg = isProduction
    ? `Missing Firebase env vars in GitHub Secrets: ${missingVars.join(', ')}. Please add them in Repository Settings → Secrets → Actions.`
    : `Missing Firebase env vars in .env.local: ${missingVars.join(', ')}. Please set them for local development.`;
  
  console.error('❌ Firebase configuration is incomplete');
  console.error('Environment:', isProduction ? 'Production' : 'Development');
  console.error('Missing variables:', missingVars);
  throw new Error(errorMsg);
}

// Trim all values to remove any whitespace (common issue with GitHub Secrets)
const firebaseConfig = {
  apiKey: requiredEnvVars.apiKey!.trim(),
  authDomain: requiredEnvVars.authDomain!.trim(),
  projectId: requiredEnvVars.projectId!.trim(),
  storageBucket: requiredEnvVars.storageBucket!.trim(),
  messagingSenderId: requiredEnvVars.messagingSenderId!.trim(),
  appId: requiredEnvVars.appId!.trim(),
};

// Debug: Log config status (without exposing full key) - in both dev and prod
const apiKeyPreview = firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'MISSING';
console.log('🔍 Firebase Config Status:', {
  apiKey: apiKeyPreview,
  apiKeyLength: firebaseConfig.apiKey?.length || 0,
  authDomain: firebaseConfig.authDomain || 'MISSING',
  projectId: firebaseConfig.projectId || 'MISSING',
  env: import.meta.env.PROD ? 'Production' : 'Development',
});

// Validate API key format (should start with AIza and be ~39 chars)
if (!firebaseConfig.apiKey.startsWith('AIza')) {
  console.error('❌ Invalid Firebase API Key format. Key should start with "AIza"');
  console.error('Key preview:', firebaseConfig.apiKey.substring(0, 20));
  console.error('Key length:', firebaseConfig.apiKey.length);
  console.error('Full key (first 30 chars):', firebaseConfig.apiKey.substring(0, 30));
  throw new Error('Invalid Firebase API Key format. Please check GitHub Secrets.');
}

if (firebaseConfig.apiKey.length < 35 || firebaseConfig.apiKey.length > 45) {
  console.warn('⚠️ Firebase API Key length seems unusual:', firebaseConfig.apiKey.length);
  console.warn('Expected length: ~39 characters');
}

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();

// إدارة الصلاحيات والأدوار
export const getUserRole = async (userId: string): Promise<string | null> => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData?.role || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
};

export const getUserStatus = async (userId: string): Promise<string | null> => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData?.status || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting user status:', error);
    return null;
  }
};

export const isUserApproved = async (userId: string): Promise<boolean> => {
  const status = await getUserStatus(userId);
  // Allow both 'approved' and 'active' statuses for login
  return status === 'approved' || status === 'active';
};

export const getUserProfile = async (userId: string) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      return userDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};