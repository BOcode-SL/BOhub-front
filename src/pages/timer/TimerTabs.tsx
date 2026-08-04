import { cn } from '@/lib/utils';

type Tab = 'mine' | 'team' | 'analytics';

type Props = {
    tab: Tab;
    isAdmin: boolean;
    onChange: (tab: Tab) => void;
};

const chip =
    'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none';

export function TimerTabs({ tab, isAdmin, onChange }: Props) {
    return (
        <nav aria-label="Vistas de horas" className="flex flex-wrap gap-2 border-b border-border pb-3">
            <button
                type="button"
                className={cn(
                    chip,
                    tab === 'mine'
                        ? 'bg-sidebar-accent font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                onClick={() => onChange('mine')}
            >
                Mis horas
            </button>
            {isAdmin && (
                <button
                    type="button"
                    className={cn(
                        chip,
                        tab === 'team'
                            ? 'bg-sidebar-accent font-medium text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                    onClick={() => onChange('team')}
                >
                    Equipo
                </button>
            )}
            <button
                type="button"
                className={cn(
                    chip,
                    tab === 'analytics'
                        ? 'bg-sidebar-accent font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                onClick={() => onChange('analytics')}
            >
                Analytics
            </button>
        </nav>
    );
}
