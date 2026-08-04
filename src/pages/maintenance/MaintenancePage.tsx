import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListPageShell } from '@/components/list-page-shell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { listClientOptions } from '@/lib/clients';
import { listProjectOptions } from '@/lib/projects';
import {
    MAINTENANCE_PERIODS,
    MAINTENANCE_PERIOD_LABELS,
    MAINTENANCE_STATUS_BADGE_CLASS,
    MAINTENANCE_STATUS_LABELS,
    createMaintenance,
    daysUntilEndsOn,
    deleteMaintenance,
    listMaintenances,
    updateMaintenance,
    type MaintenanceInput,
    type MaintenanceMeta,
    type MaintenancePeriod,
    type MaintenanceStatus,
} from '@/lib/maintenance';
import { toastError, toastSuccess } from '@/lib/toast';
import { EntitySelect } from '@/components/entity-select';
import { ToolbarField, ToolbarSelect } from '@/components/toolbar-field';
import { MaintenanceSheet } from '@/pages/maintenance/MaintenanceSheet';

const PER_PAGE = 15;
type MaintTab = 'open' | 'history';

function parsePage(v: string | null) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parseTab(scope: string | null): MaintTab {
    return scope === 'history' ? 'history' : 'open';
}

function EndsOnCell({ endsOn, status }: { endsOn: string; status: string }) {
    const days = daysUntilEndsOn(endsOn);
    const soon =
        days != null &&
        days >= 0 &&
        days <= 30 &&
        (status === 'active' || status === 'scheduled');

    return (
        <div className="flex flex-col gap-0.5">
            <span className={cn('text-foreground', soon && 'font-medium')}>{endsOn}</span>
            {soon && (
                <span className="text-xs text-amber-300">
                    {days === 0 ? 'Vence hoy' : days === 1 ? '1 día' : `${days} días`}
                </span>
            )}
        </div>
    );
}

