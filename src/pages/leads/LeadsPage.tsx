import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Inbox, LayoutGrid, List, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { ListPageShell } from '@/components/list-page-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToolbarSelect } from '@/components/toolbar-field';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { LeadSheet } from '@/pages/leads/LeadSheet';
import { LeadsBoard } from '@/pages/leads/LeadsBoard';
import {
    createLead,
    deleteLead,
    getLead,
    LEAD_SOURCE_BADGE_CLASS,
    LEAD_SOURCE_LABELS,
    LEAD_STATUS_BADGE_CLASS,
    LEAD_STATUS_LABELS,
    LEAD_STATUSES,
    listLeadAssignees,
    listLeads,
    syncMetaLeads,
    updateLead,
    type Lead,
    type LeadSource,
    type LeadStatus,
} from '@/lib/leads';
import { toastError, toastSuccess } from '@/lib/toast';
import { useAuth } from '@/auth/AuthContext';
import { cn } from '@/lib/utils';

const PER_PAGE_OPTIONS = [10, 15, 25] as const;
const chip =
    'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none';

function parsePage(value: string | null): number {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parsePerPage(value: string | null): number {
    const n = Number(value);
    if (PER_PAGE_OPTIONS.includes(n as (typeof PER_PAGE_OPTIONS)[number])) return n;
    return 15;
}

function assignedFilter(raw: string): number | 'none' | undefined {
    if (raw === 'all' || raw === '') return undefined;
    if (raw === 'none') return 'none';
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
}

export function LeadsPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [searchParams, setSearchParams] = useSearchParams();
    const view = searchParams.get('view') === 'board' ? 'board' : 'list';
    const page = parsePage(searchParams.get('page'));
    const perPage = parsePerPage(searchParams.get('per_page'));
    const urlSearch = searchParams.get('search') ?? '';
    const urlStatus = searchParams.get('status') ?? 'all';
    const urlAssigned = searchParams.get('assigned_user_id') ?? 'all';
    const urlId = searchParams.get('id');

    const [searchInput, setSearchInput] = useState(urlSearch);
    const [rows, setRows] = useState<Lead[]>([]);
    const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number; from?: number | null; to?: number | null } | null>(null);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add');
    const [editing, setEditing] = useState<Lead | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
    const [assignees, setAssignees] = useState<{ id: number; name: string }[]>([]);
    const [boardTick, setBoardTick] = useState(0);
    const [syncingMeta, setSyncingMeta] = useState(false);

    useEffect(() => setSearchInput(urlSearch), [urlSearch]);

    useEffect(() => {
        const t = setTimeout(() => {
            const next = searchInput.trim();
            if (next === urlSearch) return;
            setSearchParams((prev) => {
                const p = new URLSearchParams(prev);
                if (next) p.set('search', next);
                else p.delete('search');
                p.set('page', '1');
                return p;
            }, { replace: true });
        }, 300);
        return () => clearTimeout(t);
    }, [searchInput, urlSearch, setSearchParams]);

    useEffect(() => {
        void listLeadAssignees().then((res) => setAssignees(res.data.map((u) => ({ id: u.id, name: u.name })))).catch(toastError);
    }, []);

    useEffect(() => {
        if (!urlId) return;
        const n = Number(urlId);
        if (!Number.isFinite(n) || n < 1) return;
        void getLead(n)
            .then((lead) => {
                setSheetMode('edit');
                setEditing(lead);
                setSheetOpen(true);
            })
            .catch(toastError);
    }, [urlId]);

    useEffect(() => {
        if (view !== 'list') return;
        const ac = new AbortController();
        let cancelled = false;
        setLoading(true);
        void listLeads(
            {
                search: urlSearch || undefined,
                status: urlStatus !== 'all' ? (urlStatus as LeadStatus) : undefined,
                assignedUserId: assignedFilter(urlAssigned),
                page,
                perPage,
            },
            ac.signal,
        )
            .then((list) => {
                if (cancelled) return;
                setRows(list.data);
                setMeta(list.meta);
            })
            .catch((err) => {
                if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
                toastError(err);
                setRows([]);
                setMeta(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [view, urlSearch, urlStatus, urlAssigned, page, perPage, boardTick]);

    function patchParams(patch: Record<string, string | null>) {
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            for (const [k, v] of Object.entries(patch)) {
                if (v == null || v === '') p.delete(k);
                else p.set(k, v);
            }
            return p;
        });
    }

    function reload() {
        setBoardTick((n) => n + 1);
    }

    function openEdit(lead: Lead) {
        setSheetMode('edit');
        setEditing(lead);
        setSheetOpen(true);
    }

    async function handleSyncMeta() {
        setSyncingMeta(true);
        try {
            const res = await syncMetaLeads();
            if (!res.configured) {
                toastError(res.message ?? 'Meta no configurado');
                return;
            }
            if (res.ingested > 0) {
                toastSuccess(`${res.ingested} lead${res.ingested === 1 ? '' : 's'} importado${res.ingested === 1 ? '' : 's'} desde Meta`);
                reload();
            } else {
                toastSuccess('Nada nuevo en Meta');
            }
        } catch (err) {
            toastError(err);
        } finally {
            setSyncingMeta(false);
        }
    }

    const total = meta?.total ?? 0;
    const lastPage = meta?.last_page ?? 1;
    const currentPage = meta?.current_page ?? page;
    const from = meta?.from ?? (total === 0 ? 0 : (currentPage - 1) * perPage + 1);
    const to = meta?.to ?? Math.min(currentPage * perPage, total);

    return (
        <>
            <ListPageShell
                title="Leads"
                description="Bandeja de oportunidades"
                icon={Inbox}
                above={
                    <nav aria-label="Vista de leads" className="flex flex-wrap gap-2 border-b border-border pb-3">
                        <button
                            type="button"
                            className={cn(chip, 'inline-flex items-center gap-1.5', view === 'list' ? 'bg-sidebar-accent font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                            onClick={() => patchParams({ view: null, page: '1' })}
                        >
                            <List className="size-4" /> Lista
                        </button>
                        <button
                            type="button"
                            className={cn(chip, 'inline-flex items-center gap-1.5', view === 'board' ? 'bg-sidebar-accent font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                            onClick={() => patchParams({ view: 'board' })}
                        >
                            <LayoutGrid className="size-4" /> Tablero
                        </button>
                    </nav>
                }
                actions={
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={syncingMeta} onClick={() => void handleSyncMeta()}>
                            <RefreshCw className={cn(syncingMeta && 'animate-spin')} />
                            <span className="sm:hidden">Meta</span>
                            <span className="hidden sm:inline">Importar Meta</span>
                        </Button>
                        <Button className="w-full sm:w-auto" onClick={() => { setSheetMode('add'); setEditing(null); setSheetOpen(true); }}>
                            <Plus />
                            Añadir lead
                        </Button>
                    </div>
                }
                toolbar={
                    <div className="flex flex-col gap-2 py-1 sm:flex-row sm:flex-wrap sm:items-end">
                        <div className="relative min-w-0 w-full flex-1 sm:min-w-[12rem]">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="pl-9" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Buscar por nombre, email o teléfono…" />
                        </div>
                        {view === 'list' && (
                            <ToolbarSelect
                                id="leads-status"
                                label="Etapa"
                                fieldClassName="w-full sm:w-auto"
                                items={[{ label: 'Todas', value: 'all' }, ...LEAD_STATUSES.map((s) => ({ label: LEAD_STATUS_LABELS[s], value: s }))]}
                                value={urlStatus}
                                onValueChange={(value) => patchParams({ status: !value || value === 'all' ? null : value, page: '1' })}
                            />
                        )}
                        <ToolbarSelect
                            id="leads-assigned"
                            label="Asignado"
                            fieldClassName="w-full sm:w-auto"
                            items={[{ label: 'Todos', value: 'all' }, { label: 'Sin asignar', value: 'none' }, ...assignees.map((u) => ({ label: u.name, value: String(u.id) }))]}
                            value={urlAssigned}
                            onValueChange={(value) => patchParams({ assigned_user_id: !value || value === 'all' ? null : value, page: '1' })}
                        />
                        {view === 'list' && (
                            <ToolbarSelect
                                id="leads-per-page"
                                label="Por página"
                                fieldClassName="w-full sm:w-auto"
                                items={PER_PAGE_OPTIONS.map((n) => ({ label: String(n), value: String(n) }))}
                                value={String(perPage)}
                                onValueChange={(value) => {
                                    if (value) patchParams({ per_page: value, page: '1' });
                                }}
                            />
                        )}
                    </div>
                }
            >
                {view === 'board' ? (
                    <LeadsBoard
                        search={urlSearch}
                        assignedUserId={assignedFilter(urlAssigned)}
                        reloadKey={boardTick}
                        onOpen={openEdit}
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Nombre</TableHead>
                                        <TableHead className="hidden sm:table-cell">Teléfono</TableHead>
                                        <TableHead className="hidden sm:table-cell">Email</TableHead>
                                        <TableHead>Etapa</TableHead>
                                        <TableHead className="hidden md:table-cell">Asignado</TableHead>
                                        <TableHead className="hidden lg:table-cell">Fuente</TableHead>
                                        <TableHead className="hidden lg:table-cell">Fecha</TableHead>
                                        <TableHead className="w-12" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading &&
                                        rows.length === 0 &&
                                        Array.from({ length: Math.min(perPage, 8) }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell">
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell">
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell">
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell">
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-8" />
                                                </TableCell>
                                            </TableRow>
                                        ))}

                                    {!loading && rows.length === 0 ? (
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Sin leads todavía.</TableCell>
                                        </TableRow>
                                    ) : rows.map((lead) => (
                                        <TableRow
                                            key={lead.id}
                                            className={cn('cursor-pointer', loading && 'opacity-60')}
                                            onClick={() => openEdit(lead)}
                                        >
                                            <TableCell className="max-w-[10rem] sm:max-w-[14rem]">
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium" title={lead.name ?? undefined}>
                                                        {lead.name || '—'}
                                                    </p>
                                                    <p className="truncate text-xs text-muted-foreground sm:hidden" title={lead.phone || lead.email || undefined}>
                                                        {lead.phone || lead.email || '—'}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden max-w-[10rem] truncate text-muted-foreground sm:table-cell sm:max-w-[14rem]" title={lead.phone ?? undefined}>
                                                {lead.phone || '—'}
                                            </TableCell>
                                            <TableCell className="hidden max-w-[10rem] truncate text-muted-foreground sm:table-cell sm:max-w-[16rem]" title={lead.email ?? undefined}>
                                                {lead.email || '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={LEAD_STATUS_BADGE_CLASS[lead.status]}>
                                                    {LEAD_STATUS_LABELS[lead.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden max-w-[10rem] truncate text-muted-foreground md:table-cell md:max-w-[14rem]" title={lead.assignedUser?.name ?? undefined}>
                                                {lead.assignedUser?.name || '—'}
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell">
                                                <Badge variant="outline" className={LEAD_SOURCE_BADGE_CLASS[lead.source as LeadSource] ?? 'border-border'}>
                                                    {LEAD_SOURCE_LABELS[lead.source as LeadSource] ?? lead.source}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden text-muted-foreground lg:table-cell">
                                                {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('es-ES') : '—'}
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                                                        <MoreHorizontal />
                                                        <span className="sr-only">Acciones</span>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => openEdit(lead)}><Pencil />Editar</DropdownMenuItem>
                                                        {isAdmin && <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(lead)}><Trash2 />Eliminar</DropdownMenuItem>}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {total > 0 && (
                            <nav aria-label="Paginación de leads" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground" aria-live="polite">
                                    Mostrando {from}–{to} de {total}
                                    <span className="mx-2 text-border">·</span>
                                    Página {currentPage} de {lastPage}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button type="button" variant="outline" size="sm" className="min-w-24" disabled={currentPage <= 1 || loading} onClick={() => patchParams({ page: String(currentPage - 1), per_page: String(perPage) })}>
                                        <ChevronLeft />
                                        Anterior
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" className="min-w-24" disabled={currentPage >= lastPage || loading} onClick={() => patchParams({ page: String(currentPage + 1), per_page: String(perPage) })}>
                                        Siguiente
                                        <ChevronRight />
                                    </Button>
                                </div>
                            </nav>
                        )}
                    </>
                )}
            </ListPageShell>

            <LeadSheet
                open={sheetOpen}
                mode={sheetMode}
                lead={editing}
                assignees={assignees}
                onOpenChange={setSheetOpen}
                onChanged={reload}
                onSubmit={async (data) => {
                    if (sheetMode === 'edit' && editing) {
                        await updateLead(editing.id, data);
                        toastSuccess('Lead actualizado');
                    } else {
                        await createLead(data);
                        toastSuccess('Lead creado');
                    }
                    reload();
                }}
            />

            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Eliminar lead</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">Esta acción elimina el lead (soft delete).</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={async () => {
                            if (!deleteTarget) return;
                            try {
                                await deleteLead(deleteTarget.id);
                                setDeleteTarget(null);
                                toastSuccess('Lead eliminado');
                                reload();
                            } catch (err) {
                                toastError(err);
                            }
                        }}>Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
