import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { FormFieldsSkeleton } from '@/components/form-fields-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import {
    formatMoney,
    isPaymentIssued,
    previewInvoiceSend,
    sendInvoice,
    type InvoiceSendPreview,
    type Payment,
} from '@/lib/billing';
import { fqdnEmailError, substituteVars } from '@/lib/emails';
import { toastError, toastSuccess } from '@/lib/toast';
import { EmailHtmlPane } from '@/pages/emails/EmailHtmlPane';
import { cn } from '@/lib/utils';

type Props = {
    open: boolean;
    payment: Payment | null;
    onOpenChange: (open: boolean) => void;
    onSent?: () => void;
};

/** Envío factura emitida: preview API + doble confirmación (checkbox). PDF lo adjunta el server (R2). */
export function SendInvoiceDialog({ open, payment, onOpenChange, onSent }: Props) {
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [preview, setPreview] = useState<InvoiceSendPreview | null>(null);
    const [to, setTo] = useState('');
    const [cc, setCc] = useState('');
    const [vars, setVars] = useState<Record<string, string>>({});
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!open || !payment || !isPaymentIssued(payment.status)) {
            return;
        }

        setConfirmed(false);
        setFieldErrors({});
        setPreview(null);
        setLoading(true);
        let cancelled = false;

        void previewInvoiceSend(payment.id)
            .then((data) => {
                if (cancelled) return;
                setPreview(data);
                setTo(data.to ?? '');
                setCc(data.cc ?? '');
                setVars({ ...data.variables });
            })
            .catch((err) => {
                if (cancelled) return;
                if (err instanceof ApiError && err.fieldErrors) {
                    setFieldErrors(flattenFieldErrors(err.fieldErrors));
                }
                toastError(err);
                onOpenChange(false);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, payment, onOpenChange]);

    function handleOpenChange(next: boolean) {
        if (sending) return;
        if (!next) {
            setConfirmed(false);
            setPreview(null);
            setFieldErrors({});
        }
        onOpenChange(next);
    }

    function clearFieldError(key: string) {
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    const deferredVars = useDeferredValue(vars);
    const previewHtml = useMemo(() => {
        if (!preview?.htmlPreview) return '';
        // ponytail: re-apply vars over already-substituted preview by replacing known values is fragile;
        // rebuild from placeholders if still present, else patch server preview with known values.
        let html = preview.htmlPreview;
        const original = preview.variables ?? {};
        for (const [key, value] of Object.entries(deferredVars)) {
            const prev = original[key];
            if (prev != null && prev !== '' && prev !== value) {
                html = html.split(prev).join(value);
            }
            html = substituteVars(html, { [key]: value });
        }
        return html;
    }, [preview, deferredVars]);

    const subjectPreview = useMemo(() => {
        if (!preview?.subject) return '';
        let subject = preview.subject;
        const original = preview.variables ?? {};
        for (const [key, value] of Object.entries(deferredVars)) {
            const prev = original[key];
            if (prev != null && prev !== '' && prev !== value) {
                subject = subject.split(prev).join(value);
            }
            subject = substituteVars(subject, { [key]: value });
        }
        return subject;
    }, [preview, deferredVars]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!payment || !confirmed || !to.trim()) return;

        const nextErrors: Record<string, string> = {};
        const toErr = fqdnEmailError(to);
        if (toErr) nextErrors.to = toErr;
        const ccErr = fqdnEmailError(cc);
        if (ccErr) nextErrors.cc = ccErr;
        if (Object.keys(nextErrors).length) {
            setFieldErrors(nextErrors);
            return;
        }

        setSending(true);
        try {
            await sendInvoice(payment.id, {
                to: to.trim(),
                cc: cc.trim() || null,
                variables: vars,
            });
            toastSuccess(`Factura enviada a ${to.trim()}`);
            setConfirmed(false);
            onOpenChange(false);
            onSent?.();
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) {
                setFieldErrors(flattenFieldErrors(err.fieldErrors));
            }
            toastError(err);
        } finally {
            setSending(false);
        }
    }

    const clientName = payment?.project?.client?.name ?? vars.CLIENT_NAME ?? '—';
    const invoiceNumber = payment?.invoiceNumber ?? vars.INVOICE_NUMBER ?? '—';
    const showPreview = Boolean(previewHtml.trim());

    return (
        <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetContent
                className={cn(
                    'flex w-full flex-col gap-0 p-0 transition-[max-width] data-[side=right]:w-full',
                    showPreview ? 'sm:max-w-[1200px] data-[side=right]:sm:max-w-[1200px]' : 'sm:max-w-lg data-[side=right]:sm:max-w-lg',
                )}
            >
                <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
                    {showPreview ? (
                        <div className="order-2 flex max-h-[40vh] min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-t border-border p-3 md:order-1 md:max-h-none md:min-h-0 md:flex-1 md:border-t-0 md:border-r md:p-6">
                            <EmailHtmlPane
                                html={previewHtml}
                                subject={subjectPreview}
                                emptyLabel="Sin vista previa"
                                className="h-full min-h-0 shadow-lg"
                            />
                        </div>
                    ) : null}
                    <div
                        className={cn(
                            'order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:order-2',
                            showPreview ? 'w-full md:w-[450px] md:flex-none md:shrink-0 lg:w-[500px]' : 'w-full',
                        )}
                    >
                        <SheetHeader>
                            <SheetTitle>Enviar factura al cliente</SheetTitle>
                            <SheetDescription>
                                Se adjuntará el PDF archivado. Confirma el destinatario antes de enviar.
                            </SheetDescription>
                        </SheetHeader>

                        {loading || !preview ? (
                            <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4">
                                <FormFieldsSkeleton fields={5} />
                            </div>
                        ) : (
                            <form
                                onSubmit={(e) => void handleSubmit(e)}
                                noValidate
                                className="flex min-h-0 flex-1 flex-col"
                            >
                                <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
                                    <dl className="grid gap-2 rounded-md border border-border p-3 text-sm">
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-muted-foreground">Cliente</dt>
                                            <dd className="text-right font-medium text-foreground">{clientName}</dd>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-muted-foreground">Nº factura</dt>
                                            <dd className="text-right font-mono font-medium text-foreground">
                                                {invoiceNumber}
                                            </dd>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-muted-foreground">Total</dt>
                                            <dd className="text-right font-medium text-foreground">
                                                {formatMoney(payment?.totalAmount ?? 0)}
                                            </dd>
                                        </div>
                                    </dl>

                                    {(fieldErrors['client.email'] || fieldErrors.status || fieldErrors.issuer) && (
                                        <p className="text-sm text-destructive">
                                            {fieldErrors['client.email'] || fieldErrors.status || fieldErrors.issuer}
                                        </p>
                                    )}

                                    <FormField id="inv-send-to" label="Para" error={fieldErrors.to}>
                                        <Input
                                            id="inv-send-to"
                                            type="email"
                                            maxLength={255}
                                            value={to}
                                            onChange={(e) => {
                                                setTo(e.target.value);
                                                clearFieldError('to');
                                            }}
                                            required
                                            aria-invalid={!!fieldErrors.to}
                                            className="bg-card"
                                        />
                                    </FormField>
                                    <FormField
                                        id="inv-send-cc"
                                        label="CC"
                                        error={fieldErrors.cc}
                                        description="Siempre se incluye hola@bocode.es. Añade más separados por coma."
                                    >
                                        <Input
                                            id="inv-send-cc"
                                            type="text"
                                            maxLength={255}
                                            placeholder="hola@bocode.es, otro@bocode.es"
                                            value={cc}
                                            onChange={(e) => {
                                                setCc(e.target.value);
                                                clearFieldError('cc');
                                            }}
                                            aria-invalid={!!fieldErrors.cc}
                                            className="bg-card"
                                        />
                                    </FormField>

                                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            className="mt-1 size-4 accent-primary"
                                            checked={confirmed}
                                            onChange={(e) => setConfirmed(e.target.checked)}
                                            disabled={sending}
                                        />
                                        <span>
                                            <Label className="cursor-pointer font-normal">
                                                Confirmo enviar la factura a {to.trim() || '…'}
                                            </Label>
                                        </span>
                                    </label>
                                </div>

                                <SheetFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="cursor-pointer"
                                        disabled={sending}
                                        onClick={() => handleOpenChange(false)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="cursor-pointer"
                                        disabled={!confirmed || sending || !to.trim()}
                                    >
                                        {sending ? 'Enviando…' : 'Enviar factura'}
                                    </Button>
                                </SheetFooter>
                            </form>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
