import { useEffect, useLayoutEffect, useState, type FormEvent } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { AppSelect } from '@/components/app-select';
import { EntitySelect } from '@/components/entity-select';
import { FormField } from '@/components/form-field';
import { FormFieldsSkeleton } from '@/components/form-fields-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
    LEDGER_STATUSES,
    LEDGER_STATUS_LABELS,
    PAYMENT_METHODS,
    calcTotal,
    calcBaseFromTotal,
    downloadExpenseFile,
    expenseHasStoredFile,
    fetchExpenseFileBlob,
    getExpense,
    ocrExpensePreview,
    type Expense,
    type ExpenseInput,
    type ExpenseOcrDraft,
    type Installment,
    type LedgerStatus,
} from '@/lib/billing';
import { ApiError, apiErrorMessage, flattenFieldErrors } from '@/lib/api';
import { toastError } from '@/lib/toast';
import { listProjectOptions } from '@/lib/projects';
import { BillingFileDropzone } from '@/pages/billing/BillingFileDropzone';
import { BillingFilePane } from '@/pages/billing/BillingFilePane';
import { BillingTotalsCard } from '@/pages/billing/BillingTotalsCard';
import { cn } from '@/lib/utils';

type ProjectOpt = { id: number; name: string };
type CreateEntry = 'ocr' | 'manual';

const empty: ExpenseInput = {
    projectId: null,
    description: '',
    recipient: '',
    category: '',
    baseAmount: '',
    ivaRate: 21,
    irpfRate: 0,
    status: 'pending',
    expenseDate: '',
    paymentDate: '',
    notes: '',
    installments: [],
};

const entryChipClass = (active: boolean) =>
    cn(
        'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors duration-200',
        'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
        active
            ? 'bg-sidebar-accent font-medium text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    );

function toForm(e: Expense): ExpenseInput {
    return {
        projectId: e.projectId,
        description: e.description,
        recipient: e.recipient ?? '',
        category: e.category ?? '',
        baseAmount: e.baseAmount ?? '',
        ivaRate: e.ivaRate ?? 21,
        irpfRate: e.irpfRate ?? 0,
        status: e.status,
        expenseDate: e.expenseDate ?? '',
        paymentDate: e.paymentDate ?? '',
        notes: e.notes ?? '',
        installments: e.installments ?? [],
    };
}

type Props = {
    open: boolean;
    mode: 'add' | 'edit' | 'view';
    expense: Expense | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: ExpenseInput) => Promise<void>;
    lockedProjectId?: number;
};

