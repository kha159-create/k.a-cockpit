
import { useState, useEffect } from 'react';
// FIX: No longer need direct imports from 'firebase/auth' or 'firebase/firestore' when using compat API.
import { auth, db } from '../services/firebase';
import type { User, UserProfile } from '../types';

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

export const useAuth = (): AuthState => {
  const [authState, setAuthState] = useState<AuthState>({ user: null, profile: null, loading: true });

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
              setAuthState({ user, profile: userProfile, loading: false });
          } else {
              console.warn(`No profile document found for user with uid ${user.uid}. Falling back to default profile.`);
              const fallbackProfile: UserProfile = {
                  id: user.uid,
                  name: user.displayName || user.email?.split('@')[0] || 'User',
                  email: user.email || '',
                  role: 'employee',
              };
              setAuthState({ user, profile: fallbackProfile, loading: false });
          }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            const errorFallbackProfile: UserProfile = {
                id: user.uid,
                name: user.displayName || user.email?.split('@')[0] || 'User',
                email: user.email || '',
                role: 'employee',
            };
            setAuthState({ user, profile: errorFallbackProfile, loading: false });
        }
      } else {
        setAuthState({ user: null, profile: null, loading: false });
      }
    });

    return () => unsubscribe();
  }, []);

  return authState;
};