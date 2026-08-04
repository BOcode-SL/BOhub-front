import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { homePathForRole } from '@/lib/users';

function LoadingSession() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Cargando sesión…</div>
    );
}

export function ProtectedRoute() {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <LoadingSession />;

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return <Outlet />;
}

export function PublicOnlyRoute() {
    const { user, loading } = useAuth();

    if (loading) return <LoadingSession />;

    if (user) {
        return <Navigate to={homePathForRole(user.role)} replace />;
    }

    return <Outlet />;
}

/** Emails + Usuarios — admin only. */
export function AdminRoute() {
    const { user, loading } = useAuth();

    if (loading) return <LoadingSession />;

    if (user?.role !== 'admin') {
        return <Navigate to={homePathForRole(user?.role ?? '')} replace />;
    }

    return <Outlet />;
}

/** Facturación — admin | billing. */
export function BillingRoute() {
    const { user, loading } = useAuth();

    if (loading) return <LoadingSession />;

    if (user?.role !== 'admin' && user?.role !== 'billing') {
        return <Navigate to={homePathForRole(user?.role ?? '')} replace />;
    }

    return <Outlet />;
}

/** Ops — admin | employee. */
export function OpsRoute() {
    const { user, loading } = useAuth();

    if (loading) return <LoadingSession />;

    if (user?.role !== 'admin' && user?.role !== 'employee') {
        return <Navigate to={homePathForRole(user?.role ?? '')} replace />;
    }

    return <Outlet />;
}
