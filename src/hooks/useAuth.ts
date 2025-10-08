
import { useState, useEffect } from 'react';
// FIX: No longer need direct imports from 'firebase/auth' or 'firebase/firestore' when using compat API.
import { auth, db, isUserApproved } from '../services/firebase';
import firebase from 'firebase/app';
import type { User, UserProfile } from '../types';

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isApproved: boolean;
}

export const useAuth = (): AuthState => {
  const [authState, setAuthState] = useState<AuthState>({ user: null, profile: null, loading: true, isApproved: false });

  useEffect(() => {
    // FIX: Use namespaced compat API for onAuthStateChanged
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          let userProfile: UserProfile | null = null;
          
          // FIX: Use namespaced compat API for Firestore operations
          const docRef = db.collection('users').doc(user.uid);
          const userDocById = await docRef.get();
          
          if (userDocById.exists) {
              userProfile = userDocById.data() as UserProfile;
          } else {
              const usersRef = db.collection('users');
              const q = usersRef.where('uid', '==', user.uid).limit(1);
              const userQuery = await q.get();
              if (!userQuery.empty) {
                  userProfile = userQuery.docs[0].data() as UserProfile;
              }
          }

          if (userProfile) {
              // التحقق من حالة الموافقة
              const approved = await isUserApproved(user.uid);
              
              // إذا لم يكن المستخدم معتمد، تحقق من كونه admin
              if (!approved && userProfile.role === 'admin') {
                  console.log('Admin user without status field, auto-approving...');
                  // إضافة status: 'approved' تلقائياً للـ admin
                  try {
                      await db.collection('users').doc(user.uid).update({
                          status: 'approved',
                          approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                          approvedBy: 'system'
                      });
                      setAuthState({ user, profile: { ...userProfile, status: 'approved' }, loading: false, isApproved: true });
                      return;
                  } catch (error) {
                      console.error('Error auto-approving admin:', error);
                  }
              }
              
              setAuthState({ user, profile: userProfile, loading: false, isApproved: approved });
              
              // إذا لم يكن المستخدم معتمد، امسحه من الجلسة
              if (!approved) {
                  console.log('User not approved, signing out...');
                  await auth.signOut();
                  setAuthState({ user: null, profile: null, loading: false, isApproved: false });
                  return;
              }
          } else {
              console.warn(`No profile document found for user with uid ${user.uid}. Falling back to default profile.`);
              const fallbackProfile: UserProfile = {
                  id: user.uid,
                  name: user.displayName || user.email?.split('@')[0] || 'User',
                  email: user.email || '',
                  role: 'employee',
              };
              setAuthState({ user, profile: fallbackProfile, loading: false, isApproved: false });
          }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            const errorFallbackProfile: UserProfile = {
                id: user.uid,
                name: user.displayName || user.email?.split('@')[0] || 'User',
                email: user.email || '',
                role: 'employee',
            };
            setAuthState({ user, profile: errorFallbackProfile, loading: false, isApproved: false });
        }
      } else {
        setAuthState({ user: null, profile: null, loading: false, isApproved: false });
      }
    });

    return () => unsubscribe();
  }, []);

  return authState;
};