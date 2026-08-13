import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    ChevronLeft,
    ChevronRight,
    CircleCheck,
    Download,
    Eye,
    FileWarning,
    Mail,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    Trash2,
    type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListPageShell } from '@/components/list-page-shell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { LedgerStatusBadge } from '@/components/ledger-status-badge';
import { Badge } from '@/components/ui/badge';
import {
    INVOICE_FILTERS,
    INVOICE_FILTER_LABELS,
    LEDGER_STATUSES,
    LEDGER_STATUS_LABELS,
    PAYROLL_STATUS_LABELS,
    downloadExpenseFile,
    downloadPaymentInvoice,
    formatMoney,
    isPaymentIssued,
    isPaymentWithoutInvoice,
    type InvoiceFilter,
    type InvoiceMode,
    type PayrollStatus,
    type BillingMeta,
    type LedgerStatus,
} from '@/lib/billing';
import { toastError, toastSuccess } from '@/lib/toast';
import { ToolbarSelect } from '@/components/toolbar-field';
import { BillingTabs } from '@/pages/billing/BillingTabs';
import { EmitPaymentDialog } from '@/pages/billing/EmitPaymentDialog';
import { ConfirmWithoutInvoiceDialog } from '@/pages/billing/ConfirmWithoutInvoiceDialog';
import { SendInvoiceDialog } from '@/pages/billing/SendInvoiceDialog';
import { useAuth } from '@/auth/AuthContext';
import { cn } from '@/lib/utils';
import type { Payment } from '@/lib/billing';

const PER_PAGE_OPTIONS = [10, 15, 25] as const;
function parsePage(v: string | null) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
function parsePerPage(v: string | null) {
    const n = Number(v);
    return PER_PAGE_OPTIONS.includes(n as (typeof PER_PAGE_OPTIONS)[number]) ? n : 15;
}

export type LedgerRowBase = {
    id: number;
    totalAmount: string;
    baseAmount?: string;
    status: LedgerStatus;
    invoiceUrl: string | null;
    invoiceNumber?: string | null;
    invoiceMode?: InvoiceMode;
    lastPaymentDate?: string | null;
    paymentDate?: string | null;
    /** Gastos (y list ingresos): R2 key; null/empty = sin archivo */
    storageKey?: string | null;
    fileName?: string | null;
    description?: string | null;
    recipient?: string | null;
    project?: {
        id: number;
        name: string;
        client?: { id: number; name: string } | null;
    } | null;
};

export type LedgerListConfig<TRow extends LedgerRowBase, TInput> = {
    title: string;
    description: string;
    icon: LucideIcon;
    searchPlaceholder: string;
    searchAriaLabel: string;
    addLabel: string;
    emptyLabel: string;
    deleteTitle: string;
    paginationAriaLabel: string;
    successCreate: string;
    successUpdate: string;
    successDelete: string;
    /** Default ledger (ingresos/gastos). `payroll` = compact columns. */
    layout?: 'ledger' | 'payroll';
    titleColumnHeader?: string;
    /** Ingresos: Emitir + PDF + delete solo draft */
    invoiceActions?: boolean;
    list: (
        params: {
            search?: string;
            page?: number;
            perPage?: number;
            status?: string;
            invoiceFilter?: string;
        },
        signal?: AbortSignal,
    ) => Promise<{ data: TRow[]; meta: BillingMeta }>;
    create: (data: TInput) => Promise<unknown>;
    update: (id: number, data: TInput) => Promise<unknown>;
    remove: (id: number) => Promise<void>;
    rowDate: (row: TRow) => string | null;
    rowTitle?: (row: TRow) => ReactNode;
    renderSheet: (props: {
        open: boolean;
        mode: 'add' | 'edit' | 'view';
        editing: TRow | null;
        onOpenChange: (open: boolean) => void;
        onSubmit: (data: TInput) => Promise<void>;
        onReload: () => void;
        onSendInvoice?: () => void;
    }) => ReactNode;
};

