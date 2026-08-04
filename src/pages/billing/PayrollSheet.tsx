import { useEffect, useState, type FormEvent } from 'react';
import { AppSelect } from '@/components/app-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
    PAYROLL_STATUSES,
    PAYROLL_STATUS_LABELS,
    formatMoney,
    getPayroll,
    type Payroll,
    type PayrollInput,
    type PayrollStatus,
} from '@/lib/billing';
import { toastError } from '@/lib/toast';

const empty: PayrollInput = {
    employeeName: '',
    nif: '',
    category: '',
    socialSecurityNumber: '',
    iban: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    baseSalary: '',
    netSalary: '',
    socialSecurityEmployer: '',
    irpfRetained: '',
    status: 'pending',
    paymentDate: '',
    notes: '',
};

function toForm(p: Payroll): PayrollInput {
    return {
        employeeName: p.employeeName,
        nif: p.nif ?? '',
        category: p.category ?? '',
        socialSecurityNumber: p.socialSecurityNumber ?? '',
        iban: p.iban ?? '',
        month: p.month,
        year: p.year,
        baseSalary: p.baseSalary,
        netSalary: p.netSalary,
        socialSecurityEmployer: p.socialSecurityEmployer ?? '',
        irpfRetained: p.irpfRetained ?? '',
        status: p.status,
        paymentDate: p.paymentDate ?? '',
        notes: p.notes ?? '',
    };
}

type Props = {
    open: boolean;
    mode: 'add' | 'edit';
    editing: Payroll | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: PayrollInput) => Promise<void>;
};

export function PayrollSheet({ open, mode, editing, onOpenChange, onSubmit }: Props) {
    const [form, setForm] = useState<PayrollInput>(empty);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        if (mode !== 'edit' || !editing) {
            setForm(empty);
            return;
        }
        setForm(toForm(editing));
        if (editing.baseSalary !== undefined) return;
        let cancelled = false;
        void getPayroll(editing.id)
            .then((full) => {
                if (!cancelled) setForm(toForm(full));
            })
            .catch((err) => {
                if (!cancelled) toastError(err);
            });
        return () => {
            cancelled = true;
        };
    }, [open, mode, editing]);

    function setField<K extends keyof PayrollInput>(key: K, value: PayrollInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    const totalCost = Number(form.baseSalary || 0) + Number(form.socialSecurityEmployer || 0);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            await onSubmit({
                employeeName: form.employeeName.trim(),
                nif: form.nif?.toString().trim() || null,
                category: form.category?.toString().trim() || null,
                socialSecurityNumber: form.socialSecurityNumber?.toString().trim() || null,
                iban: form.iban?.toString().trim() || null,
                month: Number(form.month),
                year: Number(form.year),
                baseSalary: Number(form.baseSalary),
                netSalary: Number(form.netSalary),
                socialSecurityEmployer: form.socialSecurityEmployer ? Number(form.socialSecurityEmployer) : null,
                irpfRetained: form.irpfRetained ? Number(form.irpfRetained) : null,
                status: form.status,
                paymentDate: form.paymentDate?.toString().trim() || null,
                notes: form.notes?.toString().trim() || null,
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
                    <SheetTitle>{mode === 'add' ? 'Añadir nómina' : 'Editar nómina'}</SheetTitle>
                    <SheetDescription>Registro de nómina mensual.</SheetDescription>
                </SheetHeader>

                <form
                    id="payroll-form"
                    className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
                    onSubmit={(e) => void handleSubmit(e)}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="pr-name">
                            Nombre empleado <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="pr-name"
                            required
                            maxLength={255}
                            value={form.employeeName}
                            onChange={(e) => setField('employeeName', e.target.value)}
                            className="bg-card"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="pr-nif">NIF</Label>
                            <Input
                                id="pr-nif"
                                maxLength={20}
                                value={form.nif ?? ''}
                                onChange={(e) => setField('nif', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pr-cat">Categoría</Label>
                            <Input
                                id="pr-cat"
                                maxLength={100}
                                value={form.category ?? ''}
                                onChange={(e) => setField('category', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="pr-ss">Nº Seguridad Social</Label>
                        <Input
                            id="pr-ss"
                            maxLength={50}
                            value={form.socialSecurityNumber ?? ''}
                            onChange={(e) => setField('socialSecurityNumber', e.target.value)}
                            className="bg-card"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="pr-iban">IBAN</Label>
                        <Input
                            id="pr-iban"
                            maxLength={50}
                            value={form.iban ?? ''}
                            onChange={(e) => setField('iban', e.target.value)}
                            className="bg-card"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="pr-month">
                                Mes <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="pr-month"
                                type="number"
                                min={1}
                                max={12}
                                required
                                value={form.month}
                                onChange={(e) => setField('month', Number(e.target.value))}
                                className="bg-card"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pr-year">
                                Año <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="pr-year"
                                type="number"
                                min={2000}
                                max={2100}
                                required
                                value={form.year}
                                onChange={(e) => setField('year', Number(e.target.value))}
                                className="bg-card"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="pr-base">
                                Salario Base <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="pr-base"
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={form.baseSalary}
                                onChange={(e) => setField('baseSalary', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pr-net">
                                Salario Neto <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="pr-net"
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={form.netSalary}
                                onChange={(e) => setField('netSalary', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="pr-ss-emp">SS Empresa</Label>
                            <Input
                                id="pr-ss-emp"
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.socialSecurityEmployer ?? ''}
                                onChange={(e) => setField('socialSecurityEmployer', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pr-irpf">IRPF Retenido</Label>
                            <Input
                                id="pr-irpf"
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.irpfRetained ?? ''}
                                onChange={(e) => setField('irpfRetained', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                        Coste total: <span className="text-foreground">{formatMoney(totalCost)}</span> (servidor calcula)
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="pr-status">Estado</Label>
                            <AppSelect
                                id="pr-status"
                                items={PAYROLL_STATUSES.map((status) => ({
                                    label: PAYROLL_STATUS_LABELS[status],
                                    value: status,
                                }))}
                                value={form.status}
                                onValueChange={(value) => setField('status', value as PayrollStatus)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pr-pay-date">Fecha pago</Label>
                            <Input
                                id="pr-pay-date"
                                type="date"
                                value={form.paymentDate ?? ''}
                                onChange={(e) => setField('paymentDate', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="pr-notes">Notas</Label>
                        <Textarea
                            id="pr-notes"
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
                    <Button type="submit" form="payroll-form" className="cursor-pointer" disabled={saving}>
                        {saving ? 'Guardando…' : mode === 'add' ? 'Crear' : 'Guardar'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
