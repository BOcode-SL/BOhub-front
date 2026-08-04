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
    getExpense,
    type Expense,
    type ExpenseInput,
    type Installment,
    type LedgerStatus,
} from '@/lib/billing';
import { toastError } from '@/lib/toast';
import { listProjectOptions } from '@/lib/projects';

type ProjectOpt = { id: number; name: string };

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
    mode: 'add' | 'edit';
    expense: Expense | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: ExpenseInput) => Promise<void>;
    lockedProjectId?: number;
};

export function ExpenseSheet({ open, mode, expense, onOpenChange, onSubmit, lockedProjectId }: Props) {
    const [form, setForm] = useState<ExpenseInput>(empty);
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
        if (mode !== 'edit' || !expense) {
            setForm({ ...empty, projectId: lockedProjectId ?? null });
            setTotalInput('');
            setLastEdited('base');
            return;
        }
        const f = { ...toForm(expense), projectId: lockedProjectId ?? expense.projectId };
        setForm(f);
        const previewTotal = calcTotal(Number(f.baseAmount) || 0, Number(f.ivaRate) || 0, Number(f.irpfRate) || 0);
        setTotalInput(previewTotal.toFixed(2));
        setLastEdited('base');
        if (expense.baseAmount !== undefined) return;
        let cancelled = false;
        void getExpense(expense.id)
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
    }, [open, mode, expense, lockedProjectId]);

    function setField<K extends keyof ExpenseInput>(key: K, value: ExpenseInput[K]) {
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
                    <SheetTitle>{mode === 'add' ? 'Añadir gasto' : 'Editar gasto'}</SheetTitle>
                    <SheetDescription>Factura recibida / gasto interno.</SheetDescription>
                </SheetHeader>

                <form
                    id="expense-form"
                    className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
                    onSubmit={(e) => void handleSubmit(e)}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="exp-desc">Descripción</Label>
                        <Input
                            id="exp-desc"
                            required
                            maxLength={255}
                            value={form.description}
                            onChange={(e) => setField('description', e.target.value)}
                            className="bg-card"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="exp-recipient">Proveedor</Label>
                            <Input
                                id="exp-recipient"
                                maxLength={255}
                                value={form.recipient ?? ''}
                                onChange={(e) => setField('recipient', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="exp-cat">Categoría</Label>
                            <Input
                                id="exp-cat"
                                value={form.category ?? ''}
                                onChange={(e) => setField('category', e.target.value)}
                                maxLength={120}
                                className="bg-card"
                            />
                        </div>
                    </div>

                    {!lockedProjectId && (
                        <div className="grid gap-2">
                            <Label htmlFor="exp-project">Proyecto</Label>
                            <EntitySelect
                                id="exp-project"
                                value={form.projectId ?? null}
                                onValueChange={(id) => setField('projectId', id)}
                                items={projects}
                                allowClear
                                placeholder="Sin proyecto"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="exp-base">Base</Label>
                            <Input
                                id="exp-base"
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
                            <Label htmlFor="exp-total">Total</Label>
                            <Input
                                id="exp-total"
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
                            <Label htmlFor="exp-iva">IVA %</Label>
                            <Input
                                id="exp-iva"
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
                            <Label htmlFor="exp-irpf">IRPF %</Label>
                            <Input
                                id="exp-irpf"
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
                            <Label htmlFor="exp-status">Estado</Label>
                            <AppSelect
                                id="exp-status"
                                items={LEDGER_STATUSES.map((status) => ({
                                    label: LEDGER_STATUS_LABELS[status],
                                    value: status,
                                }))}
                                value={form.status}
                                onValueChange={(value) => setField('status', value as LedgerStatus)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="exp-date">Fecha gasto</Label>
                            <Input
                                id="exp-date"
                                type="date"
                                value={form.expenseDate ?? ''}
                                onChange={(e) => setField('expenseDate', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                    </div>

                    <fieldset className="grid gap-3 rounded-lg border border-border p-3">
                        <legend className="px-1 text-sm font-medium text-foreground">Plazos de pago</legend>
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

                    <div className="grid gap-2">
                        <Label htmlFor="exp-notes">Notas</Label>
                        <Textarea
                            id="exp-notes"
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
                    <Button type="submit" form="expense-form" className="cursor-pointer" disabled={saving}>
                        {saving ? 'Guardando…' : mode === 'add' ? 'Crear' : 'Guardar'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
