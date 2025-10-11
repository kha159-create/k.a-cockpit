import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "REDACTED_FIREBASE_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "REDACTED_FIREBASE_DOMAIN",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "alsani-cockpit-v3",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "alsani-cockpit-v3.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "REDACTED_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:REDACTED_SENDER_ID:web:64428acfb48922fbc76898"
};

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