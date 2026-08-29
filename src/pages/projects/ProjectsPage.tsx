import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, Folder, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ListPageShell } from '@/components/list-page-shell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
    PROJECT_PRIORITY_BADGE_CLASS,
    PROJECT_PRIORITY_LABELS,
    PROJECT_STATUSES,
    PROJECT_STATUS_BADGE_CLASS,
    PROJECT_STATUS_LABELS,
    PROJECT_TYPE_LABELS,
    createProject,
    deleteProject,
    listProjects,
    syncProjectsFromJiraBatch,
    updateProject,
    type Project,
    type ProjectInput,
    type ProjectsMeta,
} from '@/lib/projects';
import { toastError, toastSuccess } from '@/lib/toast';
import { ToolbarSelect } from '@/components/toolbar-field';
import { ProjectSheet } from '@/pages/projects/ProjectSheet';

const PER_PAGE_OPTIONS = [10, 15, 25] as const;
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

function formatEndDate(end: string | null): string {
    return end || '—';
}

export function ProjectsPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [searchParams, setSearchParams] = useSearchParams();
    const page = parsePage(searchParams.get('page'));
    const perPage = parsePerPage(searchParams.get('per_page'));
    const urlSearch = searchParams.get('search') ?? '';
    const urlStatus = searchParams.get('status') ?? '';
    const urlHasEndDate = searchParams.get('has_end_date') ?? '';

    const [searchInput, setSearchInput] = useState(urlSearch);
    const [projects, setProjects] = useState<Project[]>([]);
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

    // ponytail: background Jira sync — refetch list only when rows changed
    useEffect(() => {
        let cancelled = false;
        void syncProjectsFromJiraBatch().then((result) => {
            if (!cancelled && result && result.updated > 0) {
                setReloadTick((n) => n + 1);
            }
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
                        hasEndDate: urlHasEndDate || undefined,
                        sort: 'status',
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
    }, [urlSearch, page, perPage, urlStatus, urlHasEndDate, reloadTick]);

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
            has_end_date: urlHasEndDate || null,
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
                actions={
                    <Button type="button" className="w-full sm:w-auto" onClick={openAdd}>
                        <Plus />
                        Añadir proyecto
                    </Button>
                }
                toolbar={
                    <div className="flex flex-col gap-2 py-1 sm:flex-row sm:flex-wrap sm:items-end">
                        <div className="relative min-w-0 w-full flex-1 sm:w-auto">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Buscar por nombre o cliente…"
                                className="pl-9"
                                aria-label="Buscar proyectos"
                            />
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                            <ToolbarSelect
                                id="projects-status"
                                label="Estado"
                                fieldClassName="w-full sm:w-auto"
                                items={[
                                    { label: 'Todos', value: null },
                                    ...PROJECT_STATUSES.map((status) => ({
                                        label: PROJECT_STATUS_LABELS[status],
                                        value: status,
                                    })),
                                ]}
                                value={urlStatus || null}
                                onValueChange={(value) =>
                                    patchParams({
                                        status: value,
                                        page: '1',
                                        per_page: String(perPage),
                                        search: urlSearch || null,
                                        has_end_date: urlHasEndDate || null,
                                    })
                                }
                                className="min-w-40"
                            />
                            <div className="grid w-full grid-cols-2 gap-2 sm:contents">
                                <ToolbarSelect
                                    id="projects-has-end-date"
                                    label="Fecha de fin"
                                    fieldClassName="w-full sm:w-auto"
                                    items={[
                                        { label: 'Cualquier fecha', value: null },
                                        { label: 'Con fecha de fin', value: '1' },
                                    ]}
                                    value={urlHasEndDate || null}
                                    onValueChange={(value) =>
                                        patchParams({
                                            has_end_date: value,
                                            page: '1',
                                            per_page: String(perPage),
                                            search: urlSearch || null,
                                            status: urlStatus || null,
                                        })
                                    }
                                    placeholder="Fecha de fin"
                                    className="min-w-40"
                                />
                                <ToolbarSelect
                                    id="projects-per-page"
                                    label="Por página"
                                    fieldClassName="w-full sm:w-auto"
                                    items={PER_PAGE_OPTIONS.map((n) => ({ label: String(n), value: String(n) }))}
                                    value={String(perPage)}
                                    onValueChange={(value) => {
                                        if (!value) return;
                                        patchParams({
                                            per_page: value,
                                            page: '1',
                                            search: urlSearch || null,
                                            status: urlStatus || null,
                                            has_end_date: urlHasEndDate || null,
                                        });
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                }
            >
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Nombre</TableHead>
                                <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                                <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="hidden md:table-cell">Prioridad</TableHead>
                                <TableHead className="hidden md:table-cell">Fin</TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading &&
                                projects.length === 0 &&
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
                                        <TableCell className="hidden md:table-cell">
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-8" />
                                        </TableCell>
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
                                    <TableCell className="max-w-[10rem] font-medium text-foreground sm:max-w-[14rem]">
                                        <div className="min-w-0">
                                            <span className="inline-flex max-w-full items-center gap-2">
                                                <span
                                                    className="inline-block size-2.5 shrink-0 rounded-full border border-border"
                                                    style={{
                                                        backgroundColor: project.color || 'var(--primary)',
                                                    }}
                                                    aria-hidden
                                                />
                                                <Link
                                                    to={`/dashboard/projects/${project.id}`}
                                                    className="truncate cursor-pointer transition-colors duration-200 hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                                                    title={project.name}
                                                >
                                                    {project.name}
                                                </Link>
                                            </span>
                                            <p className="truncate text-xs text-muted-foreground sm:hidden" title={project.client?.name ?? undefined}>
                                                {project.client?.name ?? '—'}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell
                                        className="hidden max-w-[8rem] truncate text-muted-foreground sm:table-cell sm:max-w-[12rem]"
                                        title={project.client?.name ?? undefined}
                                    >
                                        {project.client?.name ?? '—'}
                                    </TableCell>
                                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                                        {PROJECT_TYPE_LABELS[project.type]}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={PROJECT_STATUS_BADGE_CLASS[project.status]}>
                                            {PROJECT_STATUS_LABELS[project.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <Badge
                                            variant="outline"
                                            className={PROJECT_PRIORITY_BADGE_CLASS[project.priority]}
                                        >
                                            {PROJECT_PRIORITY_LABELS[project.priority]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <Badge variant="outline" className="whitespace-nowrap">
                                            {formatEndDate(project.endDate)}
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
                                                    onClick={() => navigate(`/dashboard/projects/${project.id}`)}
                                                >
                                                    <Eye />
                                                    Ver
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="cursor-pointer" onClick={() => openEdit(project)}>
                                                    <Pencil />
                                                    Editar
                                                </DropdownMenuItem>
                                                {isAdmin && (
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        className="cursor-pointer"
                                                        onClick={() => setDeleteTarget(project)}
                                                    >
                                                        <Trash2 />
                                                        Eliminar
                                                    </DropdownMenuItem>
                                                )}
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
                        <DialogDescription>
                            ¿Eliminar «{deleteTarget?.name}» de BOhub? Soft delete local. La tarea vinculada en Jira no se
                            elimina ni se modifica.
                        </DialogDescription>
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
