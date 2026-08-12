import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { emitPayment, formatMoney, type Payment } from '@/lib/billing';
import { toastError, toastSuccess } from '@/lib/toast';

type Props = {
    open: boolean;
    payment: Payment | null;
    onOpenChange: (open: boolean) => void;
    onEmitted: (payment: Payment) => void;
};

/** Doble confirmación: resumen + checkbox antes de POST emit. */
export function EmitPaymentDialog({ open, payment, onOpenChange, onEmitted }: Props) {
    const [understood, setUnderstood] = useState(false);
    const [busy, setBusy] = useState(false);

    function handleOpenChange(next: boolean) {
        if (busy) return;
        if (!next) setUnderstood(false);
        onOpenChange(next);
    }

    async function confirm() {
        if (!payment || !understood) return;
        setBusy(true);
        try {
            const emitted = await emitPayment(payment.id);
            toastSuccess(`Factura emitida · ${emitted.invoiceNumber ?? '—'}`);
            setUnderstood(false);
            onOpenChange(false);
            onEmitted(emitted);
        } catch (err) {
            toastError(err);
        } finally {
            setBusy(false);
        }
    }

    const clientName = payment?.project?.client?.name ?? '—';
    const lines = payment?.lines?.filter((l) => l.description?.toString().trim()) ?? [];
    const concept =
        lines.length === 0
            ? '—'
            : lines.length === 1
              ? lines[0].description
              : `${lines[0].description} (+${lines.length - 1})`;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Emitir factura</DialogTitle>
                    <DialogDescription>
                        Se asignará un número correlativo y los datos fiscales quedarán bloqueados. No se podrá volver a
                        borrador ni eliminar esta factura.
                    </DialogDescription>
                </DialogHeader>
                <dl className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Cliente</dt>
                        <dd className="text-right font-medium text-foreground">{clientName}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Concepto</dt>
                        <dd className="max-w-[60%] text-right font-medium text-foreground">{concept}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Total</dt>
                        <dd className="text-right font-medium text-foreground">
                            {formatMoney(payment?.totalAmount ?? 0)}
                        </dd>
                    </div>
                </dl>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                        type="checkbox"
                        className="mt-1 size-4 accent-primary"
                        checked={understood}
                        onChange={(e) => setUnderstood(e.target.checked)}
                        disabled={busy}
                    />
                    <span>
                        <Label className="cursor-pointer font-normal">
                            Entiendo que la factura quedará emitida y no se podrá modificar fiscalmente.
                        </Label>
                    </span>
                </label>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer"
                        disabled={busy}
                        onClick={() => handleOpenChange(false)}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        className="cursor-pointer"
                        disabled={!understood || busy || !payment}
                        onClick={() => void confirm()}
                    >
                        {busy ? 'Emitiendo…' : 'Confirmar emisión'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
