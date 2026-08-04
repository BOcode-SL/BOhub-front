import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function NavUser() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    if (!user) return null;

    async function handleLogout() {
        await logout();
        navigate('/login', { replace: true });
    }

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <div className="flex w-full flex-col gap-2 px-2 py-1">
                    <div className="flex items-center gap-2 rounded-md px-1 py-1.5">
                        <Avatar className="size-8 rounded-lg">
                            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                            <AvatarFallback className="rounded-lg bg-muted font-semibold text-foreground">
                                {initials(user.name)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-medium text-foreground">{user.name}</span>
                            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full cursor-pointer"
                        onClick={() => void handleLogout()}
                    >
                        <LogOut aria-hidden />
                        Cerrar sesión
                    </Button>
                </div>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
