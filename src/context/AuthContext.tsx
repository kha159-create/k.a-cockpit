
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, UserProfile } from '../types';
import { apiUrl } from '@/utils/apiBase';

interface AuthState {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    login: (username: string, pin: string) => Promise<void>;
    logout: () => void;
}

const AuthCtx = createContext<AuthState>({
    user: null,
    profile: null,
    loading: true,
    login: async () => { },
    logout: () => { },
});

export const useAuth = () => useContext(AuthCtx);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check localStorage on mount
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Reconstruct user/profile objects
                const u: User = {
                    uid: parsed.id.toString(),
                    email: parsed.name,
                    displayName: parsed.displayName,
                    photoURL: null
                };

                const p: UserProfile = {
                    id: parsed.id.toString(),
                    name: parsed.name,
                    email: parsed.name,
                    role: parsed.role ? (parsed.role.toLowerCase() as any) : 'employee',
                    status: 'approved'
                };

                setUser(u);
                setProfile(p);
            } catch (e) {
                console.error('Failed to parse stored user', e);
                localStorage.removeItem('currentUser');
            }
        }
        setLoading(false);
    }, []);

    const login = async (username: string, pin: string) => {
        try {
            const res = await fetch(apiUrl('/api/auth-sql'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, pin })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');

            // Success
            const userData = data.user;
            localStorage.setItem('currentUser', JSON.stringify(userData));

            // Update State
            const u: User = {
                uid: userData.id.toString(),
                email: userData.name,
                displayName: userData.displayName,
                photoURL: null
            };

            const p: UserProfile = {
                id: userData.id.toString(),
                name: userData.name,
                email: userData.name,
                role: userData.role ? (userData.role.toLowerCase() as any) : 'employee',
                status: 'approved'
            };

            setUser(u);
            setProfile(p);

        } catch (err) {
            throw err;
        }
    };

    const logout = () => {
        localStorage.removeItem('currentUser');
        setUser(null);
        setProfile(null);
    };

    return (
        <AuthCtx.Provider value={{ user, profile, loading, login, logout }}>
            {children}
        </AuthCtx.Provider>
    );
};
