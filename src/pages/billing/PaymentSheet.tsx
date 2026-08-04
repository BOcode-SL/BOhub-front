import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AppSelect } from '@/components/app-select';
import { EntitySelect } from '@/components/entity-select';
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
    getPayment,
    type Installment,
    type LedgerStatus,
    type Payment,
    type PaymentInput,
} from '@/lib/billing';
import { toastError } from '@/lib/toast';
import { listProjectOptions } from '@/lib/projects';

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
        installments: p.installments ?? [],
    };
}

type Props = {
    open: boolean;
    mode: 'add' | 'edit';
    payment: Payment | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: PaymentInput) => Promise<void>;
    lockedProjectId?: number;
};

export function PaymentSheet({ open, mode, payment, onOpenChange, onSubmit, lockedProjectId }: Props) {
    const [form, setForm] = useState<PaymentInput>(empty);
    const [projects, setProjects] = useState<ProjectOpt[]>([]);
    const [saving, setSaving] = useState(false);
    const [lastEdited, setLastEdited] = useState<'base' | 'total'>('base');
    const [totalInput, setTotalInput] = useState('');

    useEffect(() => {
        if (!open || lockedProjectId) return;
        let cancelled = false;
        void listProjectOptions()
            .then((rows) => {
                if (!cancelled) setProjects(rows);
            })
            .catch((err) => {
                if (!cancelled) toastError(err);
            });
        return () => {
            cancelled = true;
        };
    }, [open, lockedProjectId]);

    useEffect(() => {
        if (!open) return;
        if (mode !== 'edit' || !payment) {
            setForm({ ...empty, projectId: lockedProjectId ?? null });
            setTotalInput('');
            setLastEdited('base');
            return;
        }
        const f = { ...toForm(payment), projectId: lockedProjectId ?? payment.projectId };
        setForm(f);
        const previewTotal = calcTotal(Number(f.baseAmount) || 0, Number(f.ivaRate) || 0, Number(f.irpfRate) || 0);
        setTotalInput(previewTotal.toFixed(2));
        setLastEdited('base');
        if (payment.baseAmount !== undefined) return;
        let cancelled = false;
        void getPayment(payment.id)
            .then((full) => {
                if (!cancelled) {
                    const fullForm = { ...toForm(full), projectId: lockedProjectId ?? full.projectId };
                    setForm(fullForm);
                    const t = calcTotal(
                        Number(fullForm.baseAmount) || 0,
                        Number(fullForm.ivaRate) || 0,
                        Number(fullForm.irpfRate) || 0,
                    );
                    setTotalInput(t.toFixed(2));
                }
            })
            .catch((err) => {
                if (!cancelled) toastError(err);
            });
        return () => {
            cancelled = true;
        };
    }, [open, mode, payment, lockedProjectId]);

    function setField<K extends keyof PaymentInput>(key: K, value: PaymentInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
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
        setForm((prev) => ({
            ...prev,
            installments: [
                ...(prev.installments ?? []),
                { amount: '', paidOn: '', method: 'Transferencia Bancaria', notes: '' },
            ],
        }));
    }

    function removeInstallment(idx: number) {
        setForm((prev) => ({
            ...prev,
            installments: (prev.installments ?? []).filter((_, i) => i !== idx),
        }));
    }

    function updateInstallment(idx: number, field: keyof Installment, value: string | null) {
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
                ...(installments.length > 0 || hadInstallments ? { installments } : {}),
            });
            onOpenChange(false);
        } catch (err) {
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="flex w-full flex-col sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>{mode === 'add' ? 'Añadir ingreso' : 'Editar ingreso'}</SheetTitle>
                    <SheetDescription>Ledger ingreso. Método e installments opcionales.</SheetDescription>
                </SheetHeader>

                <form
                    id="payment-form"
                    className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
                    onSubmit={(e) => void handleSubmit(e)}
                >
                    {!lockedProjectId && (
                        <div className="grid gap-2">
                            <Label htmlFor="pay-project">Proyecto</Label>
                            <EntitySelect
                                id="pay-project"
                                value={form.projectId ?? null}
                                onValueChange={(id) => setField('projectId', id)}
                                items={projects}
                                allowClear
                                placeholder="Sin proyecto"
                            />
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="pay-method">Método de pago</Label>
                        <AppSelect
                            id="pay-method"
                            items={PAYMENT_METHODS.map((m) => ({ label: m, value: m }))}
                            value={form.paymentMethod ?? 'Transferencia Bancaria'}
                            onValueChange={(value) => setField('paymentMethod', value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="pay-base">Base</Label>
                            <Input
                                id="pay-base"
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={form.baseAmount}
                                onChange={(e) => handleBaseChange(e.target.value)}
                                className="bg-card"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pay-total">Total (bruto)</Label>
                            <Input
                                id="pay-total"
                                type="number"
                                step="0.01"
                                min="0"
                                value={totalInput}
                                onChange={(e) => handleTotalChange(e.target.value)}
                                className="bg-card"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="pay-iva">IVA %</Label>
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
                                className="bg-card"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pay-irpf">IRPF %</Label>
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
                                className="bg-card"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="pay-status">Estado</Label>
                            <AppSelect
                                id="pay-status"
                                items={LEDGER_STATUSES.map((status) => ({
                                    label: LEDGER_STATUS_LABELS[status],
                                    value: status,
                                }))}
                                value={form.status}
                                onValueChange={(value) => setField('status', value as LedgerStatus)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pay-inv-date">Fecha factura</Label>
                            <Input
                                id="pay-inv-date"
                                type="date"
                                value={form.invoiceDate ?? ''}
                                onChange={(e) => setField('invoiceDate', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="pay-ref">Referencia</Label>
                        <Input
                            id="pay-ref"
                            maxLength={120}
                            value={form.reference ?? ''}
                            onChange={(e) => setField('reference', e.target.value)}
                            className="bg-card"
                        />
                    </div>

                    <fieldset className="grid gap-3 rounded-lg border border-border p-3">
                        <legend className="flex items-center justify-between px-1 text-sm font-medium text-foreground">
                            <span>Plazos de pago</span>
                            <Button type="button" variant="ghost" size="icon-sm" onClick={addInstallment}>
                                <Plus />
                            </Button>
                        </legend>
                        {(form.installments ?? []).length === 0 && (
                            <p className="text-xs text-muted-foreground">Sin plazos (pago único)</p>
                        )}
                        {(form.installments ?? []).map((inst, idx) => (
                            <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
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
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => removeInstallment(idx)}
                                    className="mt-5"
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        ))}
                    </fieldset>

                    <div className="grid gap-2">
                        <Label htmlFor="pay-notes">Notas</Label>
                        <Textarea
                            id="pay-notes"
                            value={form.notes ?? ''}
                            onChange={(e) => setField('notes', e.target.value)}
                            rows={3}
                            className="bg-card"
                        />
                    </div>
                </form>

                <SheetFooter>
                    <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancelar
                    </Button>
                    <Button type="submit" form="payment-form" className="cursor-pointer" disabled={saving}>
                        {saving ? 'Guardando…' : mode === 'add' ? 'Crear' : 'Guardar'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
