import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDuration, type Hour, type HoursMeta } from '@/lib/timer';

type Props = {
    hours: Hour[];
    meta: HoursMeta | null;
    loading: boolean;
    showUser: boolean;
    showActions: boolean;
    page: number;
    onPageChange: (page: number) => void;
    onEdit?: (hour: Hour) => void;
    onDelete?: (hour: Hour) => void;
    hideProject?: boolean;
};

export function HoursTable({
    hours,
    meta,
    loading,
    showUser,
    showActions,
    page,
    onPageChange,
    onEdit,
    onDelete,
    hideProject = false,
}: Props) {
    const colCount = 4 + (showUser ? 1 : 0) + (showActions ? 1 : 0) - (hideProject ? 1 : 0);
    const lastPage = meta?.last_page ?? 1;
    const currentPage = meta?.current_page ?? page;

    return (
        <>
            <div className="overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Fecha</TableHead>
                            {showUser && <TableHead>Usuario</TableHead>}
                            {!hideProject && <TableHead>Proyecto</TableHead>}
                            <TableHead>Duración</TableHead>
                            <TableHead>Descripción</TableHead>
                            {showActions && <TableHead className="w-12" />}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading &&
                            hours.length === 0 &&
                            Array.from({ length: 4 }).map((_, i) => (
                                <TableRow key={i}>
                                    {Array.from({ length: colCount }).map((__, j) => (
                                        <TableCell key={j}>
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        {!loading && hours.length === 0 && (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={colCount} className="h-24 text-center text-muted-foreground">
                                    Aún no hay horas registradas.
                                </TableCell>
                            </TableRow>
                        )}
                        {hours.map((h) => (
                            <TableRow key={h.id}>
                                <TableCell className="text-muted-foreground">{h.workedOn}</TableCell>
                                {showUser && <TableCell className="text-foreground">{h.user?.name ?? '—'}</TableCell>}
                                {!hideProject && (
                                    <TableCell className="font-medium text-foreground">
                                        {h.project?.name ?? `#${h.projectId}`}
                                    </TableCell>
                                )}
                                <TableCell className="font-mono font-medium text-primary">
                                    {formatDuration(h.durationSeconds)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">{h.description || '—'}</TableCell>
                                {showActions && (
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger
                                                render={<Button variant="ghost" size="icon-sm" className="cursor-pointer" />}
                                            >
                                                <MoreHorizontal />
                                                <span className="sr-only">Acciones</span>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    className="cursor-pointer"
                                                    onClick={() => onEdit?.(h)}
                                                >
                                                    <Pencil />
                                                    Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    className="cursor-pointer"
                                                    onClick={() => onDelete?.(h)}
                                                >
                                                    <Trash2 />
                                                    Eliminar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {(meta?.total ?? 0) > 0 && (
                <nav aria-label="Paginación horas" className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Página {currentPage} de {lastPage}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage <= 1 || loading}
                            onClick={() => onPageChange(currentPage - 1)}
                        >
                            <ChevronLeft />
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage >= lastPage || loading}
                            onClick={() => onPageChange(currentPage + 1)}
                        >
                            Siguiente
                            <ChevronRight />
                        </Button>
                    </div>
                </nav>
            )}
        </>
    );
}
