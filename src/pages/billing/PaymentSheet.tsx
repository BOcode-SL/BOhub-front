import { useEffect, useState, type FormEvent } from 'react';
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
    VERIFACTU_STATUSES,
    VERIFACTU_STATUS_LABELS,
    calcTotal,
    getPayment,
    type LedgerStatus,
    type Payment,
    type PaymentInput,
    type VerifactuStatus,
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
    paymentMethod: '',
    invoiceDate: '',
    paymentDate: '',
    reference: '',
    notes: '',
    externalSystem: '',
    externalInvoiceId: '',
    invoiceNumber: '',
    externalUrl: '',
    verifactuStatus: 'unknown',
    invoiceUrl: '',
    fileName: '',
};

function toForm(p: Payment): PaymentInput {
    return {
        projectId: p.projectId,
        baseAmount: p.baseAmount ?? '',
        ivaRate: p.ivaRate ?? 21,
        irpfRate: p.irpfRate ?? 0,
        status: p.status,
        paymentMethod: p.paymentMethod ?? '',
        invoiceDate: p.invoiceDate ?? '',
        paymentDate: p.paymentDate ?? '',
        reference: p.reference ?? '',
        notes: p.notes ?? '',
        externalSystem: p.externalSystem ?? '',
        externalInvoiceId: p.externalInvoiceId ?? '',
        invoiceNumber: p.invoiceNumber ?? '',
        externalUrl: p.externalUrl ?? '',
        verifactuStatus: p.verifactuStatus ?? 'unknown',
        invoiceUrl: p.invoiceUrl ?? '',
        fileName: p.fileName ?? '',
    };
}

type Props = {
    open: boolean;
    mode: 'add' | 'edit';
    payment: Payment | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: PaymentInput) => Promise<void>;
};

export function PaymentSheet({ open, mode, payment, onOpenChange, onSubmit }: Props) {
    const [form, setForm] = useState<PaymentInput>(empty);
    const [projects, setProjects] = useState<ProjectOpt[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
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
    }, [open]);

    useEffect(() => {
        if (!open) return;
        if (mode !== 'edit' || !payment) {
            setForm(empty);
            return;
        }
        setForm(toForm(payment));
        // list omits baseAmount — hydrate show() once
        if (payment.baseAmount !== undefined) return;
        let cancelled = false;
        void getPayment(payment.id)
            .then((full) => {
                if (!cancelled) setForm(toForm(full));
            })
            .catch((err) => {
                if (!cancelled) toastError(err);
            });
        return () => {
            cancelled = true;
        };
    }, [open, mode, payment]);

    function setField<K extends keyof PaymentInput>(key: K, value: PaymentInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    const preview = calcTotal(Number(form.baseAmount) || 0, Number(form.ivaRate) || 0, Number(form.irpfRate) || 0);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            await onSubmit({
                projectId: form.projectId || null,
                baseAmount: Number(form.baseAmount),
                ivaRate: Number(form.ivaRate) || 0,
                irpfRate: Number(form.irpfRate) || 0,
                status: form.status,
                paymentMethod: form.paymentMethod?.toString().trim() || null,
                invoiceDate: form.invoiceDate?.toString().trim() || null,
                paymentDate: form.paymentDate?.toString().trim() || null,
                reference: form.reference?.toString().trim() || null,
                notes: form.notes?.toString().trim() || null,
                externalSystem: form.externalSystem?.toString().trim() || null,
                externalInvoiceId: form.externalInvoiceId?.toString().trim() || null,
                invoiceNumber: form.invoiceNumber?.toString().trim() || null,
                externalUrl: form.externalUrl?.toString().trim() || null,
                verifactuStatus: form.verifactuStatus ?? 'unknown',
                invoiceUrl: form.invoiceUrl?.toString().trim() || null,
                fileName: form.fileName?.toString().trim() || null,
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
                    <SheetDescription>
                        Registro ledger. Emite la factura en tu app de facturación y registra aquí nº, enlace y PDF.
                    </SheetDescription>
                </SheetHeader>

                <form
                    id="payment-form"
                    className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
                    onSubmit={(e) => void handleSubmit(e)}
                >
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

                    <div className="grid grid-cols-3 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="pay-base">Base</Label>
                            <Input
                                id="pay-base"
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={form.baseAmount}
                                onChange={(e) => setField('baseAmount', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pay-iva">IVA %</Label>
                            <Input
                                id="pay-iva"
                                type="number"
                                step="0.01"
                                min={0}
                                max={100}
                                value={form.ivaRate}
                                onChange={(e) => setField('ivaRate', e.target.value)}
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
                                onChange={(e) => setField('irpfRate', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Total estimado: <span className="text-foreground">{preview.toFixed(2)} €</span>
                    </p>

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
                            <Label htmlFor="pay-method">Método</Label>
                            <Input
                                id="pay-method"
                                maxLength={80}
                                value={form.paymentMethod ?? ''}
                                onChange={(e) => setField('paymentMethod', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
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
                        <div className="grid gap-2">
                            <Label htmlFor="pay-pay-date">Fecha cobro</Label>
                            <Input
                                id="pay-pay-date"
                                type="date"
                                value={form.paymentDate ?? ''}
                                onChange={(e) => setField('paymentDate', e.target.value)}
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
                        <legend className="px-1 text-sm font-medium text-foreground">Factura externa</legend>
                        <div className="grid gap-2">
                            <Label htmlFor="pay-ext-system">Sistema (opcional)</Label>
                            <Input
                                id="pay-ext-system"
                                maxLength={80}
                                value={form.externalSystem ?? ''}
                                onChange={(e) => setField('externalSystem', e.target.value)}
                                className="bg-card"
                                placeholder="p. ej. manual"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pay-inv-num">Nº factura</Label>
                            <Input
                                id="pay-inv-num"
                                maxLength={120}
                                value={form.invoiceNumber ?? ''}
                                onChange={(e) => setField('invoiceNumber', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pay-ext-id">ID externo</Label>
                            <Input
                                id="pay-ext-id"
                                maxLength={120}
                                value={form.externalInvoiceId ?? ''}
                                onChange={(e) => setField('externalInvoiceId', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pay-ext-url">URL factura externa</Label>
                            <Input
                                id="pay-ext-url"
                                type="url"
                                maxLength={500}
                                value={form.externalUrl ?? ''}
                                onChange={(e) => setField('externalUrl', e.target.value)}
                                className="bg-card"
                                placeholder="https://…"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pay-verifactu">Verifactu</Label>
                            <AppSelect
                                id="pay-verifactu"
                                items={VERIFACTU_STATUSES.map((status) => ({
                                    label: VERIFACTU_STATUS_LABELS[status],
                                    value: status,
                                }))}
                                value={form.verifactuStatus ?? 'unknown'}
                                onValueChange={(value) =>
                                    setField('verifactuStatus', value as VerifactuStatus)
                                }
                            />
                        </div>
                    </fieldset>

                    <div className="grid gap-2">
                        <Label htmlFor="pay-pdf">URL PDF (stub)</Label>
                        <Input
                            id="pay-pdf"
                            type="url"
                            maxLength={500}
                            value={form.invoiceUrl ?? ''}
                            onChange={(e) => setField('invoiceUrl', e.target.value)}
                            className="bg-card"
                            placeholder="https://… (sin upload R2 aún)"
                        />
                    </div>

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
