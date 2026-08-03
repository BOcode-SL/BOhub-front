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

const items: { title: string; url: string; icon: LucideIcon; end?: boolean }[] = [
  { title: 'Inicio', url: '/app', icon: Home, end: true },
  { title: 'Clientes', url: '/app/clients', icon: Users },
  { title: 'Proyectos', url: '/app/projects', icon: Folder },
  { title: 'Facturación', url: '/app/billing', icon: ReceiptEuro },
  { title: 'Timer', url: '/app/timer', icon: Clock },
  { title: 'Emails', url: '/app/emails', icon: Mail },
  { title: 'Mantenimientos', url: '/app/maintenance', icon: Wrench },
]

export function NavMain() {
  const location = useLocation()

  return (
    <SidebarGroup>
      <SidebarMenu className="gap-1.5">
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
                className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-primary"
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
