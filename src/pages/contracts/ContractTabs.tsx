import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const tabs = [
    { to: '/dashboard/contracts', end: true, label: 'Sobres' },
    { to: '/dashboard/contracts/settings', label: 'Plantilla email' },
] as const;

export function ContractTabs() {
    return (
        <nav aria-label="Secciones de contratos" className="flex flex-wrap gap-2 border-b border-border pb-3">
            {tabs.map((tab) => (
                <NavLink
                    key={tab.to}
                    to={tab.to}
                    end={'end' in tab ? tab.end : false}
                    className={({ isActive }) =>
                        cn(
                            'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors duration-200',
                            'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                            isActive
                                ? 'bg-sidebar-accent font-medium text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )
                    }
                >
                    {tab.label}
                </NavLink>
            ))}
        </nav>
    );
}
