import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, clearToken, getToken, login as apiLogin, logout as apiLogout, me as apiMe, type AuthUser } from '../lib/api';

type AuthContextValue = {
    user: AuthUser | null;
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setTokenState] = useState<string | null>(() => getToken());
    const [loading, setLoading] = useState(() => Boolean(getToken()));

    const refreshMe = useCallback(async () => {
        const current = getToken();
        if (!current) {
            setUser(null);
            setTokenState(null);
            setLoading(false);
            return;
        }

        try {
            const next = await apiMe();
            setUser(next);
            setTokenState(current);
        } catch (err) {
            if (err instanceof ApiError && (err.status === 401 || err.status === 0)) {
                clearToken();
                setUser(null);
                setTokenState(null);
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
        setTokenState(data.token);
        setUser(data.user);
    }, []);

    const logout = useCallback(async () => {
        await apiLogout();
        setUser(null);
        setTokenState(null);
    }, []);

    const value = useMemo(
        () => ({ user, token, loading, login, logout, refreshMe }),
        [user, token, loading, login, logout, refreshMe],
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
