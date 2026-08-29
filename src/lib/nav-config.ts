import {
    Activity,
    Banknote,
    Clock,
    FilePen,
    Folder,
    Home,
    Inbox,
    Mail,
    ReceiptEuro,
    Settings,
    TrendingDown,
    TrendingUp,
    UserCog,
    Users,
    Wrench,
    type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/lib/users';

export type NavItem = {
    title: string;
    url: string;
    icon: LucideIcon;
    end?: boolean;
    roles?: UserRole[];
    /** Bottom bar móvil (máx 4 + Menú) */
    mobilePrimary?: boolean;
    /** Etiqueta corta en bottom nav */
    mobileLabel?: string;
};

export const featureItems: NavItem[] = [
    { title: 'Inicio', url: '/dashboard', icon: Home, end: true, mobilePrimary: true, mobileLabel: 'Inicio' },
    {
        title: 'Clientes',
        url: '/dashboard/clients',
        icon: Users,
        roles: ['admin', 'employee'],
        mobilePrimary: true,
        mobileLabel: 'Clientes',
    },
    {
        title: 'Proyectos',
        url: '/dashboard/projects',
        icon: Folder,
        roles: ['admin', 'employee'],
        mobilePrimary: true,
        mobileLabel: 'Proyectos',
    },
    {
        title: 'Leads',
        url: '/dashboard/leads',
        icon: Inbox,
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
        mobilePrimary: true,
        mobileLabel: 'Timer',
    },
    {
        title: 'Emails',
        url: '/dashboard/emails',
        icon: Mail,
        roles: ['admin'],
    },
    {
        title: 'Contratos',
        url: '/dashboard/contracts',
        icon: FilePen,
        roles: ['admin'],
    },
    {
        title: 'Mantenimientos',
        url: '/dashboard/maintenance',
        icon: Wrench,
        roles: ['admin', 'employee'],
    },
    {
        title: 'Análisis Web',
        url: '/dashboard/website-analysis',
        icon: Activity,
        roles: ['admin', 'employee'],
    },
];

export const accountItems: NavItem[] = [
    {
        title: 'Usuarios',
        url: '/dashboard/users',
        icon: UserCog,
        roles: ['admin'],
    },
];

/** Bottom bar billing: 4 tabs + Menú */
export const billingMobileItems: NavItem[] = [
    { title: 'Resumen', url: '/dashboard/billing', icon: ReceiptEuro, end: true, mobileLabel: 'Resumen' },
    { title: 'Ingresos', url: '/dashboard/billing/income', icon: TrendingUp, mobileLabel: 'Ingresos' },
    { title: 'Gastos', url: '/dashboard/billing/expenses', icon: TrendingDown, mobileLabel: 'Gastos' },
    { title: 'Nóminas', url: '/dashboard/billing/payrolls', icon: Banknote, mobileLabel: 'Nóminas' },
];

export function getMobilePrimaryItems(role: UserRole): NavItem[] {
    if (role === 'billing') {
        return billingMobileItems;
    }
    return featureItems.filter((item) => item.mobilePrimary && (!item.roles || item.roles.includes(role)));
}

/** Rutas secundarias para el menú flotante móvil (no están en la bottom bar). */
export function getMobileMenuItems(role: UserRole): NavItem[] {
    if (role === 'billing') {
        return [
            {
                title: 'Configuración',
                url: '/dashboard/billing/settings',
                icon: Settings,
                mobileLabel: 'Configuración',
            },
        ];
    }

    const primaryUrls = new Set(getMobilePrimaryItems(role).map((item) => item.url));
    const secondary = featureItems.filter(
        (item) => (!item.roles || item.roles.includes(role)) && !primaryUrls.has(item.url),
    );
    const account = accountItems.filter((item) => !item.roles || item.roles.includes(role));
    return [...secondary, ...account];
}
