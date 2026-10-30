import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListPageShell } from '@/components/list-page-shell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ToolbarField, ToolbarSelect } from '@/components/toolbar-field';
import { cn } from '@/lib/utils';
import {
    SUBSCRIPTION_CATEGORIES,
    SUBSCRIPTION_CATEGORY_LABELS,
    SUBSCRIPTION_STATUS_BADGE_CLASS,
    SUBSCRIPTION_STATUS_LABELS,
    createSubscription,
    daysUntilRenewsOn,
    deleteSubscription,
    displaySubscriptionStatus,
    EXPIRING_BADGE_CLASS,
    formatRenewalPrice,
    listSubscriptions,
    updateSubscription,
    type Subscription,
    type SubscriptionCategory,
    type SubscriptionInput,
    type SubscriptionMeta,
} from '@/lib/subscriptions';
import { toastError, toastSuccess } from '@/lib/toast';
import { SubscriptionSheet } from '@/pages/subscriptions/SubscriptionSheet';

const PER_PAGE = 15;
type SubTab = 'open' | 'history';

function parsePage(v: string | null) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parseTab(scope: string | null): SubTab {
    return scope === 'history' ? 'history' : 'open';
}

function RenewsOnCell({ renewsOn, status }: { renewsOn: string; status: string }) {
    const days = daysUntilRenewsOn(renewsOn);
    const soon = days != null && days >= 0 && days <= 30 && status === 'active';

    return (
        <div className="flex flex-col gap-0.5">
            <span className={cn('text-foreground', soon && 'font-medium')}>{renewsOn}</span>
            {soon && (
                <span className="text-xs text-amber-300">
                    {days === 0 ? 'Renueva hoy' : days === 1 ? '1 día' : `${days} días`}
                </span>
            )}
        </div>
    );
}

function StatusBadge({ row }: { row: Subscription }) {
    const display = displaySubscriptionStatus(row.status, row.renewsOn);
    if (display === 'expiring') {
        return <Badge className={EXPIRING_BADGE_CLASS}>Expira pronto</Badge>;
    }
    return (
        <Badge className={SUBSCRIPTION_STATUS_BADGE_CLASS[display]}>
            {SUBSCRIPTION_STATUS_LABELS[display]}
        </Badge>
    );
}

