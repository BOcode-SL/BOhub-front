import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListPageShell } from '@/components/list-page-shell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientSheet } from '@/pages/clients/ClientSheet';
import { useAuth } from '@/auth/AuthContext';
import {
    createClient,
    deleteClient,
    listClients,
    updateClient,
    type Client,
    type ClientInput,
    type ClientsMeta,
} from '@/lib/clients';
import { toastError, toastSuccess } from '@/lib/toast';
import { ToolbarSelect } from '@/components/toolbar-field';

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

export function ClientsPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [searchParams, setSearchParams] = useSearchParams();
    const page = parsePage(searchParams.get('page'));
    const perPage = parsePerPage(searchParams.get('per_page'));
    const urlSearch = searchParams.get('search') ?? '';

    const [searchInput, setSearchInput] = useState(urlSearch);
    const [clients, setClients] = useState<Client[]>([]);
    const [meta, setMeta] = useState<ClientsMeta | null>(null);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add');
    const [editing, setEditing] = useState<Client | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
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

    // ponytail: one abortable fetch; keep rows while paging (skeleton only if empty)
    useEffect(() => {
        const ac = new AbortController();
        let cancelled = false;

        async function run() {
            setLoading(true);
            try {
                const res = await listClients(
                    {
                        search: urlSearch || undefined,
                        page,
                        perPage,
                    },
                    ac.signal,
                );
                if (cancelled) return;
                setClients(res.data);
                setMeta(res.meta);
            } catch (err) {
                if (cancelled) return;
                toastError(err);
                setClients([]);
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
            const res = await listClients({
                search: urlSearch || undefined,
                page,
                perPage,
            });
            setClients(res.data);
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

    function openAdd() {
        setSheetMode('add');
        setEditing(null);
        setSheetOpen(true);
    }

    function openEdit(client: Client) {
        setSheetMode('edit');
        setEditing(client);
        setSheetOpen(true);
    }

    async function handleSave(data: ClientInput) {
        if (sheetMode === 'edit' && editing) {
            await updateClient(editing.id, data);
            toastSuccess('Cliente actualizado');
        } else {
            await createClient(data);
            toastSuccess('Cliente creado');
        }
        await reload();
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteClient(deleteTarget.id);
            setDeleteTarget(null);
            toastSuccess('Cliente eliminado');
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
                title="Clientes"
                description="Buscar y gestionar tus clientes"
                icon={Users}
                actions={
                    <Button type="button" onClick={openAdd}>
                        <Plus />
                        Añadir cliente
                    </Button>
                }
                toolbar={
                    <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-end">
                        <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Buscar por nombre, email, NIF o ciudad…"
                                className="pl-9"
                                aria-label="Buscar clientes"
                            />
                        </div>
                        <ToolbarSelect
                            id="clients-per-page"
                            label="Por página"
                            items={PER_PAGE_OPTIONS.map((n) => ({ label: String(n), value: String(n) }))}
                            value={String(perPage)}
                            onValueChange={(value) => {
                                if (value) setPerPage(Number(value));
                            }}
                        />
                    </div>
                }
            >
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Nombre</TableHead>
                                <TableHead>NIF/CIF</TableHead>
                                <TableHead>Teléfono</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Ciudad</TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading &&
                                clients.length === 0 &&
                                Array.from({ length: Math.min(perPage, 8) }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 6 }).map((__, j) => (
                                            <TableCell key={j}>
                                                <Skeleton className="h-4 w-full" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}

                            {!loading && total === 0 && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                        No hay clientes. Añade el primero.
                                    </TableCell>
                                </TableRow>
                            )}

                            {clients.map((client) => (
                                <TableRow key={client.id} className={loading ? 'opacity-60' : undefined}>
                                    <TableCell className="font-medium text-foreground">{client.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{client.taxId || '—'}</TableCell>
                                    <TableCell className="text-muted-foreground">{client.phone || '—'}</TableCell>
                                    <TableCell className="text-muted-foreground">{client.email || '—'}</TableCell>
                                    <TableCell className="text-muted-foreground">{client.city || '—'}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                                                <MoreHorizontal />
                                                <span className="sr-only">Acciones</span>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEdit(client)}>
                                                    <Pencil />
                                                    Editar
                                                </DropdownMenuItem>
                                                {isAdmin && (
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => setDeleteTarget(client)}
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
                        aria-label="Paginación de clientes"
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

            <ClientSheet open={sheetOpen} mode={sheetMode} client={editing} onOpenChange={setSheetOpen} onSubmit={handleSave} />

            <Dialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar cliente</DialogTitle>
                        <DialogDescription>¿Eliminar «{deleteTarget?.name}»? Esta acción hace soft delete.</DialogDescription>
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
