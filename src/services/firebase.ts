import firebase from 'firebase/app'
import 'firebase/auth'

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig)

export const auth = firebase.auth();

// إدارة الصلاحيات والأدوار
export const getUserRole = async (userId: string): Promise<string | null> => {
  console.warn('Firestore disabled: getUserRole fallback used for', userId);
  return null;
};

export const getUserStatus = async (userId: string): Promise<string | null> => {
  console.warn('Firestore disabled: getUserStatus fallback used for', userId);
  return null;
};

export const isUserApproved = async (userId: string): Promise<boolean> => {
  console.warn('Firestore disabled: auto-approving user', userId);
  return true;
};

export const getUserProfile = async (userId: string) => {
  console.warn('Firestore disabled: getUserProfile fallback used for', userId);
  return null;
};
