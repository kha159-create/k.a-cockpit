
import { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
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
      if (!user) {
        setAuthState({ user: null, profile: null, loading: false, isApproved: false });
        return;
      }

      const fallbackProfile: UserProfile = {
        id: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        role: 'general_manager',
      };

      setAuthState({ user, profile: fallbackProfile, loading: false, isApproved: true });
    });

    return () => unsubscribe();
  }, []);

  return authState;
};
