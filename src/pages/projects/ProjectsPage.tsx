import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, Folder, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListPageShell } from '@/components/list-page-shell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { listClientOptions } from '@/lib/clients';
import {
    PROJECT_PRIORITY_LABELS,
    PROJECT_STATUSES,
    PROJECT_STATUS_LABELS,
    PROJECT_TYPE_LABELS,
    createProject,
    deleteProject,
    listProjects,
    updateProject,
    type Project,
    type ProjectInput,
    type ProjectsMeta,
} from '@/lib/projects';
import { toastError, toastSuccess } from '@/lib/toast';
import { ProjectSheet } from '@/pages/projects/ProjectSheet';

const PER_PAGE_OPTIONS = [10, 15, 25] as const;
const selectClass =
    'h-9 cursor-pointer rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

function parsePage(value: string | null): number {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parsePerPage(value: string | null): number {
    const n = Number(value);
    if (PER_PAGE_OPTIONS.includes(n as (typeof PER_PAGE_OPTIONS)[number])) {
        return n;
    }
    return 15;
}

function formatDates(start: string | null, end: string | null): string {
    if (!start && !end) return '—';
    if (start && end) return `${start} → ${end}`;
    return start || end || '—';
}

export function ProjectsPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const page = parsePage(searchParams.get('page'));
    const perPage = parsePerPage(searchParams.get('per_page'));
    const urlSearch = searchParams.get('search') ?? '';
    const urlStatus = searchParams.get('status') ?? '';
    const urlClientId = searchParams.get('client_id') ?? '';

    const [searchInput, setSearchInput] = useState(urlSearch);
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
    const [meta, setMeta] = useState<ProjectsMeta | null>(null);
    const [loading, setLoading] = useState(true);
    const [reloadTick, setReloadTick] = useState(0);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add');
    const [editing, setEditing] = useState<Project | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        setSearchInput(urlSearch);
    }, [urlSearch]);

    useEffect(() => {
        let cancelled = false;
        void listClientOptions().then((rows) => {
            if (!cancelled) setClients(rows);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const t = setTimeout(() => {
            const next = searchInput.trim();
            if (next === urlSearch) return;
            setSearchParams(
                (prev) => {
                    const p = new URLSearchParams(prev);
                    if (next) p.set('search', next);
                    else p.delete('search');
                    p.set('page', '1');
                    p.set('per_page', String(perPage));
                    return p;
                },
                { replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [searchInput, urlSearch, perPage, setSearchParams]);

    // ponytail: one abortable fetch; reloadTick bumps after mutations
    useEffect(() => {
        const ac = new AbortController();
        let cancelled = false;

        async function run() {
            setLoading(true);
            try {
                const res = await listProjects(
                    {
                        search: urlSearch || undefined,
                        page,
                        perPage,
                        status: urlStatus || undefined,
                        clientId: urlClientId ? Number(urlClientId) : undefined,
                    },
                    ac.signal,
                );
                if (cancelled) return;
                setProjects(res.data);
                setMeta(res.meta);
            } catch (err) {
                if (cancelled) return;
                toastError(err);
                setProjects([]);
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
    }, [urlSearch, page, perPage, urlStatus, urlClientId, reloadTick]);

    function reload() {
        setReloadTick((n) => n + 1);
    }

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

    function setPage(next: number) {
        patchParams({
            page: String(next),
            per_page: String(perPage),
            search: urlSearch || null,
            status: urlStatus || null,
            client_id: urlClientId || null,
        });
    }

    function openAdd() {
        setSheetMode('add');
        setEditing(null);
        setSheetOpen(true);
    }

    function openEdit(project: Project) {
        setSheetMode('edit');
        setEditing(project);
        setSheetOpen(true);
    }

    async function handleSave(data: ProjectInput) {
        if (sheetMode === 'edit' && editing) {
            await updateProject(editing.id, data);
            toastSuccess('Proyecto actualizado');
        } else {
            await createProject(data);
            toastSuccess('Proyecto creado');
        }
        reload();
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteProject(deleteTarget.id);
            setDeleteTarget(null);
            toastSuccess('Proyecto eliminado');
            reload();
        } catch (err) {
            toastError(err);
        } finally {
            setDeleting(false);
        }
    }

    const total = meta?.total ?? 0;
    const lastPage = meta?.last_page ?? 1;
    const currentPage = meta?.current_page ?? page;
    const canPrev = currentPage > 1;
    const canNext = currentPage < lastPage;

    return (
        <>
            <ListPageShell
                title="Proyectos"
                description="Proyectos ligados a clientes."
                icon={Folder}
                toolbar={
                    <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center">
                        <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Buscar por nombre o cliente…"
                                className="pl-9"
                                aria-label="Buscar proyectos"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                            <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="shrink-0">Estado</span>
                                <select
                                    value={urlStatus}
                                    onChange={(e) =>
                                        patchParams({
                                            status: e.target.value || null,
                                            page: '1',
                                            per_page: String(perPage),
                                            search: urlSearch || null,
                                            client_id: urlClientId || null,
                                        })
                                    }
                                    className={selectClass}
                                >
                                    <option value="">Todos</option>
                                    {PROJECT_STATUSES.map((s) => (
                                        <option key={s} value={s}>
                                            {PROJECT_STATUS_LABELS[s]}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="shrink-0">Cliente</span>
                                <select
                                    value={urlClientId}
                                    onChange={(e) =>
                                        patchParams({
                                            client_id: e.target.value || null,
                                            page: '1',
                                            per_page: String(perPage),
                                            search: urlSearch || null,
                                            status: urlStatus || null,
                                        })
                                    }
                                    className={selectClass}
                                >
                                    <option value="">Todos</option>
                                    {clients.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="shrink-0">Por página</span>
                                <select
                                    value={perPage}
                                    onChange={(e) =>
                                        patchParams({
                                            per_page: e.target.value,
                                            page: '1',
                                            search: urlSearch || null,
                                            status: urlStatus || null,
                                            client_id: urlClientId || null,
                                        })
                                    }
                                    className={selectClass}
                                >
                                    {PER_PAGE_OPTIONS.map((n) => (
                                        <option key={n} value={n}>
                                            {n}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <Button type="button" onClick={openAdd} className="w-full sm:w-auto">
                                <Plus />
                                Añadir proyecto
                            </Button>
                        </div>
                    </div>
                }
            >
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Nombre</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Prioridad</TableHead>
                                <TableHead>Fechas</TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading &&
                                projects.length === 0 &&
                                Array.from({ length: Math.min(perPage, 8) }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((__, j) => (
                                            <TableCell key={j}>
                                                <Skeleton className="h-4 w-full" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}

                            {!loading && total === 0 && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                        No hay proyectos. Añade el primero.
                                    </TableCell>
                                </TableRow>
                            )}

                            {projects.map((project) => (
                                <TableRow key={project.id} className={loading ? 'opacity-60' : undefined}>
                                    <TableCell className="font-medium text-foreground">
                                        <span className="inline-flex items-center gap-2">
                                            <span
                                                className="inline-block size-2.5 shrink-0 rounded-full border border-border"
                                                style={{
                                                    backgroundColor: project.color || 'var(--primary)',
                                                }}
                                                aria-hidden
                                            />
                                            <Link
                                                to={`/dashboard/projects/${project.id}`}
                                                className="cursor-pointer transition-colors duration-200 hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                                            >
                                                {project.name}
                                            </Link>
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{project.client?.name ?? '—'}</TableCell>
                                    <TableCell className="text-muted-foreground">{PROJECT_TYPE_LABELS[project.type]}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {PROJECT_STATUS_LABELS[project.status]}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {PROJECT_PRIORITY_LABELS[project.priority]}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-muted-foreground">
                                        {formatDates(project.startDate, project.endDate)}
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
                                                    onClick={() => navigate(`/dashboard/projects/${project.id}`)}
                                                >
                                                    <Eye />
                                                    Ver
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="cursor-pointer" onClick={() => openEdit(project)}>
                                                    <Pencil />
                                                    Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    className="cursor-pointer"
                                                    onClick={() => setDeleteTarget(project)}
                                                >
                                                    <Trash2 />
                                                    Eliminar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {total > 0 && (
                    <nav
                        aria-label="Paginación de proyectos"
                        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <p className="text-sm text-muted-foreground" aria-live="polite">
                            {meta?.from != null && meta.to != null ? `${meta.from}–${meta.to} de ${total}` : `${total} en total`}
                            <span className="mx-2 text-border">·</span>
                            Página {currentPage} de {lastPage}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="min-w-24"
                                disabled={!canPrev || loading}
                                onClick={() => setPage(currentPage - 1)}
                            >
                                <ChevronLeft />
                                Anterior
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="min-w-24"
                                disabled={!canNext || loading}
                                onClick={() => setPage(currentPage + 1)}
                            >
                                Siguiente
                                <ChevronRight />
                            </Button>
                        </div>
                    </nav>
                )}
            </ListPageShell>

            <ProjectSheet
                open={sheetOpen}
                mode={sheetMode}
                project={editing}
                onOpenChange={setSheetOpen}
                onSubmit={handleSave}
                defaultClientId={urlClientId ? Number(urlClientId) : undefined}
                clientOptions={clients}
            />

            <Dialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar proyecto</DialogTitle>
                        <DialogDescription>¿Eliminar «{deleteTarget?.name}»? Esta acción hace soft delete.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => setDeleteTarget(null)}
                            disabled={deleting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className="cursor-pointer"
                            onClick={() => void handleDelete()}
                            disabled={deleting}
                        >
                            {deleting ? 'Eliminando…' : 'Eliminar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
