import { useEffect, useLayoutEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Download, FileWarning, Mail, Plus, Trash2 } from 'lucide-react';
import { AppSelect } from '@/components/app-select';
import { EntitySelect } from '@/components/entity-select';
import { FormField } from '@/components/form-field';
import { FormFieldsSkeleton } from '@/components/form-fields-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    FormPanel,
    FormPanelDescription,
    FormPanelFooter,
    FormPanelHeader,
    FormPanelTitle,
} from '@/components/responsive-form-panel';
import {
    LEDGER_STATUS_LABELS,
    PAYMENT_METHODS,
    attachPaymentInvoice,
    calcLineNet,
    calcTotal,
    confirmPaymentWithoutInvoice,
    downloadPaymentInvoice,
    emptyPaymentLine,
    fetchPaymentInvoiceBlob,
    formatMoney,
    getPayment,
    hasArchivedInvoice,
    isPaymentIssued,
    isPaymentWithoutInvoice,
    sumLineNets,
    type Installment,
    type InvoiceMode,
    type LedgerStatus,
    type Payment,
    type PaymentInput,
    type PaymentLine,
} from '@/lib/billing';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import { listProjectOptions } from '@/lib/projects';
import { BillingFileDropzone } from '@/pages/billing/BillingFileDropzone';
import { BillingFilePane } from '@/pages/billing/BillingFilePane';
import { BillingTotalsCard } from '@/pages/billing/BillingTotalsCard';
import { EmitPaymentDialog } from '@/pages/billing/EmitPaymentDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ProjectOpt = { id: number; name: string };

const empty: PaymentInput = {
    projectId: null,
    baseAmount: '',
    ivaRate: 21,
    irpfRate: 0,
    status: 'draft',
    invoiceMode: 'legal',
    paymentMethod: 'Transferencia Bancaria',
    invoiceDate: '',
    paymentDate: '',
    notes: '',
    installments: [],
    lines: [emptyPaymentLine()],
};

const ISSUED_STATUSES = ['pending', 'paid', 'partially_paid'] as const;

/** Snapshot for dirty check (emit must match BDD). */
function formSnapshot(f: PaymentInput): string {
    return JSON.stringify({
        projectId: f.projectId ?? null,
        ivaRate: Number(f.ivaRate) || 0,
        irpfRate: Number(f.irpfRate) || 0,
        status: f.status,
        invoiceMode: f.invoiceMode ?? 'legal',
        paymentMethod: f.paymentMethod ?? null,
        invoiceDate: f.invoiceDate || null,
        paymentDate: f.paymentDate || null,
        notes: f.notes || null,
        lines: (f.lines ?? []).map((l) => ({
            description: l.description?.toString().trim() ?? '',
            quantity: Number(l.quantity) || 0,
            unitPrice: Number(l.unitPrice) || 0,
            discountPercent: Number(l.discountPercent) || 0,
        })),
        installments: (f.installments ?? []).map((i) => ({
            amount: Number(i.amount) || 0,
            paidOn: i.paidOn || null,
            method: i.method ?? null,
            notes: i.notes || null,
        })),
    });
}

function toForm(p: Payment): PaymentInput {
    const lines =
        p.lines && p.lines.length > 0
            ? p.lines.map((l) => ({
                  id: l.id,
                  description: l.description ?? '',
                  quantity: l.quantity ?? '1',
                  unitPrice: l.unitPrice ?? '',
                  discountPercent: l.discountPercent ?? '0',
                  lineNet: l.lineNet,
                  sortOrder: l.sortOrder,
              }))
            : [emptyPaymentLine()];

    return {
        projectId: p.projectId,
        baseAmount: p.baseAmount ?? '',
        ivaRate: p.ivaRate ?? 21,
        irpfRate: p.irpfRate ?? 0,
        status: p.status,
        invoiceMode: p.invoiceMode ?? 'legal',
        paymentMethod: p.paymentMethod ?? 'Transferencia Bancaria',
        invoiceDate: p.invoiceDate ?? '',
        paymentDate: p.paymentDate ?? '',
        notes: p.notes ?? '',
        installments: p.installments ?? [],
        lines,
    };
}

