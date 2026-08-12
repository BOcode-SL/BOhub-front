import { formatMoney } from '@/lib/billing';
import { cn } from '@/lib/utils';

type Props = {
    base: number;
    iva: number;
    irpf: number;
    total: number;
    className?: string;
};

/** Read-only money breakdown for payment/expense sheets. */
export function BillingTotalsCard({ base, iva, irpf, total, className }: Props) {
    const rows: { label: string; value: number; strong?: boolean }[] = [
        { label: 'Base', value: base },
        { label: 'IVA', value: iva },
        { label: 'IRPF', value: irpf },
        { label: 'Total', value: total, strong: true },
    ];

    return (
        <div className={cn('rounded-lg border border-border bg-muted/20 p-3', className)}>
            <dl className="grid gap-2 text-sm">
                {rows.map((row) => (
                    <div
                        key={row.label}
                        className={cn(
                            'flex items-baseline justify-between gap-4',
                            row.strong && 'border-t border-border pt-2',
                        )}
                    >
                        <dt className={cn('text-muted-foreground', row.strong && 'font-medium text-foreground')}>
                            {row.label}
                        </dt>
                        <dd
                            className={cn(
                                'tabular-nums text-foreground',
                                row.strong ? 'font-semibold' : 'font-medium',
                            )}
                        >
                            {formatMoney(row.value)}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
