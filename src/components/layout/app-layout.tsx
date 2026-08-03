import { Link, Outlet, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

const PAGE_TITLES: Record<string, string> = {
  '/app': 'Inicio',
  '/app/clients': 'Clientes',
  '/app/projects': 'Proyectos',
  '/app/billing': 'Facturación',
  '/app/billing/income': 'Ingresos',
  '/app/billing/expenses': 'Gastos',
  '/app/timer': 'Timer',
  '/app/emails': 'Emails',
  '/app/emails/messages': 'Mensajes',
  '/app/maintenance': 'Mantenimientos',
}

function currentSection(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  const match = Object.keys(PAGE_TITLES)
    .filter((k) => k !== '/app' && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0]
  return match ? PAGE_TITLES[match] : 'Inicio'
}

export function AppLayout() {
  const { pathname } = useLocation()
  const section = currentSection(pathname)
  const atHome = pathname === '/app'

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:outline-none"
      >
        Saltar al contenido
      </a>

      <AppSidebar />

      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur supports-backdrop-filter:bg-background/60 sm:gap-3 sm:px-4">
          <SidebarTrigger
            className="cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Abrir o cerrar menú"
          />

          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex items-center gap-1.5 text-sm">
              <li className="min-w-0">
                {atHome ? (
                  <span className="text-muted-foreground">BOhub</span>
                ) : (
                  <Link
                    to="/app"
                    className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                  >
                    BOhub
                  </Link>
                )}
              </li>
              <li aria-hidden className="text-muted-foreground">
                <ChevronRight className="size-3.5" />
              </li>
              <li className="min-w-0 truncate font-medium text-foreground">
                <span aria-current="page">{section}</span>
              </li>
            </ol>
          </nav>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex flex-1 flex-col gap-6 px-4 py-5 outline-none sm:px-6 sm:py-6 lg:px-8"
        >
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
