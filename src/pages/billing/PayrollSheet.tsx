import { useEffect, useState, type FormEvent } from 'react';
import { AppSelect } from '@/components/app-select';
import { EntitySelect } from '@/components/entity-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
    PAYROLL_STATUSES,
    PAYROLL_STATUS_LABELS,
    drivePreviewUrl,
    formatMoney,
    type Payroll,
    type PayrollInput,
    type PayrollStatus,
} from '@/lib/billing';
import { listUsers, type HubUser } from '@/lib/users';
import { toastError } from '@/lib/toast';
import { DrivePdfPane } from '@/pages/billing/DrivePdfPane';
import { cn } from '@/lib/utils';

const MONTH_ITEMS = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i, 1).toLocaleString('es-ES', { month: 'long' }),
}));

const empty: PayrollInput = {
    employeeName: '',
    nif: '',
    category: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    baseSalary: '',
    netSalary: '',
    socialSecurityEmployer: '',
    irpfRetained: '',
    status: 'pending',
    paymentDate: '',
    invoiceUrl: '',
};

function toForm(p: Payroll): PayrollInput {
    return {
        employeeName: p.employeeName,
        nif: p.nif ?? '',
        category: p.category ?? '',
        month: p.month,
        year: p.year,
        baseSalary: p.baseSalary,
        netSalary: p.netSalary,
        socialSecurityEmployer: p.socialSecurityEmployer ?? '',
        irpfRetained: p.irpfRetained ?? '',
        status: p.status,
        paymentDate: p.paymentDate ?? '',
        invoiceUrl: p.invoiceUrl ?? '',
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
    const [users, setUsers] = useState<HubUser[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        void listUsers({ perPage: 50 })
            .then((res) => {
                if (!cancelled) setUsers(res.data);
            })
            .catch((err) => {
                if (!cancelled) toastError(err);
            });
        return () => {
            cancelled = true;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        setSelectedUserId(null);
        if (mode !== 'edit' || !editing) {
            setForm(empty);
            return;
        }
        setForm(toForm(editing));
    }, [open, mode, editing]);

    function setField<K extends keyof PayrollInput>(key: K, value: PayrollInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    function applyEmployee(userId: number | null) {
        setSelectedUserId(userId);
        if (userId == null) return;
        const u = users.find((row) => row.id === userId);
        if (!u) return;
        setForm((prev) => ({
            ...prev,
            employeeName: (u.employeeName || u.name).trim(),
            nif: u.dni?.trim() || '',
            category: u.category?.trim() || '',
        }));
    }

    const totalCost = Number(form.baseSalary || 0) + Number(form.socialSecurityEmployer || 0);
    const previewSrc = drivePreviewUrl(form.invoiceUrl);
    const employeeItems = users.map((u) => ({
        id: u.id,
        name: u.employeeName?.trim() || u.name,
    }));

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            await onSubmit({
                employeeName: form.employeeName.trim(),
                nif: form.nif?.toString().trim() || null,
                category: form.category?.toString().trim() || null,
                month: Number(form.month),
                year: Number(form.year),
                baseSalary: Number(form.baseSalary),
                netSalary: Number(form.netSalary),
                socialSecurityEmployer: form.socialSecurityEmployer ? Number(form.socialSecurityEmployer) : null,
                irpfRetained: form.irpfRetained ? Number(form.irpfRetained) : null,
                status: form.status,
                paymentDate: form.paymentDate?.toString().trim() || null,
                invoiceUrl: form.invoiceUrl?.toString().trim() || null,
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
            <SheetContent
                className={cn(
                    'flex w-full flex-col gap-0 p-0 transition-[max-width]',
                    previewSrc
                        ? 'data-[side=right]:w-[95vw] data-[side=right]:sm:max-w-[1200px]'
                        : 'data-[side=right]:sm:max-w-lg',
                )}
            >
                <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
                    {previewSrc ? (
                        <div className="flex min-h-[240px] min-w-0 flex-1 flex-col overflow-hidden border-b border-border p-4 md:min-h-0 md:border-r md:border-b-0 md:p-6">
                            <DrivePdfPane url={form.invoiceUrl} className="h-full shadow-lg" />
                        </div>
                    ) : null}
                    <div
                        className={cn(
                            'flex min-h-0 min-w-0 flex-col overflow-hidden',
                            previewSrc ? 'w-full md:w-[450px] md:shrink-0 lg:w-[500px]' : 'w-full flex-1',
                        )}
                    >
                        <SheetHeader>
                            <SheetTitle>{mode === 'add' ? 'Nueva nómina' : 'Editar nómina'}</SheetTitle>
                            <SheetDescription>
                                {mode === 'edit'
                                    ? 'Actualiza los detalles económicos de la nómina.'
                                    : 'Introduce los detalles económicos y el enlace al documento.'}
                            </SheetDescription>
                        </SheetHeader>

                        <form
                            id="payroll-form"
                            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
                            onSubmit={(e) => void handleSubmit(e)}
                        >
                            <div className="grid gap-2">
                                <Label htmlFor="pr-employee">Seleccionar empleado</Label>
                                <EntitySelect
                                    id="pr-employee"
                                    value={selectedUserId}
                                    onValueChange={applyEmployee}
                                    items={employeeItems}
                                    allowClear
                                    placeholder="Elige un empleado…"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="pr-name">
                                    Nombre del empleado <span className="text-destructive">*</span>
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
                                    <Label htmlFor="pr-nif">NIF / DNI</Label>
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

                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="pr-month">Mes</Label>
                                    <AppSelect
                                        id="pr-month"
                                        items={MONTH_ITEMS}
                                        value={String(form.month)}
                                        onValueChange={(value) => setField('month', Number(value))}
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
                                        Sueldo bruto (€) <span className="text-destructive">*</span>
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
                                        Sueldo neto (€) <span className="text-destructive">*</span>
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
                                    <Label htmlFor="pr-irpf">Retención IRPF (€)</Label>
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
                                <div className="grid gap-2">
                                    <Label htmlFor="pr-ss-emp">SS Empresa (€)</Label>
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
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="pr-drive">Enlace del documento</Label>
                                <Input
                                    id="pr-drive"
                                    type="text"
                                    inputMode="url"
                                    placeholder="https://drive.google.com/file/d/…/view"
                                    value={form.invoiceUrl ?? ''}
                                    onChange={(e) => setField('invoiceUrl', e.target.value)}
                                    className="bg-card"
                                />
                            </div>

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
                                    <Label htmlFor="pr-pay-date">Fecha de pago</Label>
                                    <Input
                                        id="pr-pay-date"
                                        type="date"
                                        value={form.paymentDate ?? ''}
                                        onChange={(e) => setField('paymentDate', e.target.value)}
                                        className="bg-card"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                                <span className="text-sm font-medium">Coste total empresa</span>
                                <span className="text-base font-semibold">{formatMoney(totalCost)}</span>
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
                                {saving ? 'Guardando…' : mode === 'add' ? 'Crear nómina' : 'Guardar'}
                            </Button>
                        </SheetFooter>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
