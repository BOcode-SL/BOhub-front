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
            <div className="min-w-0 overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Fecha</TableHead>
                            {showUser && <TableHead className="hidden sm:table-cell">Usuario</TableHead>}
                            {!hideProject && <TableHead>Proyecto</TableHead>}
                            <TableHead>Duración</TableHead>
                            <TableHead className="hidden md:table-cell">Descripción</TableHead>
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
                                <TableCell className="whitespace-nowrap text-muted-foreground">{h.workedOn}</TableCell>
                                {showUser && (
                                    <TableCell
                                        className="hidden max-w-[10rem] truncate text-foreground sm:table-cell"
                                        title={h.user?.name ?? undefined}
                                    >
                                        {h.user?.name ?? '—'}
                                    </TableCell>
                                )}
                                {!hideProject && (
                                    <TableCell
                                        className="max-w-[8rem] truncate font-medium text-foreground sm:max-w-[14rem]"
                                        title={h.project?.name ?? undefined}
                                    >
                                        {h.project?.name ?? `#${h.projectId}`}
                                    </TableCell>
                                )}
                                <TableCell className="whitespace-nowrap font-mono font-medium text-primary">
                                    {formatDuration(h.durationSeconds)}
                                </TableCell>
                                <TableCell
                                    className="hidden max-w-[20rem] truncate text-muted-foreground md:table-cell"
                                    title={h.description || undefined}
                                >
                                    {h.description || '—'}
                                </TableCell>
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
                <nav
                    aria-label="Paginación horas"
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
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
