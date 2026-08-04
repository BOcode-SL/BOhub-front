import type { ComponentProps } from 'react';
import { Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NavMain } from '@/components/layout/nav-main';
import { NavUser } from '@/components/layout/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarSeparator,
} from '@/components/ui/sidebar';

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader className="gap-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            render={<Link to="/dashboard" />}
                            tooltip="BOhub"
                            className="cursor-pointer transition-colors duration-200 hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <Zap className="size-4" strokeWidth={2.5} aria-hidden />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold tracking-tight text-foreground">BOhub</span>
                                <span className="truncate text-xs text-muted-foreground">by BOcode</span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarSeparator className="mx-0" />

            <SidebarContent className="px-0 py-2">
                <NavMain />
            </SidebarContent>

            <SidebarSeparator className="mx-0" />

            <SidebarFooter className="gap-2">
                <NavUser />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
