import { Toaster } from '@/components/ui/sonner';
import type { UserPermissions } from '@/types/sheets';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { authenticateUser, getUserByUsername } from '@/services/userService';

interface AuthState {
    loggedIn: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    loading: boolean;
    user: UserPermissions;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [loggedIn, setLoggedIn] = useState(false);
    const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const stored = localStorage.getItem('auth');
        if (stored) {
            try {
                const { username } = JSON.parse(stored);
                getUserByUsername(username).then((user) => {
                    if (user) {
                        setUserPermissions(user);
                        setLoggedIn(true);
                    } else {
                        // User not found or error
                        localStorage.removeItem('auth');
                    }
                    setLoading(false);
                }).catch((error) => {
                    console.error('Error fetching user data:', error);
                    localStorage.removeItem('auth');
                    setLoading(false);
                });
            } catch (error) {
                console.error('Error parsing stored auth data:', error);
                localStorage.removeItem('auth');
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    }, []);

    async function login(username: string, password: string) {
        try {
            const user = await authenticateUser(username, password);
            if (!user) {
                return false;
            }

            localStorage.setItem('auth', JSON.stringify({ username }));
            setUserPermissions(user);
            setLoggedIn(true);
            return true;
        } catch (error) {
            console.error('Error during login:', error);
            return false;
        }
    }

    function logout() {
        localStorage.removeItem('auth');
        setLoggedIn(false);
        setUserPermissions(null);
    }

    // Create a default user object to prevent undefined errors
    const defaultUser: UserPermissions = userPermissions || {} as UserPermissions;

    return (
        <AuthContext.Provider value={{
            login,
            loggedIn,
            logout,
            user: defaultUser,
            loading
        }}>
            {children}
            <Toaster expand richColors theme="light" closeButton />
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
