import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

// Firebase configuration using environment variables with fallbacks
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD7p6iK1b0lG7sGP187VU7tBlTZyGo1wBA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "alsani-cockpit-v3.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "alsani-cockpit-v3",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "alsani-cockpit-v3.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1055161240393",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1055161240393:web:64428acfb48922fbc76898"
};

// Avoid logging secrets status in production

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