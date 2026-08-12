import { useState } from 'react';
import { AppSelect } from '@/components/app-select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    downloadBillingExport,
    formatMoney,
    previewBillingExport,
    type BillingExportItem,
    type BillingExportPreview,
} from '@/lib/billing';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Seed year from Resumen toolbar. */
    defaultYear?: number;
};

const MONTH_ITEMS = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i, 1).toLocaleString('es-ES', { month: 'long' }),
}));

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function defaultIds(items: BillingExportItem[]): Set<number> {
    return new Set(items.filter((i) => i.hasFile).map((i) => i.id));
}

function ExportChecklist({
    title,
    items,
    selected,
    onChange,
    disabled,
}: {
    title: string;
    items: BillingExportItem[];
    selected: Set<number>;
    onChange: (next: Set<number>) => void;
    disabled?: boolean;
}) {
    const withFile = items.filter((i) => i.hasFile);

    function setAll(on: boolean) {
        const next = new Set(selected);
        for (const i of withFile) {
            if (on) next.add(i.id);
            else next.delete(i.id);
        }
        onChange(next);
    }

    return (
        <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{title}</p>
                <div className="flex gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 cursor-pointer px-2 text-xs"
                        disabled={disabled || withFile.length === 0}
                        onClick={() => setAll(true)}
                    >
                        Todos
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 cursor-pointer px-2 text-xs"
                        disabled={disabled || withFile.length === 0}
                        onClick={() => setAll(false)}
                    >
                        Ninguno
                    </Button>
                </div>
            </div>
            {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ninguno en este mes.</p>
            ) : (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                    {items.map((item) => {
                        const can = item.hasFile;
                        return (
                            <li key={item.id}>
                                <label
                                    className={cn(
                                        'flex items-start gap-2 rounded-md px-1.5 py-1 text-sm',
                                        can ? 'cursor-pointer hover:bg-muted/50' : 'cursor-not-allowed opacity-60',
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 size-4 shrink-0 accent-primary"
                                        checked={can && selected.has(item.id)}
                                        disabled={!can || disabled}
                                        onChange={(e) => {
                                            const next = new Set(selected);
                                            if (e.target.checked) next.add(item.id);
                                            else next.delete(item.id);
                                            onChange(next);
                                        }}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium text-foreground">{item.label}</span>
                                        <span className="block text-xs text-muted-foreground">
                                            {item.date ?? '—'} · {formatMoney(item.totalAmount)}
                                            {!can ? ' · Sin archivo en BOhub' : null}
                                        </span>
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/** Export mensual gestoría: periodo → exclusión → confirm → ZIP. */
export function BillingExportDialog({ open, onOpenChange, defaultYear }: Props) {
    const now = new Date();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [year, setYear] = useState(defaultYear ?? now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [preview, setPreview] = useState<BillingExportPreview | null>(null);
    const [paymentIds, setPaymentIds] = useState<Set<number>>(new Set());
    const [expenseIds, setExpenseIds] = useState<Set<number>>(new Set());
    const [confirmed, setConfirmed] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [busy, setBusy] = useState(false);

    const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);
    const selectedCount = paymentIds.size + expenseIds.size;
    const missingCount = preview
        ? preview.payments.filter((p) => !p.hasFile).length + preview.expenses.filter((e) => !e.hasFile).length
        : 0;

    function reset() {
        setStep(1);
        setPreview(null);
        setPaymentIds(new Set());
        setExpenseIds(new Set());
        setConfirmed(false);
        setLoadingPreview(false);
        setBusy(false);
        setYear(defaultYear ?? new Date().getFullYear());
        setMonth(new Date().getMonth() + 1);
    }

    function handleOpenChange(next: boolean) {
        if (busy) return;
        if (!next) reset();
        else {
            setYear(defaultYear ?? new Date().getFullYear());
            setMonth(new Date().getMonth() + 1);
            setStep(1);
            setPreview(null);
            setConfirmed(false);
        }
        onOpenChange(next);
    }

    async function loadPreviewAndContinue() {
        setLoadingPreview(true);
        try {
            const data = await previewBillingExport({ year, month });
            setPreview(data);
            setPaymentIds(defaultIds(data.payments));
            setExpenseIds(defaultIds(data.expenses));
            setConfirmed(false);
            setStep(2);
        } catch (err) {
            toastError(err);
        } finally {
            setLoadingPreview(false);
        }
    }

    async function generateZip() {
        if (!confirmed || selectedCount === 0) return;
        setBusy(true);
        try {
            await downloadBillingExport({
                year,
                month,
                paymentIds: [...paymentIds],
                expenseIds: [...expenseIds],
                confirmed: true,
            });
            toastSuccess('ZIP de gestoría descargado');
            setBusy(false);
            handleOpenChange(false);
        } catch (err) {
            toastError(err);
            setBusy(false);
        }
    }

    const periodLabel = `${MONTH_SHORT[month - 1] ?? month} ${year}`;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Exportar para gestoría</DialogTitle>
                    <DialogDescription>
                        {step === 1 && 'Elige el mes. Solo se incluyen archivos guardados en BOhub.'}
                        {step === 2 && 'Desmarca lo que no quieras enviar. Los sin archivo no se pueden incluir.'}
                        {step === 3 && 'Revisa el resumen y confirma antes de generar el ZIP.'}
                    </DialogDescription>
                </DialogHeader>

                {step === 1 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="export-year">Año</Label>
                            <AppSelect
                                id="export-year"
                                items={years.map((y) => ({ label: String(y), value: String(y) }))}
                                value={String(year)}
                                onValueChange={(v) => {
                                    if (v) setYear(Number(v));
                                }}
                                groupLabel="Año"
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="export-month">Mes</Label>
                            <AppSelect
                                id="export-month"
                                items={MONTH_ITEMS}
                                value={String(month)}
                                onValueChange={(v) => {
                                    if (v) setMonth(Number(v));
                                }}
                                groupLabel="Mes"
                                className="w-full"
                            />
                        </div>
                    </div>
                )}

                {step === 2 && preview && (
                    <div className="space-y-4">
                        {missingCount > 0 ? (
                            <p className="text-sm text-amber-500">
                                {missingCount} sin archivo en BOhub (no se pueden incluir).
                            </p>
                        ) : null}
                        <ExportChecklist
                            title="Ingresos"
                            items={preview.payments}
                            selected={paymentIds}
                            onChange={setPaymentIds}
                            disabled={busy}
                        />
                        <ExportChecklist
                            title="Gastos"
                            items={preview.expenses}
                            selected={expenseIds}
                            onChange={setExpenseIds}
                            disabled={busy}
                        />
                        <p className="text-sm text-muted-foreground">{selectedCount} archivos seleccionados</p>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4">
                        <dl className="grid gap-2 text-sm">
                            <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">Periodo</dt>
                                <dd className="font-medium text-foreground">{periodLabel}</dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">Ingresos</dt>
                                <dd className="font-medium text-foreground">{paymentIds.size}</dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">Gastos</dt>
                                <dd className="font-medium text-foreground">{expenseIds.size}</dd>
                            </div>
                        </dl>
                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                            <input
                                type="checkbox"
                                className="mt-1 size-4 accent-primary"
                                checked={confirmed}
                                onChange={(e) => setConfirmed(e.target.checked)}
                                disabled={busy}
                            />
                            <Label className="cursor-pointer font-normal">
                                He revisado la lista y confirmo la exportación
                            </Label>
                        </label>
                    </div>
                )}

                <DialogFooter className="gap-2 sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {step > 1 ? (
                            <Button
                                type="button"
                                variant="outline"
                                className="cursor-pointer"
                                disabled={busy || loadingPreview}
                                onClick={() => {
                                    setConfirmed(false);
                                    setStep((s) => (s === 3 ? 2 : 1) as 1 | 2);
                                }}
                            >
                                Atrás
                            </Button>
                        ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer"
                            disabled={busy}
                            onClick={() => handleOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        {step === 1 && (
                            <Button
                                type="button"
                                className="cursor-pointer"
                                disabled={loadingPreview}
                                onClick={() => void loadPreviewAndContinue()}
                            >
                                {loadingPreview ? 'Cargando…' : 'Continuar'}
                            </Button>
                        )}
                        {step === 2 && (
                            <Button
                                type="button"
                                className="cursor-pointer"
                                disabled={selectedCount === 0}
                                onClick={() => setStep(3)}
                            >
                                Continuar
                            </Button>
                        )}
                        {step === 3 && (
                            <Button
                                type="button"
                                className="cursor-pointer"
                                disabled={!confirmed || busy || selectedCount === 0}
                                onClick={() => void generateZip()}
                            >
                                {busy ? 'Generando…' : 'Generar ZIP'}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
