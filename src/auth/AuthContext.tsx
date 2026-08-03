import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, login as apiLogin, logout as apiLogout, me as apiMe, type AuthUser } from '../lib/api';

type AuthContextValue = {
    user: AuthUser | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshMe = useCallback(async () => {
        try {
            const next = await apiMe();
            setUser(next);
        } catch (err) {
            if (err instanceof ApiError && (err.status === 401 || err.status === 0)) {
                setUser(null);
            } else {
                throw err;
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refreshMe();
    }, [refreshMe]);

    const login = useCallback(async (email: string, password: string) => {
        const data = await apiLogin(email, password);
        setUser(data.user);
    }, []);

    const logout = useCallback(async () => {
        await apiLogout();
        setUser(null);
    }, []);

    const value = useMemo(
        () => ({ user, loading, login, logout, refreshMe }),
        [user, loading, login, logout, refreshMe],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return ctx;
}
