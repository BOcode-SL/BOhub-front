import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FilePen, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListPageShell } from '@/components/list-page-shell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ToolbarSelect } from '@/components/toolbar-field';
import { ContractNewSheet } from '@/pages/contracts/ContractNewSheet';
import { ContractTabs } from '@/pages/contracts/ContractTabs';
import {
    CONTRACT_STATUSES,
    CONTRACT_STATUS_BADGE_CLASS,
    CONTRACT_STATUS_LABELS,
    createContract,
    deleteContract,
    listContracts,
    type Contract,
    type ContractInput,
    type ContractsMeta,
} from '@/lib/contracts';
import { toastError, toastSuccess } from '@/lib/toast';

const PER_PAGE_OPTIONS = [10, 15, 25] as const;

function parsePage(value: string | null): number {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parsePerPage(value: string | null): number {
    const n = Number(value);
    if (PER_PAGE_OPTIONS.includes(n as (typeof PER_PAGE_OPTIONS)[number])) return n;
    return 15;
}

function formatDay(iso: string | null | undefined): string {
    if (!iso) return '—';
    return iso.slice(0, 10);
}

export function ContractsPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const page = parsePage(searchParams.get('page'));
    const perPage = parsePerPage(searchParams.get('per_page'));
    const urlSearch = searchParams.get('search') ?? '';
    const urlStatus = searchParams.get('status') ?? '';

    const [searchInput, setSearchInput] = useState(urlSearch);
    const [rows, setRows] = useState<Contract[]>([]);
    const [meta, setMeta] = useState<ContractsMeta | null>(null);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
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
                const res = await listContracts(
                    {
                        search: urlSearch || undefined,
                        status: urlStatus || undefined,
                        page,
                        perPage,
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
    }, [urlSearch, urlStatus, page, perPage]);

    function patchParams(next: Record<string, string | null>) {
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            for (const [k, v] of Object.entries(next)) {
                if (v) p.set(k, v);
                else p.delete(k);
            }
            return p;
        });
    }

    async function handleCreate(data: ContractInput) {
        const created = await createContract(data);
        setSheetOpen(false);
        toastSuccess('Contrato creado');
        navigate(`/dashboard/contracts/${created.id}`);
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteContract(deleteTarget.id);
            setDeleteTarget(null);
            toastSuccess('Contrato eliminado');
            const res = await listContracts({
                search: urlSearch || undefined,
                status: urlStatus || undefined,
                page,
                perPage,
            });
            setRows(res.data);
            setMeta(res.meta);
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
                title="Contratos"
                description="Sobres de firma electrónica SES"
                icon={FilePen}
                above={<ContractTabs />}
                actions={
                    <Button type="button" onClick={() => setSheetOpen(true)}>
                        <Plus />
                        Nuevo contrato
                    </Button>
                }
                toolbar={
                    <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-end">
                        <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Buscar por título…"
                                className="pl-9"
                                aria-label="Buscar contratos"
                            />
                        </div>
                        <ToolbarSelect
                            id="contracts-status"
                            label="Estado"
                            items={[
                                { label: 'Todos', value: null },
                                ...CONTRACT_STATUSES.map((s) => ({ label: CONTRACT_STATUS_LABELS[s], value: s })),
                            ]}
                            value={urlStatus || null}
                            onValueChange={(value) =>
                                patchParams({ status: value, page: '1', per_page: String(perPage), search: urlSearch || null })
                            }
                            className="min-w-40"
                        />
                        <ToolbarSelect
                            id="contracts-per-page"
                            label="Por página"
                            items={PER_PAGE_OPTIONS.map((n) => ({ label: String(n), value: String(n) }))}
                            value={String(perPage)}
                            onValueChange={(value) => {
                                if (value) patchParams({ per_page: value, page: '1', search: urlSearch || null, status: urlStatus || null });
                            }}
                        />
                    </div>
                }
            >
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Título</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="hidden sm:table-cell">Docs</TableHead>
                                <TableHead className="hidden sm:table-cell">Firmantes</TableHead>
                                <TableHead className="hidden md:table-cell">Caducidad</TableHead>
                                <TableHead className="hidden md:table-cell">Enviado</TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading &&
                                rows.length === 0 &&
                                Array.from({ length: Math.min(perPage, 8) }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 8 }).map((_, j) => (
                                            <TableCell key={j} className={j >= 3 && j <= 6 ? 'hidden sm:table-cell' : undefined}>
                                                <Skeleton className="h-4 w-full" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            {!loading && total === 0 && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                        No hay contratos. Crea el primero.
                                    </TableCell>
                                </TableRow>
                            )}
                            {rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className={loading ? 'opacity-60' : 'cursor-pointer'}
                                    onClick={() => navigate(`/dashboard/contracts/${row.id}`)}
                                >
                                    <TableCell className="font-medium">{row.title}</TableCell>
                                    <TableCell>{row.client?.name ?? '—'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={CONTRACT_STATUS_BADGE_CLASS[row.status]}>
                                            {CONTRACT_STATUS_LABELS[row.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">{row.documentCount ?? '—'}</TableCell>
                                    <TableCell className="hidden sm:table-cell">{row.signerCount ?? '—'}</TableCell>
                                    <TableCell className="hidden md:table-cell">{formatDay(row.expiresAt)}</TableCell>
                                    <TableCell className="hidden md:table-cell">{formatDay(row.sentAt)}</TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        {(row.status === 'draft' || row.status === 'cancelled') && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-xs" />}>
                                                    <MoreHorizontal />
                                                    <span className="sr-only">Acciones</span>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={() => setDeleteTarget(row)}>
                                                        <Trash2 />
                                                        Eliminar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {total > 0 && (
                    <nav aria-label="Paginación de contratos" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                                onClick={() => patchParams({ page: String(currentPage - 1) })}
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
                                onClick={() => patchParams({ page: String(currentPage + 1) })}
                            >
                                Siguiente
                                <ChevronRight />
                            </Button>
                        </div>
                    </nav>
                )}
            </ListPageShell>

            <ContractNewSheet open={sheetOpen} onOpenChange={setSheetOpen} onSubmit={handleCreate} />

            <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar contrato</DialogTitle>
                        <DialogDescription>¿Eliminar «{deleteTarget?.title}»?</DialogDescription>
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
