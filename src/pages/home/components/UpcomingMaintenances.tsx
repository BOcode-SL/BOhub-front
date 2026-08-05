import { useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    MAINTENANCE_PERIOD_LABELS,
    daysUntilEndsOn,
    type MaintenancePeriod,
} from '@/lib/maintenance';

const LIMIT = 3;

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

export function UpcomingMaintenances({ items, isLoading }: Props) {
    const navigate = useNavigate();
    const rows = items.slice(0, LIMIT);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Próximos mantenimientos</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                        Periodos abiertos ordenados por fecha de fin
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 sm:space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 sm:gap-4">
                                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                    <Skeleton className="size-7 rounded-md sm:size-8" />
                                    <div className="flex-1 space-y-1">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-40" />
                                    </div>
                                </div>
                                <Skeleton className="h-4 w-12" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-base sm:text-lg">Próximos mantenimientos</CardTitle>
                        <CardDescription className="truncate text-xs sm:text-sm">
                            Periodos abiertos ordenados por fecha de fin
                        </CardDescription>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 cursor-pointer text-xs sm:text-sm"
                        onClick={() => navigate('/dashboard/maintenance')}
                    >
                        Ver todos
                        <ArrowRight className="size-3 sm:size-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {rows.length > 0 ? (
                    <div className="space-y-2 sm:space-y-3">
                        {rows.map((row) => {
                            const days = daysUntilEndsOn(row.endsOn);
                            const soon = days != null && days >= 0 && days <= 30;
                            const projectName = row.project?.name ?? `#${row.projectId}`;
                            const periodLabel = MAINTENANCE_PERIOD_LABELS[row.period] ?? row.period;

                            return (
                                <button
                                    key={row.id}
                                    type="button"
                                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border p-2 text-left transition-colors duration-200 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none sm:gap-4 sm:p-3"
                                    onClick={() =>
                                        navigate(`/dashboard/maintenance?project_id=${row.projectId}&scope=open`)
                                    }
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-primary sm:size-8">
                                            <Wrench className="size-3 sm:size-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-medium text-foreground sm:text-base">
                                                {projectName}
                                            </div>
                                            <div className="truncate text-xs text-muted-foreground sm:text-sm">
                                                {periodLabel} · {formatDate(row.startsOn)} – {formatDate(row.endsOn)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right text-xs whitespace-nowrap sm:text-sm">
                                        {days == null ? (
                                            <span className="text-muted-foreground">{row.endsOn}</span>
                                        ) : days < 0 ? (
                                            <span className="text-destructive">Vencido</span>
                                        ) : days === 0 ? (
                                            <span className="text-amber-200">Vence hoy</span>
                                        ) : soon ? (
                                            <span className="text-amber-200">
                                                {days === 1 ? '1 día' : `${days} días`}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">{days} días</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-8 text-center text-muted-foreground">
                        <Calendar className="mx-auto mb-2 size-10 opacity-50" />
                        <p className="text-sm">No hay mantenimientos próximos</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
