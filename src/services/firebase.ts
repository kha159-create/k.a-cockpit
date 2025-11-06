import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

// ⬇️ الوصول المباشر ليتم استبداله أثناء البناء
const apiKey        = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain    = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId     = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const senderId      = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const appId         = import.meta.env.VITE_FIREBASE_APP_ID;

if (!apiKey || !projectId || !appId) {
  throw new Error('⚠️ Missing Firebase env vars. Check GitHub Secrets or .env.local');
}

export const firebaseConfig = {
  apiKey: String(apiKey).trim(),
  authDomain: String(authDomain || '').trim(),
  projectId: String(projectId).trim(),
  storageBucket: String(storageBucket || '').trim(),
  messagingSenderId: String(senderId || '').trim(),
  appId: String(appId).trim(),
};

// Validate API key format (should start with AIza)
// In production: only warn, don't throw (to prevent crashes)
if (!firebaseConfig.apiKey.startsWith('AIza')) {
  const errorMsg = 'Invalid Firebase API Key format. Key should start with "AIza"';
  if (import.meta.env.DEV) {
    console.error('❌', errorMsg);
    throw new Error(errorMsg + '. Please check GitHub Secrets or .env.local.');
  } else {
    // Production: warn but don't crash
    console.warn('⚠️', errorMsg);
    console.warn('Continuing with provided key...');
  }
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