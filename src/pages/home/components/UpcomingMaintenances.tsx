import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Calendar, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    MAINTENANCE_PERIOD_LABELS,
    daysUntilEndsOn,
    type MaintenancePeriod,
} from '@/lib/maintenance';

const LIMIT = 3;

const rowButtonClass =
    'flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5 text-left transition-colors duration-200 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none';

type Props = {
    items: MaintenancePeriod[];
    isLoading?: boolean;
};

function formatDate(iso: string) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function DaysBadge({ days }: { days: number | null }) {
    if (days == null) {
        return null;
    }
    if (days < 0) {
        return (
            <div className="flex items-center gap-1 text-xs whitespace-nowrap text-destructive sm:text-sm">
                <AlertCircle className="size-3 shrink-0 sm:size-4" />
                <span>Vencido</span>
            </div>
        );
    }
    const isSoon = days <= 30;
    if (isSoon) {
        return (
            <div className="flex items-center gap-1 text-xs whitespace-nowrap text-amber-200 sm:text-sm">
                <AlertCircle className="size-3 shrink-0 sm:size-4" />
                <span>{days === 0 ? 'Hoy' : days === 1 ? '1 día' : `${days} días`}</span>
            </div>
        );
    }
    return (
        <div className="text-xs whitespace-nowrap text-muted-foreground sm:text-sm">
            {days === 1 ? '1 día' : `${days} días`}
        </div>
    );
}

export function UpcomingMaintenances({ items, isLoading }: Props) {
    const navigate = useNavigate();
    const rows = items.slice(0, LIMIT);

    if (isLoading) {
        return (
            <Card className="w-full min-w-0 max-w-full gap-3 py-4">
                <CardHeader className="gap-1 px-4 pb-0">
                    <CardTitle className="text-base sm:text-lg">Próximos mantenimientos</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                        Periodos abiertos ordenados por fecha de fin
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pt-0">
                    <div className="flex flex-col gap-2 sm:gap-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5">
                                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                    <Skeleton className="size-7 rounded-md sm:size-8" />
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <Skeleton className="h-4 w-32 max-w-full" />
                                        <Skeleton className="h-3 w-40 max-w-full" />
                                    </div>
                                </div>
                                <Skeleton className="h-4 w-14 shrink-0" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full min-w-0 max-w-full gap-3 py-4">
            <CardHeader className="gap-1 px-4 pb-0">
                <CardTitle className="truncate text-base sm:text-lg">Próximos mantenimientos</CardTitle>
                <CardDescription className="truncate text-xs sm:text-sm">
                    Periodos abiertos ordenados por fecha de fin
                </CardDescription>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-8 w-fit cursor-pointer px-2 text-xs sm:text-sm"
                    onClick={() => navigate('/dashboard/maintenance')}
                >
                    Ver todos
                    <ArrowRight className="size-3 sm:size-4" />
                </Button>
            </CardHeader>
            <CardContent className="px-4 pt-0">
                {rows.length > 0 ? (
                    <div className="flex flex-col gap-2 sm:gap-3">
                        {rows.map((row) => {
                            const days = daysUntilEndsOn(row.endsOn);
                            const projectName = row.project?.name ?? `#${row.projectId}`;
                            const periodLabel = MAINTENANCE_PERIOD_LABELS[row.period] ?? row.period;

                            return (
                                <button
                                    key={row.id}
                                    type="button"
                                    className={rowButtonClass}
                                    onClick={() =>
                                        navigate(`/dashboard/maintenance?project_id=${row.projectId}&scope=open`)
                                    }
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-primary sm:size-8">
                                            <Wrench className="size-3 sm:size-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-foreground sm:text-base">
                                                {projectName}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground sm:text-sm">
                                                {periodLabel}
                                                <span className="hidden min-[400px]:inline">
                                                    {' '}
                                                    · {formatDate(row.startsOn)} – {formatDate(row.endsOn)}
                                                </span>
                                                <span className="min-[400px]:hidden"> · fin {formatDate(row.endsOn)}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <DaysBadge days={days} />
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <div className="text-center">
                            <Calendar className="mx-auto mb-2 size-10 opacity-50" />
                            <p className="text-sm">No hay mantenimientos próximos</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
