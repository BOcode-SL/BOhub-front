import { useEffect, useLayoutEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
    drivePreviewUrl,
    getPayment,
    type Installment,
    type LedgerStatus,
    type Payment,
    type PaymentInput,
} from '@/lib/billing';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { toastError } from '@/lib/toast';
import { listProjectOptions } from '@/lib/projects';
import { DrivePdfPane } from '@/pages/billing/DrivePdfPane';
import { cn } from '@/lib/utils';

type ProjectOpt = { id: number; name: string };

const empty: PaymentInput = {
    projectId: null,
    baseAmount: '',
    ivaRate: 21,
    irpfRate: 0,
    status: 'pending',
    paymentMethod: 'Transferencia Bancaria',
    invoiceDate: '',
    paymentDate: '',
    reference: '',
    notes: '',
    invoiceUrl: '',
    installments: [],
};

function toForm(p: Payment): PaymentInput {
    return {
        projectId: p.projectId,
        baseAmount: p.baseAmount ?? '',
        ivaRate: p.ivaRate ?? 21,
        irpfRate: p.irpfRate ?? 0,
        status: p.status,
        paymentMethod: p.paymentMethod ?? 'Transferencia Bancaria',
        invoiceDate: p.invoiceDate ?? '',
        paymentDate: p.paymentDate ?? '',
        reference: p.reference ?? '',
        notes: p.notes ?? '',
        invoiceUrl: p.invoiceUrl ?? '',
        installments: p.installments ?? [],
    };
}

type Props = {
    open: boolean;
    mode: 'add' | 'edit' | 'view';
    payment: Payment | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: PaymentInput) => Promise<void>;
    lockedProjectId?: number;
};

