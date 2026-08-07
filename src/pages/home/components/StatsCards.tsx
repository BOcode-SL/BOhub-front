import { Link } from 'react-router-dom';
import { Calendar, Clock, Folder, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
    clientsCount: number;
    projectsCount: number;
    projectsInProgress: number;
    hoursThisMonth: string;
    upcomingDeadlinesCount: number;
    isLoading?: boolean;
};

const linkCardClass =
    'block rounded-xl border border-border bg-card text-card-foreground shadow-sm outline-none transition-colors duration-200 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/40';

export function StatsCards({
    clientsCount,
    projectsCount,
    projectsInProgress,
    hoursThisMonth,
    upcomingDeadlinesCount,
    isLoading,
}: Props) {
    if (isLoading) {
        return (
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="size-4 rounded-full" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="mb-2 h-8 w-16" />
                            <Skeleton className="h-3 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            <Link to="/dashboard/clients" className={linkCardClass}>
                <Card className="h-full border-0 bg-transparent shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Clientes</CardTitle>
                        <Users className="size-4 shrink-0 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{clientsCount}</div>
                        <p className="text-xs text-muted-foreground">Total de clientes</p>
                    </CardContent>
                </Card>
            </Link>

            <Link to="/dashboard/projects" className={linkCardClass}>
                <Card className="h-full border-0 bg-transparent shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Proyectos</CardTitle>
                        <Folder className="size-4 shrink-0 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{projectsCount}</div>
                        <p className="text-xs text-muted-foreground">{projectsInProgress} en curso</p>
                    </CardContent>
                </Card>
            </Link>

            <Link to="/dashboard/timer" className={linkCardClass}>
                <Card className="h-full border-0 bg-transparent shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Horas</CardTitle>
                        <Clock className="size-4 shrink-0 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{hoursThisMonth}</div>
                        <p className="text-xs text-muted-foreground">Este mes</p>
                    </CardContent>
                </Card>
            </Link>

            <Link to="/dashboard/projects" className={linkCardClass}>
                <Card className="h-full border-0 bg-transparent shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vencimientos</CardTitle>
                        <Calendar className="size-4 shrink-0 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{upcomingDeadlinesCount}</div>
                        <p className="text-xs text-muted-foreground">Con fecha límite</p>
                    </CardContent>
                </Card>
            </Link>
        </div>
    );
}
