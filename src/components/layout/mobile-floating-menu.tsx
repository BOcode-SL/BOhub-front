import { LogOut } from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getMobileMenuItems } from '@/lib/nav-config';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/users';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function MobileFloatingMenu({ open, onOpenChange }: Props) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const role = (user?.role ?? '') as UserRole;
    const items = getMobileMenuItems(role);

    useEffect(() => {
        onOpenChange(false);
    }, [location.pathname, onOpenChange]);

    useEffect(() => {
        if (!open) return;
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') onOpenChange(false);
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onOpenChange]);

    if (!open || !user) return null;

    async function handleLogout() {
        onOpenChange(false);
        await logout();
        navigate('/login', { replace: true });
    }

    return (
        <>
            <button
                type="button"
                aria-label="Cerrar menú"
                className="fixed inset-0 z-40 bg-black/50 md:hidden"
                onClick={() => onOpenChange(false)}
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Más opciones"
                className="fixed inset-x-3 z-50 rounded-xl border border-border bg-popover p-3 shadow-lg md:hidden"
                style={{ bottom: 'calc(3.75rem + env(safe-area-inset-bottom))' }}
            >
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-2">
                    <Avatar className="size-9 rounded-lg">
                        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                        <AvatarFallback className="rounded-lg bg-muted font-semibold text-foreground">
                            {initials(user.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                </div>

                {items.length > 0 ? (
                    <nav aria-label="Accesos adicionales" className="grid grid-cols-2 gap-1.5">
                        {items.map((item) => {
                            const isActive = item.end
                                ? location.pathname === item.url
                                : location.pathname === item.url || location.pathname.startsWith(`${item.url}/`);

                            return (
                                <NavLink
                                    key={item.url}
                                    to={item.url}
                                    end={item.end}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={cn(
                                        'flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors duration-200',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                                        isActive
                                            ? 'bg-sidebar-accent font-medium text-primary'
                                            : 'text-foreground hover:bg-muted',
                                    )}
                                    onClick={() => onOpenChange(false)}
                                >
                                    <item.icon className="size-4 shrink-0" aria-hidden />
                                    <span className="truncate">{item.mobileLabel ?? item.title}</span>
                                </NavLink>
                            );
                        })}
                    </nav>
                ) : null}

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full cursor-pointer"
                    onClick={() => void handleLogout()}
                >
                    <LogOut aria-hidden />
                    Cerrar sesión
                </Button>
            </div>
        </>
    );
}