export function SubscriptionsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const page = parsePage(searchParams.get('page'));
    const tab = parseTab(searchParams.get('scope'));
    const urlCategory = searchParams.get('category') ?? '';
    const urlSearch = searchParams.get('search') ?? '';

    const filterKey = `${tab}|${urlCategory}|${urlSearch}`;

    const [rows, setRows] = useState<Subscription[]>([]);
    const [meta, setMeta] = useState<SubscriptionMeta | null>(null);
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);
    const [searchDraft, setSearchDraft] = useState(urlSearch);

    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add');
    const [editing, setEditing] = useState<Subscription | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Subscription | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        setSearchDraft(urlSearch);
    }, [urlSearch]);

    useEffect(() => {
        const t = window.setTimeout(() => {
            if (searchDraft === urlSearch) return;
            setSearchParams(
                (prev) => {
                    const p = new URLSearchParams(prev);
                    if (!searchDraft.trim()) p.delete('search');
                    else p.set('search', searchDraft.trim());
                    p.set('page', '1');
                    return p;
                },
                { replace: true },
            );
        }, 300);
        return () => window.clearTimeout(t);
    }, [searchDraft, urlSearch, setSearchParams]);

    useEffect(() => {
        const [tabRaw, category, search] = filterKey.split('|');
        const scope = tabRaw === 'history' ? 'history' : 'open';
        const ac = new AbortController();
        let cancelled = false;
        async function run() {
            setLoading(true);
            try {
                const res = await listSubscriptions(
                    {
                        page,
                        perPage: PER_PAGE,
                        scope,
                        category:
                            category && (SUBSCRIPTION_CATEGORIES as readonly string[]).includes(category)
                                ? (category as SubscriptionCategory)
                                : undefined,
                        search: search || undefined,
                        sort: scope === 'history' ? '-renews_on' : 'renews_on',
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

    function setTab(next: SubTab) {
        patch({ scope: next === 'history' ? 'history' : 'open' });
    }

    async function handleSave(data: SubscriptionInput) {
        if (sheetMode === 'edit' && editing) {
            await updateSubscription(editing.id, data);
            toastSuccess('Suscripción actualizada');
        } else {
            await createSubscription(data);
            toastSuccess('Suscripción creada');
        }
        setTick((n) => n + 1);
    }

    async function handleCancel(row: Subscription) {
        try {
            await updateSubscription(row.id, { status: 'cancelled' });
            toastSuccess('Suscripción cancelada');
            setTick((n) => n + 1);
        } catch (err) {
            toastError(err);
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteSubscription(deleteTarget.id);
            setDeleteTarget(null);
            toastSuccess('Suscripción eliminada');
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
                title="Suscripciones"
                description="Dominios, hosting y SaaS. Alertas 3/2/1 mes antes de renovar."
                icon={Repeat}
                above={
                    <nav aria-label="Secciones de suscripciones" className="flex flex-wrap gap-2 border-b border-border pb-3">
                        {(
                            [
                                { id: 'open' as const, label: 'Activas' },
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
                        className="w-full sm:w-auto"
                        onClick={() => {
                            setSheetMode('add');
                            setEditing(null);
                            setSheetOpen(true);
                        }}
                    >
                        <Plus />
                        Añadir suscripción
                    </Button>
                }
                toolbar={
                    <div className="flex flex-col gap-2 py-1 sm:flex-row sm:flex-wrap sm:items-end">
                        <ToolbarField id="sub-search" label="Buscar" className="w-full sm:w-auto">
                            <Input
                                id="sub-search"
                                value={searchDraft}
                                onChange={(e) => setSearchDraft(e.target.value)}
                                placeholder="Nombre, recurso, proveedor…"
                                className="min-w-0 w-full bg-card sm:min-w-56 sm:w-auto"
                            />
                        </ToolbarField>
                        <ToolbarSelect
                            id="sub-category"
                            label="Categoría"
                            fieldClassName="w-full sm:w-auto"
                            items={[
                                { label: 'Todas', value: null },
                                ...SUBSCRIPTION_CATEGORIES.map((c) => ({
                                    label: SUBSCRIPTION_CATEGORY_LABELS[c],
                                    value: c,
                                })),
                            ]}
                            value={urlCategory || null}
                            onValueChange={(value) => patch({ category: value })}
                            className="min-w-40"
                        />
                    </div>
                }
            >
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Suscripción</TableHead>
                                <TableHead className="hidden sm:table-cell">Precio renovación</TableHead>
                                <TableHead className="hidden md:table-cell">Auto-renov.</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading &&
                                rows.length === 0 &&
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell>
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-16" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-8" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            {!loading && rows.length === 0 && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        {tab === 'history'
                                            ? 'No hay suscripciones en el historial.'
                                            : 'No hay suscripciones activas.'}
                                    </TableCell>
                                </TableRow>
                            )}
                            {rows.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell>
                                        <div className="flex min-w-0 flex-col gap-0.5">
                                            <span className="truncate font-medium">{row.name}</span>
                                            <span className="truncate text-xs text-muted-foreground">
                                                {[row.resource, row.provider].filter(Boolean).join(' · ') || '—'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">
                                        {formatRenewalPrice(row.renewalPrice, row.currency)}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        {row.autoRenew ? 'Sí' : 'No'}
                                    </TableCell>
                                    <TableCell>
                                        <RenewsOnCell renewsOn={row.renewsOn} status={row.status} />
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge row={row} />
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
                                                    onClick={() => {
                                                        setSheetMode('edit');
                                                        setEditing(row);
                                                        setSheetOpen(true);
                                                    }}
                                                >
                                                    <Pencil className="size-4" />
                                                    Editar
                                                </DropdownMenuItem>
                                                {row.status !== 'cancelled' && (
                                                    <DropdownMenuItem onClick={() => void handleCancel(row)}>
                                                        Cancelar
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => setDeleteTarget(row)}
                                                >
                                                    <Trash2 className="size-4" />
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

                {meta && lastPage > 1 && (
                    <div className="flex items-center justify-between gap-2 pt-3">
                        <p className="text-sm text-muted-foreground">
                            {meta.from ?? 0}–{meta.to ?? 0} de {meta.total}
                        </p>
                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={currentPage <= 1}
                                onClick={() => patch({ page: String(currentPage - 1) })}
                            >
                                <ChevronLeft className="size-4" />
                            </Button>
                            <span className="px-2 text-sm tabular-nums">
                                {currentPage}/{lastPage}
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={currentPage >= lastPage}
                                onClick={() => patch({ page: String(currentPage + 1) })}
                            >
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </ListPageShell>

            <SubscriptionSheet
                open={sheetOpen}
                mode={sheetMode}
                subscription={editing}
                onOpenChange={setSheetOpen}
                onSubmit={handleSave}
                onLinked={(row) => {
                    setEditing(row);
                    setTick((n) => n + 1);
                }}
            />

            <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar suscripción</DialogTitle>
                        <DialogDescription>
                            ¿Eliminar «{deleteTarget?.name}»? Esta acción no se puede deshacer fácilmente.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={deleting}
                            onClick={() => void confirmDelete()}
                        >
                            {deleting ? 'Eliminando…' : 'Eliminar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
