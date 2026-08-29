import { Menu } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { MobileFloatingMenu } from '@/components/layout/mobile-floating-menu';
import { getMobilePrimaryItems } from '@/lib/nav-config';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/users';

export function MobileBottomNav() {
    const { user } = useAuth();
    const location = useLocation();
    const role = (user?.role ?? '') as UserRole;
    const items = getMobilePrimaryItems(role);
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <>
            <MobileFloatingMenu open={menuOpen} onOpenChange={setMenuOpen} />
            <nav
                aria-label="Navegación principal"
                className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
            >
                <div className="grid h-14 grid-cols-5">
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
                                    'flex flex-col items-center justify-center gap-0.5 px-1 text-[10px] transition-colors duration-200',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                                    isActive ? 'font-medium text-primary' : 'text-muted-foreground',
                                )}
                                onClick={() => setMenuOpen(false)}
                            >
                                <item.icon className="size-5 shrink-0" aria-hidden />
                                <span className="truncate">{item.mobileLabel ?? item.title}</span>
                            </NavLink>
                        );
                    })}
                    <button
                        type="button"
                        aria-expanded={menuOpen}
                        aria-haspopup="dialog"
                        onClick={() => setMenuOpen((open) => !open)}
                        className={cn(
                            'flex flex-col items-center justify-center gap-0.5 px-1 text-[10px] transition-colors duration-200',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                            menuOpen ? 'font-medium text-primary' : 'text-muted-foreground',
                        )}
                    >
                        <Menu className="size-5 shrink-0" aria-hidden />
                        <span>Menú</span>
                    </button>
                </div>
            </nav>
        </>
    );
}
