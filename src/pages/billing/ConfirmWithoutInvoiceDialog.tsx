import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { confirmPaymentWithoutInvoice, formatMoney, type Payment } from '@/lib/billing';
import { toastError, toastSuccess } from '@/lib/toast';

type Props = {
    open: boolean;
    payment: Payment | null;
    onOpenChange: (open: boolean) => void;
    onConfirmed: (payment: Payment) => void;
};

/** Confirmación: resumen + checkbox antes de POST confirm-without-invoice. */
export function ConfirmWithoutInvoiceDialog({ open, payment, onOpenChange, onConfirmed }: Props) {
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
            const confirmed = await confirmPaymentWithoutInvoice(payment.id);
            toastSuccess('Cobro confirmado (sin factura)');
            setUnderstood(false);
            onOpenChange(false);
            onConfirmed(confirmed);
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
                    <DialogTitle>Confirmar cobro (sin factura)</DialogTitle>
                    <DialogDescription>
                        El ingreso pasará a pendiente sin número de factura ni PDF. Contabiliza en ingresos; no se envía
                        al cliente como factura ni entra en el export de gestoría.
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
                            Entiendo que no se generará factura ni PDF y el cobro quedará registrado en el hub.
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
                        {busy ? 'Confirmando…' : 'Confirmar cobro (sin factura)'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