function archiveMeta(p: Pick<Payment, 'storageKey' | 'storageProvider' | 'fileName'> | null | undefined) {
    return {
        storageKey: p?.storageKey ?? null,
        storageProvider: p?.storageProvider ?? null,
        fileName: p?.fileName ?? null,
    };
}

type Props = {
    open: boolean;
    mode: 'add' | 'edit' | 'view';
    payment: Payment | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: PaymentInput) => Promise<void>;
    lockedProjectId?: number;
    /** After emit — refresh list / parent row */
    onEmitted?: (payment: Payment) => void;
    /** Open parent SendInvoiceDialog (issued only) */
    onSendInvoice?: () => void;
};

export function PaymentSheet({ open, mode, payment, onOpenChange, onSubmit, lockedProjectId, onEmitted, onSendInvoice }: Props) {
    const readOnly = mode === 'view';
    const [form, setForm] = useState<PaymentInput>(empty);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [projects, setProjects] = useState<ProjectOpt[]>([]);
    const [saving, setSaving] = useState(false);
    const [hydrating, setHydrating] = useState(false);
    const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
    const [emitOpen, setEmitOpen] = useState(false);
    const [confirmNoInvOpen, setConfirmNoInvOpen] = useState(false);
    const [confirmNoInvBusy, setConfirmNoInvBusy] = useState(false);
    const [pdfBusy, setPdfBusy] = useState(false);
    const [baseline, setBaseline] = useState('');
    const [attachFile, setAttachFile] = useState<File | null>(null);
    const [archive, setArchive] = useState(archiveMeta(null));
    const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);
    const [remoteBlobUrl, setRemoteBlobUrl] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
        if (!open || lockedProjectId) return;
        const ac = new AbortController();
        void listProjectOptions(ac.signal)
            .then((rows) => {
                if (!ac.signal.aborted) setProjects(rows);
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                toastError(err);
            });
        return () => ac.abort();
    }, [open, lockedProjectId]);

    useLayoutEffect(() => {
        if (!open) return;
        setFieldErrors({});
        setEmitOpen(false);
        setConfirmNoInvOpen(false);
        setAttachFile(null);
        if (mode === 'add' || !payment) {
            setHydrating(false);
            const next = { ...empty, projectId: lockedProjectId ?? null, lines: [emptyPaymentLine()] };
            setForm(next);
            setBaseline(formSnapshot(next));
            setInvoiceNumber(null);
            setArchive(archiveMeta(null));
            return;
        }
        // list omits iva/lines/installments — hydrate when rates or lines missing
        if (payment.ivaRate !== undefined && payment.lines !== undefined) {
            setHydrating(false);
            const next = { ...toForm(payment), projectId: lockedProjectId ?? payment.projectId };
            setForm(next);
            setBaseline(formSnapshot(next));
            setInvoiceNumber(payment.invoiceNumber);
            setArchive(archiveMeta(payment));
            return;
        }
        setHydrating(true);
        setForm({ ...empty, projectId: lockedProjectId ?? null });
        setBaseline('');
        setInvoiceNumber(payment.invoiceNumber);
        setArchive(archiveMeta(payment));
        let cancelled = false;
        void getPayment(payment.id)
            .then((full) => {
                if (cancelled) return;
                const next = { ...toForm(full), projectId: lockedProjectId ?? full.projectId };
                setForm(next);
                setBaseline(formSnapshot(next));
                setInvoiceNumber(full.invoiceNumber);
                setArchive(archiveMeta(full));
            })
            .catch((err) => {
                if (cancelled) return;
                toastError(err);
                onOpenChange(false);
            })
            .finally(() => {
                if (!cancelled) setHydrating(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, mode, payment, lockedProjectId, onOpenChange]);

    const fiscalLocked = isPaymentIssued(form.status);
    const withoutInvoice = isPaymentWithoutInvoice(form) || isPaymentWithoutInvoice(payment);
    const dirty = !hydrating && baseline !== '' && formSnapshot(form) !== baseline;
    const paymentId = mode !== 'add' ? payment?.id : undefined;
    const archived = hasArchivedInvoice(archive);
    const lines = form.lines ?? [];
    const basePreview = sumLineNets(lines);
    const ivaRate = Number(form.ivaRate) || 0;
    const irpfRate = Number(form.irpfRate) || 0;
    const ivaAmt = Math.round(((basePreview * ivaRate) / 100) * 100) / 100;
    const irpfAmt = Math.round(((basePreview * irpfRate) / 100) * 100) / 100;
    const totalPreview = calcTotal(basePreview, ivaRate, irpfRate);
    const invoiceMode = (form.invoiceMode ?? 'legal') as InvoiceMode;

    useEffect(() => {
        if (!attachFile) {
            setLocalBlobUrl(null);
            return;
        }
        const url = URL.createObjectURL(attachFile);
        setLocalBlobUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [attachFile]);

    useEffect(() => {
        // Draft → Dompdf; issued con R2 → archivo; issued sin R2 → vacío (salvo file local)
        const canFetchRemote = Boolean(paymentId) && !attachFile && (!fiscalLocked || archived);
        if (!open || !canFetchRemote || !paymentId) {
            setRemoteBlobUrl(null);
            setPreviewLoading(false);
            return;
        }
        let cancelled = false;
        let objectUrl: string | null = null;
        setPreviewLoading(true);
        void fetchPaymentInvoiceBlob(paymentId)
            .then((blob) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setRemoteBlobUrl(objectUrl);
            })
            .catch((err) => {
                if (cancelled) return;
                setRemoteBlobUrl(null);
                if (fiscalLocked) toastError(err);
            })
            .finally(() => {
                if (!cancelled) setPreviewLoading(false);
            });
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [open, paymentId, attachFile, fiscalLocked, archived, archive.storageKey]);

    async function handleDownloadPdf() {
        if (!paymentId) return;
        setPdfBusy(true);
        try {
            await downloadPaymentInvoice(paymentId);
            toastSuccess(fiscalLocked ? 'PDF descargado' : 'Borrador PDF descargado');
        } catch (err) {
            toastError(err);
        } finally {
            setPdfBusy(false);
        }
    }

    function clearFieldError(key: string) {
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    function setField<K extends keyof PaymentInput>(key: K, value: PaymentInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
        clearFieldError(String(key));
    }

    function addLine() {
        clearFieldError('lines');
        setForm((prev) => ({
            ...prev,
            lines: [...(prev.lines ?? []), emptyPaymentLine()],
        }));
    }

    function removeLine(idx: number) {
        clearFieldError('lines');
        setForm((prev) => {
            const next = (prev.lines ?? []).filter((_, i) => i !== idx);
            return { ...prev, lines: next.length > 0 ? next : [emptyPaymentLine()] };
        });
    }

    function moveLine(idx: number, dir: -1 | 1) {
        clearFieldError('lines');
        setForm((prev) => {
            const rows = [...(prev.lines ?? [])];
            const j = idx + dir;
            if (j < 0 || j >= rows.length) return prev;
            [rows[idx], rows[j]] = [rows[j], rows[idx]];
            return { ...prev, lines: rows };
        });
    }

    function updateLine(idx: number, field: keyof PaymentLine, value: string) {
        clearFieldError('lines');
        clearFieldError(`lines.${idx}.${field}`);
        setForm((prev) => {
            const rows = [...(prev.lines ?? [])];
            rows[idx] = { ...rows[idx], [field]: value };
            return { ...prev, lines: rows };
        });
    }

    function addInstallment() {
        clearFieldError('installments');
        setForm((prev) => ({
            ...prev,
            installments: [
                ...(prev.installments ?? []),
                { amount: '', paidOn: '', method: 'Transferencia Bancaria', notes: '' },
            ],
        }));
    }

    function removeInstallment(idx: number) {
        clearFieldError('installments');
        setForm((prev) => ({
            ...prev,
            installments: (prev.installments ?? []).filter((_, i) => i !== idx),
        }));
    }

    function updateInstallment(idx: number, field: keyof Installment, value: string | null) {
        clearFieldError('installments');
        setForm((prev) => {
            const inst = [...(prev.installments ?? [])];
            inst[idx] = { ...inst[idx], [field]: value };
            return { ...prev, installments: inst };
        });
    }

    function suggestStatus(): LedgerStatus | undefined {
        const rows = (form.installments ?? []).filter((i) => i.amount && Number(i.amount) > 0);
        if (rows.length === 0 || form.status === 'draft') return undefined;
        const sum = rows.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
        if (sum >= totalPreview) return 'paid';
        if (sum > 0) return 'partially_paid';
        return 'pending';
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (readOnly) return;
        const suggested = suggestStatus();
        const installments = (form.installments ?? []).filter((i) => i.amount && Number(i.amount) > 0);
        const hadInstallments = mode === 'edit' && (payment?.installments?.length ?? 0) > 0;
        const installmentPayload =
            installments.length > 0 || hadInstallments ? { installments } : {};

        // post-emit: solo plazos / cobro / notes (+ attach PDF si hay file)
        if (fiscalLocked) {
            setSaving(true);
            try {
                if (attachFile && paymentId) {
                    const attached = await attachPaymentInvoice(paymentId, attachFile);
                    setArchive(archiveMeta(attached));
                    setAttachFile(null);
                    onEmitted?.(attached);
                    toastSuccess('PDF adjuntado');
                }
                await onSubmit({
                    status: suggested ?? form.status,
                    paymentMethod: form.paymentMethod?.toString().trim() || null,
                    paymentDate: form.paymentDate?.toString().trim() || null,
                    notes: form.notes?.toString().trim() || null,
                    ...installmentPayload,
                });
                onOpenChange(false);
            } catch (err) {
                if (err instanceof ApiError && err.fieldErrors) {
                    setFieldErrors(flattenFieldErrors(err.fieldErrors));
                }
                toastError(err);
            } finally {
                setSaving(false);
            }
            return;
        }

        const validLines = (form.lines ?? []).filter((l) => l.description?.toString().trim());
        if (validLines.length === 0) {
            setFieldErrors((prev) => ({ ...prev, lines: 'Añade al menos un concepto con descripción.' }));
            toastError(new Error('Añade al menos un concepto con descripción.'));
            return;
        }
        setSaving(true);
        try {
            await onSubmit({
                projectId: lockedProjectId ?? form.projectId ?? null,
                ivaRate: Number(form.ivaRate) || 0,
                irpfRate: Number(form.irpfRate) || 0,
                status: 'draft',
                invoiceMode: form.invoiceMode ?? 'legal',
                paymentMethod: form.paymentMethod?.toString().trim() || null,
                invoiceDate: form.invoiceDate?.toString().trim() || null,
                paymentDate: form.paymentDate?.toString().trim() || null,
                notes: form.notes?.toString().trim() || null,
                lines: validLines.map((l, i) => ({
                    description: l.description.toString().trim(),
                    quantity: Number(l.quantity) || 1,
                    unitPrice: Number(l.unitPrice) || 0,
                    discountPercent: Number(l.discountPercent) || 0,
                    sortOrder: i,
                })),
                ...installmentPayload,
            });
            onOpenChange(false);
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) {
                setFieldErrors(flattenFieldErrors(err.fieldErrors));
            }
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    const previewUrl = localBlobUrl ?? remoteBlobUrl;
    const previewName = attachFile?.name ?? archive.fileName ?? (fiscalLocked ? null : 'Borrador.pdf');
    const showPreviewPane = Boolean(paymentId) && !(fiscalLocked && withoutInvoice);
    const canDownloadPdf =
        Boolean(paymentId) && !withoutInvoice && (!fiscalLocked || archived);

    async function handleConfirmWithoutInvoice() {
        if (!paymentId || dirty || confirmNoInvBusy) return;
        setConfirmNoInvBusy(true);
        try {
            const confirmed = await confirmPaymentWithoutInvoice(paymentId);
            setForm((prev) => {
                const next = {
                    ...prev,
                    status: confirmed.status,
                    invoiceMode: 'none' as const,
                    invoiceDate: confirmed.invoiceDate ?? prev.invoiceDate,
                    lines: confirmed.lines ?? prev.lines,
                };
                setBaseline(formSnapshot(next));
                return next;
            });
            setInvoiceNumber(confirmed.invoiceNumber);
            setArchive(archiveMeta(confirmed));
            setConfirmNoInvOpen(false);
            toastSuccess('Cobro confirmado (sin factura)');
            onEmitted?.(confirmed);
        } catch (err) {
            toastError(err);
        } finally {
            setConfirmNoInvBusy(false);
        }
    }

    return (
        <>
        <FormPanel
            open={open}
            onOpenChange={onOpenChange}
            contentClassName={cn(
                'flex w-full flex-col gap-0 p-0 transition-[max-width]',
                showPreviewPane ? 'sm:max-w-lg md:max-w-[1200px]' : 'sm:max-w-lg',
            )}
        >
                <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
                    {showPreviewPane ? (
                        <div className="hidden min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-border p-6 md:flex md:flex-1 md:border-r">
                            <BillingFilePane
                                blobUrl={previewUrl}
                                fileName={previewName}
                                loading={previewLoading && !localBlobUrl}
                                emptyLabel={
                                    fiscalLocked
                                        ? 'Adjunta el PDF para verlo en BOhub'
                                        : 'Vista previa del borrador'
                                }
                                className="h-full min-h-0 shadow-lg"
                            />
                        </div>
                    ) : null}
                    <div
                        className={cn(
                            'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
                            showPreviewPane ? 'w-full md:w-[450px] md:flex-none md:shrink-0 lg:w-[500px]' : 'w-full',
                        )}
                    >
                <FormPanelHeader>
                    <FormPanelTitle>
                        {mode === 'add' ? 'Añadir ingreso' : mode === 'view' ? 'Ver ingreso' : 'Editar ingreso'}
                    </FormPanelTitle>
                    <FormPanelDescription>
                        {readOnly ? 'Detalle ledger (solo lectura).' : 'Conceptos, IVA/IRPF e installments opcionales.'}
                    </FormPanelDescription>
                </FormPanelHeader>

                {hydrating ? (
                    <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4">
                        <FormFieldsSkeleton fields={8} />
                    </div>
                ) : (
                <form
                    id="payment-form"
                    noValidate
                    className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
                    onSubmit={(e) => void handleSubmit(e)}
                >
                    <fieldset disabled={readOnly} className="flex flex-col gap-4 border-0 p-0 m-0 min-w-0">
                    {!lockedProjectId && (
                        <FormField id="pay-project" label="Proyecto" error={fieldErrors.projectId}>
                            <EntitySelect
                                id="pay-project"
                                value={form.projectId ?? null}
                                onValueChange={(id) => setField('projectId', id)}
                                items={projects}
                                allowClear
                                placeholder="Sin proyecto"
                                disabled={fiscalLocked}
                                aria-invalid={!!fieldErrors.projectId}
                            />
                        </FormField>
                    )}

                    <FormField id="pay-method" label="Método de pago" error={fieldErrors.paymentMethod}>
                        <AppSelect
                            id="pay-method"
                            items={PAYMENT_METHODS.map((m) => ({ label: m, value: m }))}
                            value={form.paymentMethod ?? 'Transferencia Bancaria'}
                            onValueChange={(value) => setField('paymentMethod', value)}
                            aria-invalid={!!fieldErrors.paymentMethod}
                        />
                    </FormField>

                    <fieldset className="grid gap-3 rounded-lg border border-border p-3" disabled={fiscalLocked}>
                        <legend className="px-1 text-sm font-medium text-foreground">Conceptos</legend>
                        {fieldErrors.lines ? (
                            <p className="text-sm text-destructive">{fieldErrors.lines}</p>
                        ) : null}
                        {lines.map((line, idx) => {
                            const net = calcLineNet(
                                Number(line.quantity) || 0,
                                Number(line.unitPrice) || 0,
                                Number(line.discountPercent) || 0,
                            );
                            return (
                                <div key={idx} className="grid gap-2 border-t border-border pt-3 first:border-0 first:pt-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-muted-foreground">Línea {idx + 1}</span>
                                        {!fiscalLocked && !readOnly ? (
                                            <div className="flex items-center gap-0.5">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    disabled={idx === 0}
                                                    onClick={() => moveLine(idx, -1)}
                                                    aria-label="Subir línea"
                                                >
                                                    <ArrowUp className="size-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    disabled={idx >= lines.length - 1}
                                                    onClick={() => moveLine(idx, 1)}
                                                    aria-label="Bajar línea"
                                                >
                                                    <ArrowDown className="size-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => removeLine(idx)}
                                                    aria-label="Eliminar línea"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor={`line-${idx}-desc`} className="text-xs">
                                            Descripción
                                        </Label>
                                        <Input
                                            id={`line-${idx}-desc`}
                                            value={line.description}
                                            disabled={fiscalLocked}
                                            onChange={(e) => updateLine(idx, 'description', e.target.value)}
                                            className="h-8 bg-card text-sm"
                                            aria-invalid={!!fieldErrors[`lines.${idx}.description`]}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="grid gap-1.5">
                                            <Label htmlFor={`line-${idx}-qty`} className="text-xs">
                                                Cant.
                                            </Label>
                                            <Input
                                                id={`line-${idx}-qty`}
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                disabled={fiscalLocked}
                                                value={line.quantity}
                                                onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                                                className="h-8 bg-card text-sm"
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor={`line-${idx}-price`} className="text-xs">
                                                P.U. bruto
                                            </Label>
                                            <Input
                                                id={`line-${idx}-price`}
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                disabled={fiscalLocked}
                                                value={line.unitPrice}
                                                onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)}
                                                className="h-8 bg-card text-sm"
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor={`line-${idx}-dto`} className="text-xs">
                                                % dto
                                            </Label>
                                            <Input
                                                id={`line-${idx}-dto`}
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="100"
                                                disabled={fiscalLocked}
                                                value={line.discountPercent ?? '0'}
                                                onChange={(e) => updateLine(idx, 'discountPercent', e.target.value)}
                                                className="h-8 bg-card text-sm"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Neto línea: {formatMoney(net)}</p>
                                </div>
                            );
                        })}
                        {!fiscalLocked && !readOnly ? (
                            <Button type="button" variant="outline" size="sm" onClick={addLine} className="w-full">
                                <Plus />
                                Añadir concepto
                            </Button>
                        ) : null}
                    </fieldset>

                    <div className="grid grid-cols-2 gap-3">
                        <FormField id="pay-iva" label="IVA %" error={fieldErrors.ivaRate}>
                            <Input
                                id="pay-iva"
                                type="number"
                                step="0.01"
                                min={0}
                                max={100}
                                disabled={fiscalLocked}
                                value={form.ivaRate}
                                onChange={(e) => setField('ivaRate', e.target.value)}
                                aria-invalid={!!fieldErrors.ivaRate}
                                className="bg-card"
                            />
                        </FormField>
                        <FormField id="pay-irpf" label="IRPF %" error={fieldErrors.irpfRate}>
                            <Input
                                id="pay-irpf"
                                type="number"
                                step="0.01"
                                min={0}
                                max={100}
                                disabled={fiscalLocked}
                                value={form.irpfRate}
                                onChange={(e) => setField('irpfRate', e.target.value)}
                                aria-invalid={!!fieldErrors.irpfRate}
                                className="bg-card"
                            />
                        </FormField>
                    </div>

                    <BillingTotalsCard
                        base={basePreview}
                        iva={ivaAmt}
                        irpf={irpfAmt}
                        total={totalPreview}
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <FormField id="pay-status" label="Estado" error={fieldErrors.status}>
                            {fiscalLocked ? (
                                <AppSelect
                                    id="pay-status"
                                    items={ISSUED_STATUSES.map((status) => ({
                                        label: LEDGER_STATUS_LABELS[status],
                                        value: status,
                                    }))}
                                    value={form.status}
                                    onValueChange={(value) => setField('status', value as LedgerStatus)}
                                    aria-invalid={!!fieldErrors.status}
                                />
                            ) : (
                                <Input
                                    id="pay-status"
                                    readOnly
                                    value={LEDGER_STATUS_LABELS.draft}
                                    className="bg-muted"
                                />
                            )}
                        </FormField>
                        <FormField id="pay-inv-date" label="Fecha factura" error={fieldErrors.invoiceDate}>
                            <Input
                                id="pay-inv-date"
                                type="date"
                                disabled={fiscalLocked}
                                value={form.invoiceDate ?? ''}
                                onChange={(e) => setField('invoiceDate', e.target.value)}
                                aria-invalid={!!fieldErrors.invoiceDate}
                                className="bg-card"
                            />
                        </FormField>
                    </div>

                    {!fiscalLocked ? (
                        <FormField id="pay-inv-mode" label="Tipo de cobro" error={fieldErrors.invoiceMode}>
                            <AppSelect
                                id="pay-inv-mode"
                                items={[
                                    { label: 'Factura', value: 'legal' },
                                    { label: 'Sin factura', value: 'none' },
                                ]}
                                value={invoiceMode}
                                onValueChange={(value) => setField('invoiceMode', value as InvoiceMode)}
                                aria-invalid={!!fieldErrors.invoiceMode}
                            />
                        </FormField>
                    ) : null}

                    {fiscalLocked && (
                        <FormField id="pay-inv-num" label={withoutInvoice ? 'Factura' : 'Nº factura'}>
                            <Input
                                id="pay-inv-num"
                                readOnly
                                value={withoutInvoice ? 'Sin factura' : (invoiceNumber ?? '—')}
                                className="bg-muted font-mono"
                            />
                        </FormField>
                    )}

                    <fieldset className="grid gap-3 rounded-lg border border-border p-3">
                        <legend className="px-1 text-sm font-medium text-foreground">Plazos de pago</legend>
                        {fieldErrors.installments ? (
                            <p className="text-sm text-destructive">{fieldErrors.installments}</p>
                        ) : null}
                        {(form.installments ?? []).length === 0 && (
                            <p className="text-xs text-muted-foreground">Sin plazos (pago único)</p>
                        )}
                        {(form.installments ?? []).map((inst, idx) => (
                            <div key={idx} className="grid gap-2 border-t border-border pt-3 first:border-0 first:pt-0">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Plazo {idx + 1}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => removeInstallment(idx)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor={`inst-${idx}-amt`} className="text-xs">
                                        Importe
                                    </Label>
                                    <Input
                                        id={`inst-${idx}-amt`}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={inst.amount ?? ''}
                                        onChange={(e) => updateInstallment(idx, 'amount', e.target.value)}
                                        className="h-8 bg-card text-sm"
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor={`inst-${idx}-date`} className="text-xs">
                                        Fecha
                                    </Label>
                                    <Input
                                        id={`inst-${idx}-date`}
                                        type="date"
                                        value={inst.paidOn ?? ''}
                                        onChange={(e) => updateInstallment(idx, 'paidOn', e.target.value)}
                                        className="h-8 bg-card text-sm"
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor={`inst-${idx}-method`} className="text-xs">
                                        Método
                                    </Label>
                                    <AppSelect
                                        id={`inst-${idx}-method`}
                                        items={PAYMENT_METHODS.map((m) => ({ label: m, value: m }))}
                                        value={inst.method ?? 'Transferencia Bancaria'}
                                        onValueChange={(value) => updateInstallment(idx, 'method', value)}
                                        className="h-8 text-sm"
                                    />
                                </div>
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={addInstallment} className="w-full">
                            <Plus />
                            Añadir plazo
                        </Button>
                    </fieldset>

                    {fiscalLocked && !readOnly && !withoutInvoice ? (
                        <FormField
                            id="pay-file"
                            label={archived ? 'PDF factura' : 'Adjuntar PDF (obligatorio para export)'}
                            error={fieldErrors.file}
                            description={
                                archived && !attachFile
                                    ? archive.fileName ?? 'Archivo en BOhub'
                                    : undefined
                            }
                        >
                            <BillingFileDropzone
                                id="pay-file"
                                fileName={attachFile?.name ?? null}
                                invalid={!!fieldErrors.file}
                                onFile={(f) => {
                                    setAttachFile(f);
                                    clearFieldError('file');
                                }}
                                emptyHint="PDF, JPG, PNG o WebP · máx. 10 MB · se sube al guardar"
                            />
                            {attachFile && archived ? (
                                <p className="text-xs text-muted-foreground">Al guardar reemplaza el archivo en BOhub.</p>
                            ) : null}
                        </FormField>
                    ) : null}

                    <FormField id="pay-notes" label="Notas" error={fieldErrors.notes}>
                        <Textarea
                            id="pay-notes"
                            value={form.notes ?? ''}
                            onChange={(e) => setField('notes', e.target.value)}
                            aria-invalid={!!fieldErrors.notes}
                            rows={3}
                            className="bg-card"
                        />
                    </FormField>
                    </fieldset>
                </form>
                )}

                <FormPanelFooter className="flex-wrap gap-2">
                    {canDownloadPdf ? (
                        <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer"
                            disabled={hydrating || pdfBusy}
                            onClick={() => void handleDownloadPdf()}
                        >
                            <Download />
                            {fiscalLocked ? 'Descargar PDF' : 'Vista borrador PDF'}
                        </Button>
                    ) : null}
                    {paymentId && fiscalLocked && onSendInvoice && !withoutInvoice ? (
                        <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer"
                            disabled={hydrating}
                            onClick={() => {
                                onOpenChange(false);
                                onSendInvoice();
                            }}
                        >
                            <Mail />
                            Enviar al cliente
                        </Button>
                    ) : null}
                    {!readOnly && paymentId && !fiscalLocked ? (
                        <div className="flex flex-col gap-1">
                            {invoiceMode === 'none' ? (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="cursor-pointer"
                                    disabled={hydrating || saving || dirty || confirmNoInvBusy}
                                    onClick={() => setConfirmNoInvOpen(true)}
                                >
                                    <FileWarning />
                                    Confirmar cobro (sin factura)
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="cursor-pointer"
                                    disabled={hydrating || saving || dirty}
                                    onClick={() => setEmitOpen(true)}
                                >
                                    <FileWarning />
                                    Emitir factura
                                </Button>
                            )}
                            {dirty ? (
                                <p className="text-xs text-muted-foreground">
                                    Guarda los cambios antes de{' '}
                                    {invoiceMode === 'none' ? 'confirmar.' : 'emitir.'}
                                </p>
                            ) : null}
                        </div>
                    ) : null}
                    {readOnly ? (
                        <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => onOpenChange(false)}
                            disabled={hydrating}
                        >
                            Cerrar
                        </Button>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() => onOpenChange(false)}
                                disabled={hydrating || saving}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                form="payment-form"
                                className="cursor-pointer"
                                disabled={hydrating || saving}
                            >
                                {saving ? 'Guardando…' : mode === 'add' ? 'Crear' : 'Guardar'}
                            </Button>
                        </>
                    )}
                </FormPanelFooter>
                    </div>
                </div>
        </FormPanel>
            <EmitPaymentDialog
                open={emitOpen}
                payment={
                    paymentId
                        ? {
                              ...(payment as Payment),
                              id: paymentId,
                              status: form.status,
                              totalAmount: String(totalPreview.toFixed(2)),
                              project: payment?.project ?? null,
                              lines: form.lines,
                          }
                        : null
                }
                onOpenChange={setEmitOpen}
                onEmitted={(emitted) => {
                    setForm((prev) => {
                        const next = {
                            ...prev,
                            status: emitted.status,
                            invoiceMode: emitted.invoiceMode ?? 'legal',
                            invoiceDate: emitted.invoiceDate ?? prev.invoiceDate,
                            lines: emitted.lines ?? prev.lines,
                        };
                        setBaseline(formSnapshot(next));
                        return next;
                    });
                    setInvoiceNumber(emitted.invoiceNumber);
                    setArchive(archiveMeta(emitted));
                    setAttachFile(null);
                    onEmitted?.(emitted);
                }}
            />
            <Dialog
                open={confirmNoInvOpen}
                onOpenChange={(next) => {
                    if (confirmNoInvBusy) return;
                    setConfirmNoInvOpen(next);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar cobro (sin factura)</DialogTitle>
                        <DialogDescription>
                            El ingreso pasará a pendiente sin número de factura ni PDF. Contabiliza en el hub; no se
                            envía al cliente como factura ni entra en el export de gestoría.
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Total: <span className="font-medium text-foreground">{formatMoney(totalPreview)}</span>
                    </p>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={confirmNoInvBusy}
                            onClick={() => setConfirmNoInvOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            disabled={confirmNoInvBusy}
                            onClick={() => void handleConfirmWithoutInvoice()}
                        >
                            {confirmNoInvBusy ? 'Confirmando…' : 'Confirmar cobro (sin factura)'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
