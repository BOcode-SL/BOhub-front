import { ReceiptEuro } from 'lucide-react';
import { cn } from '@/lib/utils';

type ClientPendingMarkProps = {
    hasPendingInvoices?: boolean | null;
    className?: string;
    /** Shorter label for tight table cells. */
    compact?: boolean;
};

/** Amber mark when the client has pending / partially_paid payments. */
export function ClientPendingMark({ hasPendingInvoices, className }: ClientPendingMarkProps) {
    if (!hasPendingInvoices) return null;

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-0.5 rounded-md border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400',
                className,
            )}
            title="Tiene facturas o cobros pendientes"
        >
            <ReceiptEuro className="size-3" aria-hidden />
        </span>
    );
}
