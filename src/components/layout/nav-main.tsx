import { NavLink, useLocation } from 'react-router-dom';
import { Clock, Folder, Home, Mail, ReceiptEuro, UserCog, Users, Wrench, type LucideIcon } from 'lucide-react';
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/AuthContext';
import type { UserRole } from '@/lib/users';

type NavItem = {
    title: string;
    url: string;
    icon: LucideIcon;
    end?: boolean;
    roles?: UserRole[];
};

const featureItems: NavItem[] = [
    { title: 'Inicio', url: '/dashboard', icon: Home, end: true },
    {
        title: 'Clientes',
        url: '/dashboard/clients',
        icon: Users,
        roles: ['admin', 'employee'],
    },
    {
        title: 'Proyectos',
        url: '/dashboard/projects',
        icon: Folder,
        roles: ['admin', 'employee'],
    },
    {
        title: 'Facturación',
        url: '/dashboard/billing',
        icon: ReceiptEuro,
        roles: ['admin', 'billing'],
    },
    {
        title: 'Timer',
        url: '/dashboard/timer',
        icon: Clock,
        roles: ['admin', 'employee'],
    },
    {
        title: 'Emails',
        url: '/dashboard/emails',
        icon: Mail,
        roles: ['admin'],
    },
    {
        title: 'Mantenimientos',
        url: '/dashboard/maintenance',
        icon: Wrench,
        roles: ['admin', 'employee'],
    },
];

const accountItems: NavItem[] = [
    {
        title: 'Usuarios',
        url: '/dashboard/users',
        icon: UserCog,
        roles: ['admin'],
    },
];

function NavItemList({ items }: { items: NavItem[] }) {
    const location = useLocation();
    const { user } = useAuth();
    const role = (user?.role ?? '') as UserRole;
    const visible = items.filter((item) => !item.roles || item.roles.includes(role));

    if (visible.length === 0) return null;

    return (
        <SidebarMenu className="gap-2">
            {visible.map((item) => {
                const isActive = item.end
                    ? location.pathname === item.url
                    : location.pathname === item.url || location.pathname.startsWith(`${item.url}/`);

                return (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            render={<NavLink to={item.url} end={item.end} />}
                            tooltip={item.title}
                            isActive={isActive}
                            className={cn(
                                'h-9 cursor-pointer transition-colors duration-200',
                                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                'focus-visible:ring-2 focus-visible:ring-primary/40',
                                'data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-primary',
                            )}
                        >
                            <item.icon aria-hidden />
                            <span>{item.title}</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                );
            })}
        </SidebarMenu>
    );
}

export function NavMain() {
    const { user } = useAuth();
    const role = (user?.role ?? '') as UserRole;
    const showAccount = accountItems.some((item) => !item.roles || item.roles.includes(role));

    return (
        <>
            <SidebarGroup className="px-2 py-0">
                <NavItemList items={featureItems} />
            </SidebarGroup>

            {showAccount && (
                <>
                    <SidebarSeparator className="mx-2 my-2" />
                    <SidebarGroup className="px-2 py-0">
                        <NavItemList items={accountItems} />
                    </SidebarGroup>
                </>
            )}
        </>
    );
}