export function PaymentSheet({ open, mode, payment, onOpenChange, onSubmit, lockedProjectId }: Props) {
    const readOnly = mode === 'view';
    const [form, setForm] = useState<PaymentInput>(empty);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [projects, setProjects] = useState<ProjectOpt[]>([]);
    const [saving, setSaving] = useState(false);
    const [hydrating, setHydrating] = useState(false);
    const [lastEdited, setLastEdited] = useState<'base' | 'total'>('base');
    const [totalInput, setTotalInput] = useState('');

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
        if (mode === 'add' || !payment) {
            setHydrating(false);
            setForm({ ...empty, projectId: lockedProjectId ?? null });
            setTotalInput('');
            setLastEdited('base');
            return;
        }
        // list has baseAmount but omits iva/installments — hydrate when rates missing
        if (payment.ivaRate !== undefined) {
            setHydrating(false);
            const f = { ...toForm(payment), projectId: lockedProjectId ?? payment.projectId };
            setForm(f);
            const previewTotal = calcTotal(Number(f.baseAmount) || 0, Number(f.ivaRate) || 0, Number(f.irpfRate) || 0);
            setTotalInput(previewTotal.toFixed(2));
            setLastEdited('base');
            return;
        }
        setHydrating(true);
        setForm({ ...empty, projectId: lockedProjectId ?? null });
        setTotalInput('');
        setLastEdited('base');
        let cancelled = false;
        void getPayment(payment.id)
            .then((full) => {
                if (cancelled) return;
                const fullForm = { ...toForm(full), projectId: lockedProjectId ?? full.projectId };
                setForm(fullForm);
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
    }, [open, mode, payment, lockedProjectId]);

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

    function recalcFromBase() {
        const t = calcTotal(Number(form.baseAmount) || 0, Number(form.ivaRate) || 0, Number(form.irpfRate) || 0);
        setTotalInput(t.toFixed(2));
    }

    function recalcFromTotal() {
        const b = calcBaseFromTotal(Number(totalInput) || 0, Number(form.ivaRate) || 0, Number(form.irpfRate) || 0);
        setForm((prev) => ({ ...prev, baseAmount: b.toFixed(2) }));
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

    function handleRateChange() {
        if (lastEdited === 'base') {
            recalcFromBase();
        } else {
            recalcFromTotal();
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
        if (readOnly) return;
        setSaving(true);
        try {
            const suggested = suggestStatus();
            const installments = (form.installments ?? []).filter((i) => i.amount && Number(i.amount) > 0);
            // omit empty installments so paid/pending without plazos isn't reset by auto-status
            const hadInstallments = mode === 'edit' && (payment?.installments?.length ?? 0) > 0;
            await onSubmit({
                projectId: lockedProjectId ?? form.projectId ?? null,
                baseAmount: Number(form.baseAmount),
                ivaRate: Number(form.ivaRate) || 0,
                irpfRate: Number(form.irpfRate) || 0,
                status: suggested ?? form.status,
                paymentMethod: form.paymentMethod?.toString().trim() || null,
                invoiceDate: form.invoiceDate?.toString().trim() || null,
                paymentDate: form.paymentDate?.toString().trim() || null,
                reference: form.reference?.toString().trim() || null,
                notes: form.notes?.toString().trim() || null,
                invoiceUrl: form.invoiceUrl?.toString().trim() || null,
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

    const previewSrc = drivePreviewUrl(form.invoiceUrl);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                className={cn(
                    'flex w-full flex-col gap-0 p-0 transition-[max-width] data-[side=right]:w-full',
                    previewSrc ? 'sm:max-w-[1200px] data-[side=right]:sm:max-w-[1200px]' : 'sm:max-w-lg data-[side=right]:sm:max-w-lg',
                )}
            >
                <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
                    {previewSrc ? (
                        <div className="order-2 flex max-h-[40vh] min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-t border-border p-3 md:order-1 md:max-h-none md:min-h-0 md:flex-1 md:border-t-0 md:border-r md:p-6">
                            <DrivePdfPane url={form.invoiceUrl} className="h-full min-h-0 shadow-lg" />
                        </div>
                    ) : null}
                    <div
                        className={cn(
                            'order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:order-2',
                            previewSrc ? 'w-full md:w-[450px] md:flex-none md:shrink-0 lg:w-[500px]' : 'w-full',
                        )}
                    >
                <SheetHeader>
                    <SheetTitle>
                        {mode === 'add' ? 'Añadir ingreso' : mode === 'view' ? 'Ver ingreso' : 'Editar ingreso'}
                    </SheetTitle>
                    <SheetDescription>
                        {readOnly ? 'Detalle ledger (solo lectura).' : 'Ledger ingreso. Método e installments opcionales.'}
                    </SheetDescription>
                </SheetHeader>

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

                    <div className="grid grid-cols-2 gap-3">
                        <FormField id="pay-base" label="Base" error={fieldErrors.baseAmount}>
                            <Input
                                id="pay-base"
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
                        <FormField id="pay-total" label="Total (bruto)">
                            <Input
                                id="pay-total"
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
                        <FormField id="pay-iva" label="IVA %" error={fieldErrors.ivaRate}>
                            <Input
                                id="pay-iva"
                                type="number"
                                step="0.01"
                                min={0}
                                max={100}
                                value={form.ivaRate}
                                onChange={(e) => {
                                    setField('ivaRate', e.target.value);
                                    handleRateChange();
                                }}
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
                                value={form.irpfRate}
                                onChange={(e) => {
                                    setField('irpfRate', e.target.value);
                                    handleRateChange();
                                }}
                                aria-invalid={!!fieldErrors.irpfRate}
                                className="bg-card"
                            />
                        </FormField>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <FormField id="pay-status" label="Estado" error={fieldErrors.status}>
                            <AppSelect
                                id="pay-status"
                                items={LEDGER_STATUSES.map((status) => ({
                                    label: LEDGER_STATUS_LABELS[status],
                                    value: status,
                                }))}
                                value={form.status}
                                onValueChange={(value) => setField('status', value as LedgerStatus)}
                                aria-invalid={!!fieldErrors.status}
                            />
                        </FormField>
                        <FormField id="pay-inv-date" label="Fecha factura" error={fieldErrors.invoiceDate}>
                            <Input
                                id="pay-inv-date"
                                type="date"
                                value={form.invoiceDate ?? ''}
                                onChange={(e) => setField('invoiceDate', e.target.value)}
                                aria-invalid={!!fieldErrors.invoiceDate}
                                className="bg-card"
                            />
                        </FormField>
                    </div>

                    <FormField id="pay-ref" label="Referencia" error={fieldErrors.reference}>
                        <Input
                            id="pay-ref"
                            maxLength={120}
                            value={form.reference ?? ''}
                            onChange={(e) => setField('reference', e.target.value)}
                            aria-invalid={!!fieldErrors.reference}
                            className="bg-card"
                        />
                    </FormField>

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

                    <FormField id="pay-drive" label="URL Drive" error={fieldErrors.invoiceUrl}>
                        <Input
                            id="pay-drive"
                            type="text"
                            inputMode="url"
                            placeholder="https://drive.google.com/file/d/…/view"
                            value={form.invoiceUrl ?? ''}
                            onChange={(e) => setField('invoiceUrl', e.target.value)}
                            aria-invalid={!!fieldErrors.invoiceUrl}
                            className="bg-card"
                        />
                    </FormField>

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
                </SheetFooter>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
