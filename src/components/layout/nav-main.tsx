import { NavLink, useLocation } from 'react-router-dom'
import {
  Clock,
  Folder,
  Home,
  Mail,
  ReceiptEuro,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

const items: { title: string; url: string; icon: LucideIcon; end?: boolean }[] = [
  { title: 'Inicio', url: '/dashboard', icon: Home, end: true },
  { title: 'Clientes', url: '/dashboard/clients', icon: Users },
  { title: 'Proyectos', url: '/dashboard/projects', icon: Folder },
  { title: 'Facturación', url: '/dashboard/billing', icon: ReceiptEuro },
  { title: 'Timer', url: '/dashboard/timer', icon: Clock },
  { title: 'Emails', url: '/dashboard/emails', icon: Mail },
  { title: 'Mantenimientos', url: '/dashboard/maintenance', icon: Wrench },
]

export function NavMain() {
  const location = useLocation()

  return (
    <SidebarGroup className="px-2 py-0">
      {/* gap-2 ≥ 8px — UX Pro Max touch spacing */}
      <SidebarMenu className="gap-2">
        {items.map((item) => {
          const isActive = item.end
            ? location.pathname === item.url
            : location.pathname === item.url ||
              location.pathname.startsWith(`${item.url}/`)

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
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