export function LedgerListPage<TRow extends LedgerRowBase, TInput>({ config }: { config: LedgerListConfig<TRow, TInput> }) {
    const { user } = useAuth();
    const canMutate = user?.role === 'admin' || user?.role === 'billing';
    const [searchParams, setSearchParams] = useSearchParams();
    const page = parsePage(searchParams.get('page'));
    const perPage = parsePerPage(searchParams.get('per_page'));
    const urlSearch = searchParams.get('search') ?? '';
    const urlStatus = searchParams.get('status') ?? '';
    const urlInvoiceFilter = searchParams.get('invoice_filter') ?? '';

    const [searchInput, setSearchInput] = useState(urlSearch);
    const [rows, setRows] = useState<TRow[]>([]);
    const [meta, setMeta] = useState<BillingMeta | null>(null);
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetMode, setSheetMode] = useState<'add' | 'edit' | 'view'>('add');
    const [editing, setEditing] = useState<TRow | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<TRow | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [emitTarget, setEmitTarget] = useState<TRow | null>(null);
    const [confirmNoInvTarget, setConfirmNoInvTarget] = useState<TRow | null>(null);
    const [sendTarget, setSendTarget] = useState<TRow | null>(null);
    const [pdfBusyId, setPdfBusyId] = useState<number | null>(null);

    const {
        list,
        create,
        update,
        remove,
        rowDate,
        rowTitle,
        titleColumnHeader,
        renderSheet,
        title,
        description,
        icon,
        searchPlaceholder,
        searchAriaLabel,
        addLabel,
        emptyLabel,
        deleteTitle,
        paginationAriaLabel,
        successCreate,
        successUpdate,
        successDelete,
    } = config;
    const isPayrollLayout = config.layout === 'payroll';
    const invoiceActions = Boolean(config.invoiceActions);

    function reload() {
        setTick((t) => t + 1);
    }

    async function handleDownloadPdf(row: TRow) {
        setPdfBusyId(row.id);
        try {
            await downloadPaymentInvoice(row.id);
            toastSuccess(isPaymentIssued(row.status) ? 'PDF descargado' : 'Borrador PDF descargado');
        } catch (err) {
            toastError(err);
        } finally {
            setPdfBusyId(null);
        }
    }

    async function handleDownloadExpenseFile(row: TRow) {
        setPdfBusyId(row.id);
        try {
            await downloadExpenseFile(row.id, row.fileName ?? `gasto-${row.id}`);
            toastSuccess('PDF descargado');
        } catch (err) {
            toastError(err);
        } finally {
            setPdfBusyId(null);
        }
    }

    useEffect(() => {
        setSearchInput(urlSearch);
    }, [urlSearch]);

    // ponytail: API listPayrolls ignores status — drop leftover URL junk instead of a fake filter
    useEffect(() => {
        if (!isPayrollLayout || !searchParams.has('status')) return;
        setSearchParams(
            (prev) => {
                const p = new URLSearchParams(prev);
                p.delete('status');
                return p;
            },
            { replace: true },
        );
    }, [isPayrollLayout, searchParams, setSearchParams]);

    // Ingresos: filtro factura (no status ledger residual)
    useEffect(() => {
        if (!invoiceActions || !searchParams.has('status')) return;
        setSearchParams(
            (prev) => {
                const p = new URLSearchParams(prev);
                p.delete('status');
                return p;
            },
            { replace: true },
        );
    }, [invoiceActions, searchParams, setSearchParams]);

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
                const res = await list(
                    {
                        search: urlSearch || undefined,
                        page,
                        perPage,
                        status: invoiceActions || isPayrollLayout ? undefined : urlStatus || undefined,
                        invoiceFilter: invoiceActions ? urlInvoiceFilter || undefined : undefined,
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
    }, [urlSearch, page, perPage, urlStatus, urlInvoiceFilter, tick, list, isPayrollLayout, invoiceActions]);

    function patch(next: Record<string, string | null>) {
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            for (const [k, v] of Object.entries(next)) {
                if (v == null || v === '') p.delete(k);
                else p.set(k, v);
            }
            return p;
        });
    }

    async function handleSave(data: TInput) {
        if (sheetMode === 'view') return;
        if (sheetMode === 'edit' && editing) {
            await update(editing.id, data);
            toastSuccess(successUpdate);
        } else {
            await create(data);
            toastSuccess(successCreate);
        }
        setTick((n) => n + 1);
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await remove(deleteTarget.id);
            setDeleteTarget(null);
            toastSuccess(successDelete);
            setTick((n) => n + 1);
        } catch (err) {
            toastError(err);
        } finally {
            setDeleting(false);
        }
    }

    const total = meta?.total ?? 0;
    const lastPage = meta?.last_page ?? 1;
    const currentPage = meta?.current_page ?? page;

    return (
        <>
            <ListPageShell
                title={title}
                description={description}
                icon={icon}
                above={<BillingTabs />}
                actions={
                    canMutate ? (
                        <Button
                            type="button"
                            onClick={() => {
                                setSheetMode('add');
                                setEditing(null);
                                setSheetOpen(true);
                            }}
                        >
                            <Plus />
                            {addLabel}
                        </Button>
                    ) : null
                }
                toolbar={
                    <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-end">
                        <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="pl-9"
                                aria-label={searchAriaLabel}
                            />
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                            {invoiceActions ? (
                                <ToolbarSelect
                                    id="invoice-filter"
                                    label="Factura"
                                    items={[
                                        { label: 'Todos', value: null },
                                        ...INVOICE_FILTERS.map((f) => ({
                                            label: INVOICE_FILTER_LABELS[f],
                                            value: f,
                                        })),
                                    ]}
                                    value={
                                        INVOICE_FILTERS.includes(urlInvoiceFilter as InvoiceFilter)
                                            ? urlInvoiceFilter
                                            : null
                                    }
                                    onValueChange={(value) => patch({ invoice_filter: value, page: '1' })}
                                />
                            ) : !isPayrollLayout ? (
                                <ToolbarSelect
                                    id="ledger-status"
                                    label="Estado"
                                    items={[
                                        { label: 'Todos', value: null },
                                        ...LEDGER_STATUSES.map((status) => ({
                                            label: LEDGER_STATUS_LABELS[status],
                                            value: status,
                                        })),
                                    ]}
                                    value={urlStatus || null}
                                    onValueChange={(value) => patch({ status: value, page: '1' })}
                                />
                            ) : null}
                            <ToolbarSelect
                                id="ledger-per-page"
                                label="Por página"
                                items={PER_PAGE_OPTIONS.map((n) => ({ label: String(n), value: String(n) }))}
                                value={String(perPage)}
                                onValueChange={(value) => {
                                    if (value) patch({ per_page: value, page: '1' });
                                }}
                            />
                        </div>
                    </div>
                }
            >
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                {isPayrollLayout ? (
                                    <>
                                        <TableHead>Periodo</TableHead>
                                        <TableHead>{titleColumnHeader ?? 'Empleado'}</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="w-12" />
                                    </>
                                ) : invoiceActions ? (
                                    <>
                                        <TableHead>Nº Factura</TableHead>
                                        <TableHead>F. Factura</TableHead>
                                        <TableHead>Proyecto</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="hidden md:table-cell">F. Último Pago</TableHead>
                                        <TableHead className="hidden sm:table-cell text-right">Base</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="w-12" />
                                    </>
                                ) : (
                                    <>
                                        <TableHead>F. Factura</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead>Proveedor</TableHead>
                                        <TableHead className="hidden sm:table-cell">Proyecto</TableHead>
                                        <TableHead className="hidden md:table-cell">F. Último Pago</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="hidden sm:table-cell text-right">Base</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="w-12" />
                                    </>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading &&
                                rows.length === 0 &&
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {isPayrollLayout ? (
                                            <>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-8" />
                                                </TableCell>
                                            </>
                                        ) : invoiceActions ? (
                                            <>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-16" />
                                                </TableCell>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell">
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-8" />
                                                </TableCell>
                                            </>
                                        ) : (
                                            <>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
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
                                                <TableCell className="hidden sm:table-cell">
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-full" />
                                                </TableCell>
                                                <TableCell>
                                                    <Skeleton className="h-4 w-8" />
                                                </TableCell>
                                            </>
                                        )}
                                    </TableRow>
                                ))}
                            {!loading && total === 0 && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell
                                        colSpan={isPayrollLayout ? 5 : invoiceActions ? 8 : 9}
                                        className="h-32 text-center text-muted-foreground"
                                    >
                                        {emptyLabel}
                                    </TableCell>
                                </TableRow>
                            )}
                            {rows.map((row) => (
                                <TableRow key={row.id} className={loading ? 'opacity-60' : undefined}>
                                    {isPayrollLayout ? (
                                        <>
                                            <TableCell className="text-muted-foreground">{rowDate(row) || '—'}</TableCell>
                                            <TableCell className="max-w-[12rem] min-w-0 font-medium text-foreground sm:max-w-[18rem]">
                                                <div className="min-w-0 truncate">{rowTitle?.(row)}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        'w-fit font-normal',
                                                        row.status === 'paid'
                                                            ? 'border-transparent bg-emerald-500/20 text-emerald-300'
                                                            : row.status === 'pending'
                                                              ? 'border-transparent bg-amber-500/20 text-amber-300'
                                                              : 'border-transparent bg-muted text-muted-foreground',
                                                    )}
                                                >
                                                    {PAYROLL_STATUS_LABELS[row.status as PayrollStatus] ?? '—'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-foreground">
                                                {formatMoney(row.totalAmount)}
                                            </TableCell>
                                        </>
                                    ) : invoiceActions ? (
                                        <>
                                            <TableCell className="font-mono text-foreground whitespace-nowrap">
                                                {isPaymentWithoutInvoice(row)
                                                    ? '—'
                                                    : row.invoiceNumber?.trim() || '—'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground whitespace-nowrap">
                                                {rowDate(row) || '—'}
                                            </TableCell>
                                            <TableCell
                                                className="max-w-[10rem] truncate text-muted-foreground sm:max-w-[14rem]"
                                                title={row.project?.name || undefined}
                                            >
                                                {row.project?.name || '—'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <LedgerStatusBadge status={row.status} />
                                                    {isPaymentWithoutInvoice(row) ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-transparent bg-muted font-normal text-muted-foreground"
                                                        >
                                                            Sin factura
                                                        </Badge>
                                                    ) : null}
                                                    {isPaymentIssued(row.status) &&
                                                    !isPaymentWithoutInvoice(row) &&
                                                    !row.storageKey?.trim() ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-transparent bg-amber-500/15 font-normal text-amber-300"
                                                        >
                                                            Sin archivo
                                                        </Badge>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden text-muted-foreground md:table-cell whitespace-nowrap">
                                                {row.lastPaymentDate || row.paymentDate || '—'}
                                            </TableCell>
                                            <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                                                {formatMoney(row.baseAmount ?? 0)}
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-foreground">
                                                {formatMoney(row.totalAmount)}
                                            </TableCell>
                                        </>
                                    ) : (
                                        <>
                                            <TableCell className="text-muted-foreground whitespace-nowrap">
                                                {rowDate(row) || '—'}
                                            </TableCell>
                                            <TableCell
                                                className="max-w-[10rem] truncate font-medium text-foreground sm:max-w-[16rem]"
                                                title={row.description?.trim() || undefined}
                                            >
                                                {row.description?.trim() || '—'}
                                            </TableCell>
                                            <TableCell
                                                className="max-w-[8rem] truncate text-muted-foreground sm:max-w-[12rem]"
                                                title={row.recipient?.trim() || undefined}
                                            >
                                                {row.recipient?.trim() || '—'}
                                            </TableCell>
                                            <TableCell
                                                className="hidden max-w-[10rem] truncate text-muted-foreground sm:table-cell sm:max-w-[14rem]"
                                                title={row.project?.name || undefined}
                                            >
                                                {row.project?.name || '—'}
                                            </TableCell>
                                            <TableCell className="hidden text-muted-foreground md:table-cell whitespace-nowrap">
                                                {row.lastPaymentDate || row.paymentDate || '—'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <LedgerStatusBadge status={row.status} />
                                                    {!row.storageKey?.trim() ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-transparent bg-amber-500/15 font-normal text-amber-300"
                                                        >
                                                            Sin archivo
                                                        </Badge>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                                                {formatMoney(row.baseAmount ?? 0)}
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-foreground">
                                                {formatMoney(row.totalAmount)}
                                            </TableCell>
                                        </>
                                    )}
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger
                                                render={<Button variant="ghost" size="icon-sm" className="cursor-pointer" />}
                                            >
                                                <MoreHorizontal />
                                                <span className="sr-only">Acciones</span>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {canMutate ? (
                                                    <>
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
                                                        {invoiceActions && row.status === 'draft' && !isPaymentWithoutInvoice(row) ? (
                                                            <DropdownMenuItem
                                                                className="cursor-pointer"
                                                                onClick={() => setEmitTarget(row)}
                                                            >
                                                                <FileWarning />
                                                                Emitir factura
                                                            </DropdownMenuItem>
                                                        ) : null}
                                                        {invoiceActions && row.status === 'draft' ? (
                                                            <DropdownMenuItem
                                                                className="cursor-pointer"
                                                                onClick={() => setConfirmNoInvTarget(row)}
                                                            >
                                                                <CircleCheck />
                                                                Confirmar cobro (sin factura)
                                                            </DropdownMenuItem>
                                                        ) : null}
                                                        {invoiceActions &&
                                                        !(isPaymentWithoutInvoice(row) && isPaymentIssued(row.status)) ? (
                                                            <DropdownMenuItem
                                                                className="cursor-pointer"
                                                                disabled={pdfBusyId === row.id}
                                                                onClick={() => void handleDownloadPdf(row)}
                                                            >
                                                                <Download />
                                                                {isPaymentIssued(row.status)
                                                                    ? 'Descargar PDF'
                                                                    : 'Vista borrador PDF'}
                                                            </DropdownMenuItem>
                                                        ) : null}
                                                        {invoiceActions ? null : row.storageKey?.trim() ? (
                                                            <DropdownMenuItem
                                                                className="cursor-pointer"
                                                                disabled={pdfBusyId === row.id}
                                                                onClick={() => void handleDownloadExpenseFile(row)}
                                                            >
                                                                <Download />
                                                                Descargar PDF
                                                            </DropdownMenuItem>
                                                        ) : null}
                                                        {invoiceActions &&
                                                        isPaymentIssued(row.status) &&
                                                        !isPaymentWithoutInvoice(row) ? (
                                                            <DropdownMenuItem
                                                                className="cursor-pointer"
                                                                onClick={() => setSendTarget(row)}
                                                            >
                                                                <Mail />
                                                                Enviar al cliente
                                                            </DropdownMenuItem>
                                                        ) : null}
                                                        {(!invoiceActions || row.status === 'draft') && (
                                                            <DropdownMenuItem
                                                                variant="destructive"
                                                                className="cursor-pointer"
                                                                onClick={() => setDeleteTarget(row)}
                                                            >
                                                                <Trash2 />
                                                                Eliminar
                                                            </DropdownMenuItem>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        <DropdownMenuItem
                                                            className="cursor-pointer"
                                                            onClick={() => {
                                                                setSheetMode('view');
                                                                setEditing(row);
                                                                setSheetOpen(true);
                                                            }}
                                                        >
                                                            <Eye />
                                                            Ver
                                                        </DropdownMenuItem>
                                                        {invoiceActions &&
                                                        !(isPaymentWithoutInvoice(row) && isPaymentIssued(row.status)) ? (
                                                            <DropdownMenuItem
                                                                className="cursor-pointer"
                                                                disabled={pdfBusyId === row.id}
                                                                onClick={() => void handleDownloadPdf(row)}
                                                            >
                                                                <Download />
                                                                {isPaymentIssued(row.status)
                                                                    ? 'Descargar PDF'
                                                                    : 'Vista borrador PDF'}
                                                            </DropdownMenuItem>
                                                        ) : row.storageKey?.trim() ? (
                                                            <DropdownMenuItem
                                                                className="cursor-pointer"
                                                                disabled={pdfBusyId === row.id}
                                                                onClick={() => void handleDownloadExpenseFile(row)}
                                                            >
                                                                <Download />
                                                                Descargar PDF
                                                            </DropdownMenuItem>
                                                        ) : null}
                                                    </>
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
                        aria-label={paginationAriaLabel}
                        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <p className="text-sm text-muted-foreground">
                            Página {currentPage} de {lastPage}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="min-w-24"
                                disabled={currentPage <= 1 || loading}
                                onClick={() => patch({ page: String(currentPage - 1) })}
                            >
                                <ChevronLeft />
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="min-w-24"
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

            {renderSheet({
                open: sheetOpen,
                mode: sheetMode,
                editing,
                onOpenChange: setSheetOpen,
                onSubmit: handleSave,
                onReload: reload,
                onSendInvoice:
                    invoiceActions &&
                    editing &&
                    isPaymentIssued(editing.status) &&
                    !isPaymentWithoutInvoice(editing)
                        ? () => setSendTarget(editing)
                        : undefined,
            })}

            {invoiceActions ? (
                <EmitPaymentDialog
                    open={Boolean(emitTarget)}
                    payment={(emitTarget as Payment | null) ?? null}
                    onOpenChange={(o) => {
                        if (!o) setEmitTarget(null);
                    }}
                    onEmitted={() => {
                        setEmitTarget(null);
                        reload();
                    }}
                />
            ) : null}

            {invoiceActions ? (
                <ConfirmWithoutInvoiceDialog
                    open={Boolean(confirmNoInvTarget)}
                    payment={(confirmNoInvTarget as Payment | null) ?? null}
                    onOpenChange={(o) => {
                        if (!o) setConfirmNoInvTarget(null);
                    }}
                    onConfirmed={() => {
                        setConfirmNoInvTarget(null);
                        reload();
                    }}
                />
            ) : null}

            {invoiceActions ? (
                <SendInvoiceDialog
                    open={Boolean(sendTarget)}
                    payment={(sendTarget as Payment | null) ?? null}
                    onOpenChange={(o) => {
                        if (!o) setSendTarget(null);
                    }}
                    onSent={() => {
                        setSendTarget(null);
                        reload();
                    }}
                />
            ) : null}

            <Dialog
                open={Boolean(deleteTarget)}
                onOpenChange={(o) => {
                    if (!o) setDeleteTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{deleteTitle}</DialogTitle>
                        <DialogDescription>Soft delete del registro ledger.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => setDeleteTarget(null)}
                            disabled={deleting}
                        >
                            Cancelar
                        </Button>
                        <Button
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
