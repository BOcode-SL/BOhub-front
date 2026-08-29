import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { PageCrumbProvider, usePageCrumbValue } from '@/components/layout/page-crumb';
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';

/** Close mobile Sheet when the route changes (nav tap → navigate → drawer closes). */
function CloseMobileSidebarOnNavigate() {
    const { pathname } = useLocation();
    const { setOpenMobile } = useSidebar();
    useEffect(() => {
        setOpenMobile(false);
    }, [pathname, setOpenMobile]);
    return null;
}

const PAGE_TITLES: Record<string, string> = {
    '/dashboard': 'Inicio',
    '/dashboard/clients': 'Clientes',
    '/dashboard/projects': 'Proyectos',
    '/dashboard/billing': 'Facturación',
    '/dashboard/billing/income': 'Ingresos',
    '/dashboard/billing/expenses': 'Gastos',
    '/dashboard/timer': 'Timer',
    '/dashboard/emails': 'Emails',
    '/dashboard/emails/messages': 'Mensajes',
    '/dashboard/maintenance': 'Mantenimientos',
};

function sectionMatch(pathname: string): { path: string; title: string } | null {
    if (PAGE_TITLES[pathname]) return { path: pathname, title: PAGE_TITLES[pathname] };
    const match = Object.keys(PAGE_TITLES)
        .filter((k) => k !== '/dashboard' && pathname.startsWith(k + '/'))
        .sort((a, b) => b.length - a.length)[0];
    return match ? { path: match, title: PAGE_TITLES[match] } : null;
}

function HeaderBreadcrumb() {
    const { pathname } = useLocation();
    const { crumb } = usePageCrumbValue();
    const atHome = pathname === '/dashboard';
    const section = sectionMatch(pathname);
    const hasDetailCrumb = Boolean(crumb && section && pathname !== section.path);

    return (
        <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex items-center gap-1.5 text-sm">
                <li className="min-w-0">
                    {atHome ? (
                        <span className="text-muted-foreground">BOhub</span>
                    ) : (
                        <Link
                            to="/dashboard"
                            className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                        >
                            BOhub
                        </Link>
                    )}
                </li>
                {section && (
                    <>
                        <li aria-hidden className="text-muted-foreground">
                            <ChevronRight className="size-3.5" />
                        </li>
                        <li className="min-w-0 truncate">
                            {hasDetailCrumb ? (
                                <Link
                                    to={section.path}
                                    className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                                >
                                    {section.title}
                                </Link>
                            ) : (
                                <span className="font-medium text-foreground" aria-current="page">
                                    {section.title}
                                </span>
                            )}
                        </li>
                    </>
                )}
                {hasDetailCrumb && crumb && (
                    <>
                        <li aria-hidden className="text-muted-foreground">
                            <ChevronRight className="size-3.5" />
                        </li>
                        <li className="min-w-0 truncate font-medium text-foreground">
                            <span aria-current="page">{crumb}</span>
                        </li>
                    </>
                )}
            </ol>
        </nav>
    );
}

export function AppLayout() {
    return (
        <SidebarProvider>
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:outline-none"
            >
                Saltar al contenido
            </a>

            <CloseMobileSidebarOnNavigate />
            <AppSidebar />
            <MobileBottomNav />

            <SidebarInset className="min-w-0 overflow-x-hidden bg-background">
                <PageCrumbProvider>
                    <header className="sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 pt-[env(safe-area-inset-top)] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] backdrop-blur supports-backdrop-filter:bg-background/60 sm:gap-3 sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
                        <SidebarTrigger
                            className="hidden cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/40 md:inline-flex"
                            aria-label="Abrir o cerrar menú"
                        />
                        <HeaderBreadcrumb />
                    </header>

                    <main
                        id="main-content"
                        tabIndex={-1}
                        className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-5 pb-[calc(4rem+env(safe-area-inset-bottom))] outline-none sm:px-6 sm:py-6 md:pb-0 lg:px-8"
                    >
                        <Outlet />
                    </main>
                </PageCrumbProvider>
            </SidebarInset>
        </SidebarProvider>
    );
}
