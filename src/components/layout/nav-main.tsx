import { NavLink, useLocation } from 'react-router-dom';
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/AuthContext';
import { accountItems, featureItems, type NavItem } from '@/lib/nav-config';
import type { UserRole } from '@/lib/users';

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
            <SidebarGroup className="px-1 py-0">
                <NavItemList items={featureItems} />
            </SidebarGroup>

            {showAccount && (
                <>
                    <SidebarSeparator className="mx-1 my-2" />
                    <SidebarGroup className="px-1 py-0">
                        <NavItemList items={accountItems} />
                    </SidebarGroup>
                </>
            )}
        </>
    );
}