export function ExpenseSheet({ open, mode, expense, onOpenChange, onSubmit, lockedProjectId }: Props) {
    const readOnly = mode === 'view';
    const [form, setForm] = useState<ExpenseInput>(empty);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [projects, setProjects] = useState<ProjectOpt[]>([]);
    const [saving, setSaving] = useState(false);
    const [hydrating, setHydrating] = useState(false);
    const [lastEdited, setLastEdited] = useState<'base' | 'total'>('base');
    const [totalInput, setTotalInput] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [createEntry, setCreateEntry] = useState<CreateEntry>('ocr');
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrError, setOcrError] = useState<string | null>(null);
    const [meta, setMeta] = useState<Pick<Expense, 'id' | 'storageKey' | 'storageProvider' | 'fileName'>>({
        id: 0,
        storageKey: null,
        storageProvider: null,
        fileName: null,
    });
    const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);
    const [remoteBlobUrl, setRemoteBlobUrl] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    const hasR2 = expenseHasStoredFile(meta);
    const previewUrl = localBlobUrl ?? remoteBlobUrl;
    const previewName = file?.name ?? meta.fileName ?? null;
    const isAdd = mode === 'add';
    const baseAmt = Number(form.baseAmount) || 0;
    const ivaRateN = Number(form.ivaRate) || 0;
    const irpfRateN = Number(form.irpfRate) || 0;
    const ivaAmt = Math.round(((baseAmt * ivaRateN) / 100) * 100) / 100;
    const irpfAmt = Math.round(((baseAmt * irpfRateN) / 100) * 100) / 100;
    const totalAmt = Number(totalInput) || 0;

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
        setFile(null);
        setOcrLoading(false);
        setOcrError(null);
        if (mode === 'add' || !expense) {
            setHydrating(false);
            setCreateEntry('ocr');
            setForm({ ...empty, projectId: lockedProjectId ?? null });
            setMeta({ id: 0, storageKey: null, storageProvider: null, fileName: null });
            setTotalInput('');
            setLastEdited('base');
            return;
        }
        if (expense.ivaRate !== undefined) {
            setHydrating(false);
            const f = { ...toForm(expense), projectId: lockedProjectId ?? expense.projectId };
            setForm(f);
            setMeta({
                id: expense.id,
                storageKey: expense.storageKey ?? null,
                storageProvider: expense.storageProvider ?? null,
                fileName: expense.fileName ?? null,
            });
            const previewTotal = calcTotal(Number(f.baseAmount) || 0, Number(f.ivaRate) || 0, Number(f.irpfRate) || 0);
            setTotalInput(previewTotal.toFixed(2));
            setLastEdited('base');
            return;
        }
        setHydrating(true);
        setForm({ ...empty, projectId: lockedProjectId ?? null });
        setMeta({ id: expense.id, storageKey: null, storageProvider: null, fileName: null });
        setTotalInput('');
        setLastEdited('base');
        let cancelled = false;
        void getExpense(expense.id)
            .then((full) => {
                if (cancelled) return;
                const fullForm = { ...toForm(full), projectId: lockedProjectId ?? full.projectId };
                setForm(fullForm);
                setMeta({
                    id: full.id,
                    storageKey: full.storageKey ?? null,
                    storageProvider: full.storageProvider ?? null,
                    fileName: full.fileName ?? null,
                });
                const t = calcTotal(
                    Number(fullForm.baseAmount) || 0,
                    Number(fullForm.ivaRate) || 0,
                    Number(fullForm.irpfRate) || 0,
                );
                setTotalInput(t.toFixed(2));
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
    }, [open, mode, expense, lockedProjectId, onOpenChange]);

    useEffect(() => {
        if (!file) {
            setLocalBlobUrl(null);
            return;
        }
        const url = URL.createObjectURL(file);
        setLocalBlobUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    useEffect(() => {
        if (!open || file || !expenseHasStoredFile(meta) || !meta.id) {
            setRemoteBlobUrl(null);
            setPreviewLoading(false);
            return;
        }
        let cancelled = false;
        let objectUrl: string | null = null;
        setPreviewLoading(true);
        void fetchExpenseFileBlob(meta.id, { inline: true })
            .then((blob) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setRemoteBlobUrl(objectUrl);
            })
            .catch((err) => {
                if (cancelled) return;
                setRemoteBlobUrl(null);
                toastError(err);
            })
            .finally(() => {
                if (!cancelled) setPreviewLoading(false);
            });
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [open, file, meta.id, meta.storageKey, meta.storageProvider]);

    function clearFieldError(key: string) {
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    function setField<K extends keyof ExpenseInput>(key: K, value: ExpenseInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
        clearFieldError(String(key));
    }

    function applyOcrDraft(draft: ExpenseOcrDraft) {
        const baseAmount = draft.baseAmount ?? '';
        const ivaRate = draft.ivaRate != null && draft.ivaRate !== '' ? Number(draft.ivaRate) : 21;
        const irpfRate = draft.irpfRate != null && draft.irpfRate !== '' ? Number(draft.irpfRate) : 0;
        setForm((prev) => ({
            ...prev,
            description: draft.description?.trim() || prev.description,
            recipient: draft.recipient?.trim() || '',
            category: draft.category?.trim() || '',
            baseAmount: baseAmount || prev.baseAmount,
            ivaRate: Number.isFinite(ivaRate) ? ivaRate : prev.ivaRate,
            irpfRate: Number.isFinite(irpfRate) ? irpfRate : prev.irpfRate,
            expenseDate: draft.expenseDate?.trim() || prev.expenseDate,
            notes: draft.rawNotes?.trim() || prev.notes,
        }));
        if (draft.totalAmount?.trim()) {
            setTotalInput(draft.totalAmount.trim());
            setLastEdited('total');
            if (!baseAmount) {
                const b = calcBaseFromTotal(
                    Number(draft.totalAmount) || 0,
                    Number.isFinite(ivaRate) ? ivaRate : 21,
                    Number.isFinite(irpfRate) ? irpfRate : 0,
                );
                setForm((prev) => ({ ...prev, baseAmount: b.toFixed(2) }));
            }
        } else if (baseAmount) {
            const t = calcTotal(
                Number(baseAmount) || 0,
                Number.isFinite(ivaRate) ? ivaRate : 21,
                Number.isFinite(irpfRate) ? irpfRate : 0,
            );
            setTotalInput(t.toFixed(2));
            setLastEdited('base');
        }
    }

    function switchCreateEntry(next: CreateEntry) {
        if (next === createEntry) return;
        setCreateEntry(next);
        setFile(null);
        setOcrLoading(false);
        setOcrError(null);
        setFieldErrors({});
        setForm({ ...empty, projectId: lockedProjectId ?? null });
        setTotalInput('');
        setLastEdited('base');
    }

    function onFilePicked(next: File | null) {
        setFile(next);
        clearFieldError('file');
        setOcrError(null);
        if (!next || !isAdd || createEntry !== 'ocr') return;
        setOcrLoading(true);
        void ocrExpensePreview(next)
            .then(({ draft }) => {
                applyOcrDraft(draft);
                setOcrError(null);
            })
            .catch((err) => {
                toastError(err);
                const detail = apiErrorMessage(err);
                setOcrError(
                    detail
                        ? `No se pudo leer la factura con IA (${detail}). Rellena el formulario a mano; el archivo se guardará al crear.`
                        : 'No se pudo leer la factura con IA. Rellena el formulario a mano; el archivo se guardará al crear.',
                );
            })
            .finally(() => setOcrLoading(false));
    }

    function handleBaseChange(value: string) {
        setField('baseAmount', value);
        setLastEdited('base');
        const t = calcTotal(Number(value) || 0, Number(form.ivaRate) || 0, Number(form.irpfRate) || 0);
        setTotalInput(t.toFixed(2));
    }

    function handleTotalChange(value: string) {
        setTotalInput(value);
        setLastEdited('total');
        const b = calcBaseFromTotal(Number(value) || 0, Number(form.ivaRate) || 0, Number(form.irpfRate) || 0);
        setField('baseAmount', b.toFixed(2));
    }

    /** Use event rates — setField is async and form would be stale. */
    function recalcWithRates(nextIva: number, nextIrpf: number) {
        if (lastEdited === 'base') {
            setTotalInput(calcTotal(Number(form.baseAmount) || 0, nextIva, nextIrpf).toFixed(2));
        } else {
            setField(
                'baseAmount',
                calcBaseFromTotal(Number(totalInput) || 0, nextIva, nextIrpf).toFixed(2),
            );
        }
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
        const total = Number(totalInput) || 0;
        const sum = rows.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
        if (sum >= total) return 'paid';
        if (sum > 0) return 'partially_paid';
        return 'pending';
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (readOnly || ocrLoading) return;
        if (!file && !hasR2) {
            setFieldErrors((prev) => ({ ...prev, file: 'Adjunta el justificante (PDF o imagen).' }));
            return;
        }
        setSaving(true);
        try {
            const suggested = suggestStatus();
            const installments = (form.installments ?? []).filter((i) => i.amount && Number(i.amount) > 0);
            const hadInstallments = mode === 'edit' && (expense?.installments?.length ?? 0) > 0;
            await onSubmit({
                projectId: lockedProjectId ?? form.projectId ?? null,
                description: form.description.trim(),
                recipient: form.recipient?.toString().trim() || null,
                category: form.category?.toString().trim() || null,
                baseAmount: Number(form.baseAmount),
                ivaRate: Number(form.ivaRate) || 0,
                irpfRate: Number(form.irpfRate) || 0,
                status: suggested ?? form.status,
                expenseDate: form.expenseDate?.toString().trim() || null,
                paymentDate: form.paymentDate?.toString().trim() || null,
                notes: form.notes?.toString().trim() || null,
                file: file ?? null,
                ...(installments.length > 0 || hadInstallments ? { installments } : {}),
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

    const emptyPreviewLabel =
        readOnly && !hasR2 && !file
            ? 'Sin archivo en BOhub'
            : hasR2
              ? 'No se pudo cargar el archivo'
              : 'Adjunta el archivo para verlo en BOhub';

    // Single file block: top of form. View = download only (no input). Hide entirely if view && !R2.
    const showFileBlock = !readOnly || hasR2;
    const fileField = showFileBlock ? (
        <FormField
            id="exp-file"
            label={
                readOnly
                    ? 'Justificante'
                    : hasR2
                      ? 'Justificante'
                      : 'Justificante (obligatorio)'
            }
            error={readOnly ? undefined : fieldErrors.file}
            description={
                readOnly
                    ? meta.fileName ?? 'Archivo en BOhub'
                    : hasR2 && !file
                      ? `${meta.fileName ?? 'Archivo en BOhub'} · puedes reemplazar`
                      : undefined
            }
        >
            <div className="flex flex-col gap-2">
                {!readOnly ? (
                    <BillingFileDropzone
                        id="exp-file"
                        fileName={file?.name ?? null}
                        disabled={ocrLoading}
                        invalid={!!fieldErrors.file}
                        onFile={onFilePicked}
                        emptyHint={
                            isAdd && createEntry === 'ocr'
                                ? 'PDF, JPG, PNG o WebP · máx. 10 MB · la IA propone los datos'
                                : 'PDF, JPG, PNG o WebP · máx. 10 MB'
                        }
                    />
                ) : null}
                {hasR2 && meta.id > 0 ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit cursor-pointer"
                        onClick={() =>
                            void downloadExpenseFile(meta.id, meta.fileName ?? `gasto-${meta.id}`).catch(toastError)
                        }
                    >
                        <Download className="size-4" />
                        Descargar
                    </Button>
                ) : null}
            </div>
            {ocrLoading ? <p className="text-xs text-muted-foreground">Leyendo factura con IA…</p> : null}
            {ocrError ? <p className="text-sm text-amber-500">{ocrError}</p> : null}
            {file && !ocrLoading && !readOnly && hasR2 ? (
                <p className="text-xs text-muted-foreground">Al guardar reemplaza el archivo en BOhub.</p>
            ) : null}
        </FormField>
    ) : null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                className={cn(
                    'flex w-full flex-col gap-0 p-0 transition-[max-width] data-[side=right]:w-full',
                    'sm:max-w-[1200px] data-[side=right]:sm:max-w-[1200px]',
                )}
            >
                <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
                    <div className="order-2 flex max-h-[40vh] min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-t border-border p-3 md:order-1 md:max-h-none md:min-h-0 md:flex-1 md:border-t-0 md:border-r md:p-6">
                        <BillingFilePane
                            blobUrl={previewUrl}
                            fileName={previewName}
                            loading={(previewLoading && !localBlobUrl) || ocrLoading}
                            emptyLabel={emptyPreviewLabel}
                            className="h-full min-h-0 shadow-lg"
                        />
                    </div>
                    <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:order-2 md:w-[450px] md:flex-none md:shrink-0 lg:w-[500px]">
                        <SheetHeader className="gap-1 pb-2">
                            <SheetTitle>
                                {mode === 'add' ? 'Añadir gasto' : mode === 'view' ? 'Ver gasto' : 'Editar gasto'}
                            </SheetTitle>
                            <SheetDescription>
                                {readOnly ? 'Detalle ledger (solo lectura).' : 'Factura recibida / gasto interno.'}
                            </SheetDescription>
                        </SheetHeader>

                        {isAdd && !readOnly ? (
                            <div className="flex flex-col gap-2.5 border-b border-border px-4 pb-4 pt-2">
                                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Modo de alta">
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={createEntry === 'ocr'}
                                        className={entryChipClass(createEntry === 'ocr')}
                                        onClick={() => switchCreateEntry('ocr')}
                                        disabled={saving || ocrLoading}
                                    >
                                        Subir archivo (OCR)
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={createEntry === 'manual'}
                                        className={entryChipClass(createEntry === 'manual')}
                                        onClick={() => switchCreateEntry('manual')}
                                        disabled={saving || ocrLoading}
                                    >
                                        Manual
                                    </button>
                                </div>
                                {createEntry === 'ocr' ? (
                                    <p className="text-xs text-muted-foreground">
                                        La IA propone los datos; revísalos antes de guardar.
                                    </p>
                                ) : null}
                            </div>
                        ) : null}

                        {hydrating ? (
                            <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4 pt-4">
                                <FormFieldsSkeleton fields={8} />
                            </div>
                        ) : (
                            <form
                                id="expense-form"
                                noValidate
                                className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 pt-4"
                                onSubmit={(e) => void handleSubmit(e)}
                            >
                                {fileField}
                                <fieldset
                                    disabled={readOnly || ocrLoading}
                                    className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0"
                                >
                                    <FormField id="exp-desc" label="Descripción" error={fieldErrors.description}>
                                        <Input
                                            id="exp-desc"
                                            required
                                            maxLength={255}
                                            value={form.description}
                                            onChange={(e) => setField('description', e.target.value)}
                                            aria-invalid={!!fieldErrors.description}
                                            className="bg-card"
                                        />
                                    </FormField>

                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField id="exp-recipient" label="Proveedor" error={fieldErrors.recipient}>
                                            <Input
                                                id="exp-recipient"
                                                maxLength={255}
                                                value={form.recipient ?? ''}
                                                onChange={(e) => setField('recipient', e.target.value)}
                                                aria-invalid={!!fieldErrors.recipient}
                                                className="bg-card"
                                            />
                                        </FormField>
                                        <FormField id="exp-cat" label="Categoría" error={fieldErrors.category}>
                                            <Input
                                                id="exp-cat"
                                                value={form.category ?? ''}
                                                onChange={(e) => setField('category', e.target.value)}
                                                maxLength={120}
                                                aria-invalid={!!fieldErrors.category}
                                                className="bg-card"
                                            />
                                        </FormField>
                                    </div>

                                    {!lockedProjectId && (
                                        <FormField id="exp-project" label="Proyecto" error={fieldErrors.projectId}>
                                            <EntitySelect
                                                id="exp-project"
                                                value={form.projectId ?? null}
                                                onValueChange={(id) => setField('projectId', id)}
                                                items={projects}
                                                allowClear
                                                placeholder="Sin proyecto"
                                                aria-invalid={!!fieldErrors.projectId}
                                            />
                                        </FormField>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField id="exp-base" label="Base" error={fieldErrors.baseAmount}>
                                            <Input
                                                id="exp-base"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                required
                                                value={form.baseAmount}
                                                onChange={(e) => handleBaseChange(e.target.value)}
                                                aria-invalid={!!fieldErrors.baseAmount}
                                                className="bg-card"
                                            />
                                        </FormField>
                                        <FormField id="exp-total" label="Total">
                                            <Input
                                                id="exp-total"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={totalInput}
                                                onChange={(e) => handleTotalChange(e.target.value)}
                                                className="bg-card"
                                            />
                                        </FormField>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField id="exp-iva" label="IVA %" error={fieldErrors.ivaRate}>
                                            <Input
                                                id="exp-iva"
                                                type="number"
                                                step="0.01"
                                                min={0}
                                                max={100}
                                                value={form.ivaRate}
                                                onChange={(e) => {
                                                    const next = e.target.value;
                                                    setField('ivaRate', next);
                                                    recalcWithRates(Number(next) || 0, Number(form.irpfRate) || 0);
                                                }}
                                                aria-invalid={!!fieldErrors.ivaRate}
                                                className="bg-card"
                                            />
                                        </FormField>
                                        <FormField id="exp-irpf" label="IRPF %" error={fieldErrors.irpfRate}>
                                            <Input
                                                id="exp-irpf"
                                                type="number"
                                                step="0.01"
                                                min={0}
                                                max={100}
                                                value={form.irpfRate}
                                                onChange={(e) => {
                                                    const next = e.target.value;
                                                    setField('irpfRate', next);
                                                    recalcWithRates(Number(form.ivaRate) || 0, Number(next) || 0);
                                                }}
                                                aria-invalid={!!fieldErrors.irpfRate}
                                                className="bg-card"
                                            />
                                        </FormField>
                                    </div>

                                    <BillingTotalsCard base={baseAmt} iva={ivaAmt} irpf={irpfAmt} total={totalAmt} />

                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField id="exp-status" label="Estado" error={fieldErrors.status}>
                                            <AppSelect
                                                id="exp-status"
                                                items={LEDGER_STATUSES.map((status) => ({
                                                    label: LEDGER_STATUS_LABELS[status],
                                                    value: status,
                                                }))}
                                                value={form.status}
                                                onValueChange={(value) => setField('status', value as LedgerStatus)}
                                                aria-invalid={!!fieldErrors.status}
                                            />
                                        </FormField>
                                        <FormField id="exp-date" label="Fecha gasto" error={fieldErrors.expenseDate}>
                                            <Input
                                                id="exp-date"
                                                type="date"
                                                value={form.expenseDate ?? ''}
                                                onChange={(e) => setField('expenseDate', e.target.value)}
                                                aria-invalid={!!fieldErrors.expenseDate}
                                                className="bg-card"
                                            />
                                        </FormField>
                                    </div>

                                    <fieldset className="grid gap-3 rounded-lg border border-border p-3">
                                        <legend className="px-1 text-sm font-medium text-foreground">Plazos de pago</legend>
                                        {fieldErrors.installments ? (
                                            <p className="text-sm text-destructive">{fieldErrors.installments}</p>
                                        ) : null}
                                        {(form.installments ?? []).length === 0 && (
                                            <p className="text-xs text-muted-foreground">Sin plazos (pago único)</p>
                                        )}
                                        {(form.installments ?? []).map((inst, idx) => (
                                            <div
                                                key={idx}
                                                className="grid gap-2 border-t border-border pt-3 first:border-0 first:pt-0"
                                            >
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
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={addInstallment}
                                            className="w-full"
                                        >
                                            <Plus />
                                            Añadir plazo
                                        </Button>
                                    </fieldset>

                                    <FormField id="exp-notes" label="Notas" error={fieldErrors.notes}>
                                        <Textarea
                                            id="exp-notes"
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

                        <SheetFooter>
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
                                        disabled={hydrating || saving || ocrLoading}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        form="expense-form"
                                        className="cursor-pointer"
                                        disabled={hydrating || saving || ocrLoading}
                                    >
                                        {saving ? 'Guardando…' : mode === 'add' ? 'Crear' : 'Guardar'}
                                    </Button>
                                </>
                            )}
                        </SheetFooter>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