export function MaintenancePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const page = parsePage(searchParams.get('page'));
    const tab = parseTab(searchParams.get('scope'));
    const urlClient = searchParams.get('client_id') ?? '';
    const urlProject = searchParams.get('project_id') ?? '';
    const urlPeriod = searchParams.get('period') ?? '';

    const filterKey = `${tab}|${urlClient}|${urlProject}|${urlPeriod}`;

    const [rows, setRows] = useState<MaintenancePeriod[]>([]);
    const [meta, setMeta] = useState<MaintenanceMeta | null>(null);
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);

    const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
    const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);

    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add');
    const [editing, setEditing] = useState<MaintenancePeriod | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<MaintenancePeriod | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        void listClientOptions().then(setClients);
        void listProjectOptions().then(setProjects);
    }, []);

    // ponytail: selects only — no debounce
    useEffect(() => {
        const [tabRaw, client, project, periodKind] = filterKey.split('|');
        const scope = tabRaw === 'history' ? 'history' : 'open';
        const ac = new AbortController();
        let cancelled = false;
        async function run() {
            setLoading(true);
            try {
                const res = await listMaintenances(
                    {
                        page,
                        perPage: PER_PAGE,
                        scope,
                        period: periodKind === 'monthly' || periodKind === 'annual' ? periodKind : undefined,
                        clientId: client ? Number(client) : undefined,
                        projectId: project ? Number(project) : undefined,
                        sort: scope === 'history' ? '-ends_on' : 'ends_on',
                    },
                    ac.signal,
                );
                if (cancelled) return;
                setRows(res.data);
                setMeta(res.meta);
            } catch (err) {
                if (cancelled) return;
                toastError(err);
                setRows([]);
                setMeta(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void run();
        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [page, filterKey, tick]);

    function patch(next: Record<string, string | null>) {
        setSearchParams(
            (prev) => {
                const p = new URLSearchParams(prev);
                for (const [k, v] of Object.entries(next)) {
                    if (v == null || v === '') p.delete(k);
                    else p.set(k, v);
                }
                if (!('page' in next)) p.set('page', '1');
                return p;
            },
            { replace: true },
        );
    }

    function setTab(next: MaintTab) {
        patch({ scope: next === 'history' ? 'history' : 'open' });
    }

    async function handleSave(data: MaintenanceInput) {
        if (sheetMode === 'edit' && editing) {
            await updateMaintenance(editing.id, data);
            toastSuccess('Periodo actualizado');
        } else {
            await createMaintenance(data);
            toastSuccess('Periodo creado');
        }
        setTick((n) => n + 1);
    }

    async function handleCancel(row: MaintenancePeriod) {
        try {
            await updateMaintenance(row.id, { status: 'cancelled' });
            toastSuccess('Periodo cancelado');
            setTick((n) => n + 1);
        } catch (err) {
            toastError(err);
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteMaintenance(deleteTarget.id);
            setDeleteTarget(null);
            toastSuccess('Periodo eliminado');
            setTick((n) => n + 1);
        } catch (err) {
            toastError(err);
        } finally {
            setDeleting(false);
        }
    }

    const lastPage = meta?.last_page ?? 1;
    const currentPage = meta?.current_page ?? page;

    return (
        <>
            <ListPageShell
                title="Mantenimientos"
                description="Cola de contratos de soporte por vencimiento. Historial intacto."
                icon={Wrench}
                above={
                    <nav aria-label="Secciones de mantenimientos" className="flex flex-wrap gap-2 border-b border-border pb-3">
                        {(
                            [
                                { id: 'open' as const, label: 'Abiertos' },
                                { id: 'history' as const, label: 'Historial' },
                            ] as const
                        ).map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                className={cn(
                                    'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors duration-200',
                                    'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                                    tab === t.id
                                        ? 'bg-sidebar-accent font-medium text-primary'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                )}
                                onClick={() => setTab(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </nav>
                }
                actions={
                    <Button
                        type="button"
                        onClick={() => {
                            setSheetMode('add');
                            setEditing(null);
                            setSheetOpen(true);
                        }}
                    >
                        <Plus />
                        Añadir mantenimiento
                    </Button>
                }
                toolbar={
                    <div className="flex flex-wrap items-end gap-2 py-1">
                        <ToolbarSelect
                            id="maint-period"
                            label="Periodo"
                            items={[
                                { label: 'Todos', value: null },
                                ...MAINTENANCE_PERIODS.map((period) => ({
                                    label: MAINTENANCE_PERIOD_LABELS[period],
                                    value: period,
                                })),
                            ]}
                            value={urlPeriod || null}
                            onValueChange={(value) => patch({ period: value })}
                            className="min-w-36"
                        />

                        <ToolbarField id="maint-client" label="Cliente">
                            <EntitySelect
                                id="maint-client"
                                items={clients}
                                value={urlClient ? Number(urlClient) : null}
                                onValueChange={(value) => patch({ client_id: value == null ? null : String(value) })}
                                allowClear
                                placeholder="Todos"
                                className="min-w-40"
                            />
                        </ToolbarField>

                        <ToolbarField id="maint-project" label="Proyecto">
                            <EntitySelect
                                id="maint-project"
                                items={projects}
                                value={urlProject ? Number(urlProject) : null}
                                onValueChange={(value) => patch({ project_id: value == null ? null : String(value) })}
                                allowClear
                                placeholder="Todos"
                                className="min-w-40"
                            />
                        </ToolbarField>
                    </div>
                }
            >
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Proyecto</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Periodo</TableHead>
                                <TableHead>Inicio</TableHead>
                                <TableHead>Fin</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading &&
                                rows.length === 0 &&
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((__, j) => (
                                            <TableCell key={j}>
                                                <Skeleton className="h-4 w-full" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            {!loading && rows.length === 0 && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        {tab === 'history'
                                            ? 'No hay periodos en el historial.'
                                            : 'No hay periodos abiertos.'}
                                    </TableCell>
                                </TableRow>
                            )}
                            {rows.map((row) => {
                                const clientTip = [row.client?.email, row.client?.phone].filter(Boolean).join(' · ');
                                const status = row.status as MaintenanceStatus;
                                return (
                                    <TableRow key={row.id}>
                                        <TableCell className="font-medium text-foreground">
                                            {row.project?.name ?? `#${row.projectId}`}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground" title={clientTip || undefined}>
                                            <span className="block text-foreground">{row.client?.name ?? '—'}</span>
                                            {row.client?.email && (
                                                <span className="block text-xs text-muted-foreground">{row.client.email}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                                                {MAINTENANCE_PERIOD_LABELS[row.period] ?? row.period}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{row.startsOn}</TableCell>
                                        <TableCell>
                                            <EndsOnCell endsOn={row.endsOn} status={row.status} />
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={MAINTENANCE_STATUS_BADGE_CLASS[status] ?? ''}
                                            >
                                                {MAINTENANCE_STATUS_LABELS[status] ?? row.status}
                                            </Badge>
                                        </TableCell>
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
                                                        onClick={() => {
                                                            setSheetMode('edit');
                                                            setEditing(row);
                                                            setSheetOpen(true);
                                                        }}
                                                    >
                                                        <Pencil />
                                                        Editar
                                                    </DropdownMenuItem>
                                                    {row.status !== 'cancelled' && (
                                                        <DropdownMenuItem
                                                            className="cursor-pointer"
                                                            onClick={() => void handleCancel(row)}
                                                        >
                                                            Cancelar periodo
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        className="cursor-pointer text-destructive"
                                                        onClick={() => setDeleteTarget(row)}
                                                    >
                                                        <Trash2 />
                                                        Eliminar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                {(meta?.total ?? 0) > 0 && (
                    <nav aria-label="Paginación mantenimientos" className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Página {currentPage} de {lastPage}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="cursor-pointer"
                                disabled={currentPage <= 1 || loading}
                                onClick={() => patch({ page: String(currentPage - 1) })}
                            >
                                <ChevronLeft />
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="cursor-pointer"
                                disabled={currentPage >= lastPage || loading}
                                onClick={() => patch({ page: String(currentPage + 1) })}
                            >
                                Siguiente
                                <ChevronRight />
                            </Button>
                        </div>
                    </nav>
                )}
            </ListPageShell>

            <MaintenanceSheet
                open={sheetOpen}
                mode={sheetMode}
                period={editing}
                onOpenChange={setSheetOpen}
                onSubmit={handleSave}
            />

            <Dialog
                open={Boolean(deleteTarget)}
                onOpenChange={(o) => {
                    if (!o) setDeleteTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar periodo</DialogTitle>
                        <DialogDescription>Soft delete. Preferible cancelar si solo quieres cerrarlo.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" className="cursor-pointer" onClick={() => setDeleteTarget(null)}>
                            Volver
                        </Button>
                        <Button
                            variant="destructive"
                            className="cursor-pointer"
                            disabled={deleting}
                            onClick={() => void confirmDelete()}
                        >
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
