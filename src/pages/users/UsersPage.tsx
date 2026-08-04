import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Search, Trash2, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListPageShell } from '@/components/list-page-shell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserSheet } from '@/pages/users/UserSheet';
import {
    createUser,
    deleteUser,
    listUsers,
    updateUser,
    USER_ROLE_LABELS,
    type HubUser,
    type UserInput,
    type UsersMeta,
} from '@/lib/users';
import { toastError, toastSuccess } from '@/lib/toast';

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

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function UsersPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const page = parsePage(searchParams.get('page'));
    const perPage = parsePerPage(searchParams.get('per_page'));
    const urlSearch = searchParams.get('search') ?? '';

    const [searchInput, setSearchInput] = useState(urlSearch);
    const [users, setUsers] = useState<HubUser[]>([]);
    const [meta, setMeta] = useState<UsersMeta | null>(null);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add');
    const [editing, setEditing] = useState<HubUser | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<HubUser | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        setSearchInput(urlSearch);
    }, [urlSearch]);

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

    useEffect(() => {
        const ac = new AbortController();
        let cancelled = false;

        async function run() {
            setLoading(true);
            try {
                const res = await listUsers(
                    {
                        search: urlSearch || undefined,
                        page,
                        perPage,
                    },
                    ac.signal,
                );
                if (cancelled) return;
                setUsers(res.data);
                setMeta(res.meta);
            } catch (err) {
                if (cancelled) return;
                toastError(err);
                setUsers([]);
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
    }, [urlSearch, page, perPage]);

    async function reload() {
        setLoading(true);
        try {
            const res = await listUsers({
                search: urlSearch || undefined,
                page,
                perPage,
            });
            setUsers(res.data);
            setMeta(res.meta);
        } catch (err) {
            toastError(err);
        } finally {
            setLoading(false);
        }
    }

    function setPage(next: number) {
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.set('page', String(next));
            p.set('per_page', String(perPage));
            if (urlSearch) p.set('search', urlSearch);
            return p;
        });
    }

    function setPerPage(next: number) {
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.set('per_page', String(next));
            p.set('page', '1');
            if (urlSearch) p.set('search', urlSearch);
            return p;
        });
    }

    async function handleSave(data: UserInput) {
        if (sheetMode === 'edit' && editing) {
            await updateUser(editing.id, data);
            toastSuccess('Usuario actualizado');
        } else {
            await createUser(data);
            toastSuccess('Usuario creado');
        }
        await reload();
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteUser(deleteTarget.id);
            setDeleteTarget(null);
            toastSuccess('Usuario eliminado');
            await reload();
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
                title="Usuarios"
                description="Cuentas internas y roles de acceso"
                icon={UserCog}
                toolbar={
                    <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center">
                        <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Buscar por nombre o email…"
                                className="pl-9"
                                aria-label="Buscar usuarios"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                            <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="shrink-0">Por página</span>
                                <select
                                    value={perPage}
                                    onChange={(e) => setPerPage(Number(e.target.value))}
                                    className="h-9 rounded-md border border-border bg-input/30 px-2 text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                >
                                    {PER_PAGE_OPTIONS.map((n) => (
                                        <option key={n} value={n}>
                                            {n}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <Button
                                type="button"
                                onClick={() => {
                                    setSheetMode('add');
                                    setEditing(null);
                                    setSheetOpen(true);
                                }}
                                className="w-full sm:w-auto"
                            >
                                <Plus />
                                Añadir usuario
                            </Button>
                        </div>
                    </div>
                }
            >
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Usuario</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading &&
                                users.length === 0 &&
                                Array.from({ length: Math.min(perPage, 8) }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 4 }).map((__, j) => (
                                            <TableCell key={j}>
                                                <Skeleton className="h-4 w-full" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}

                            {!loading && total === 0 && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                        No hay usuarios. Añade el primero.
                                    </TableCell>
                                </TableRow>
                            )}

                            {users.map((row) => (
                                <TableRow key={row.id} className={loading ? 'opacity-60' : undefined}>
                                    <TableCell className="font-medium text-foreground">
                                        <span className="inline-flex items-center gap-2">
                                            <Avatar className="size-8 rounded-lg">
                                                {row.avatarUrl ? <AvatarImage src={row.avatarUrl} alt="" /> : null}
                                                <AvatarFallback className="rounded-lg bg-muted text-xs font-semibold">
                                                    {initials(row.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            {row.name}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{row.email}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {USER_ROLE_LABELS[row.role] ?? row.role}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                                                <MoreHorizontal />
                                                <span className="sr-only">Acciones</span>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSheetMode('edit');
                                                        setEditing(row);
                                                        setSheetOpen(true);
                                                    }}
                                                >
                                                    <Pencil />
                                                    Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => setDeleteTarget(row)}
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
                        aria-label="Paginación de usuarios"
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

            <UserSheet open={sheetOpen} mode={sheetMode} user={editing} onOpenChange={setSheetOpen} onSubmit={handleSave} />

            <Dialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar usuario</DialogTitle>
                        <DialogDescription>¿Eliminar «{deleteTarget?.name}»? Esta acción no se puede deshacer.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                            Cancelar
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
                            {deleting ? 'Eliminando…' : 'Eliminar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
