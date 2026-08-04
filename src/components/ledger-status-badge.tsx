import { Badge } from '@/components/ui/badge';
import { LEDGER_STATUS_BADGE_CLASS, LEDGER_STATUS_LABELS, type LedgerStatus } from '@/lib/billing';
import { cn } from '@/lib/utils';

export function LedgerStatusBadge({ status }: { status: LedgerStatus }) {
    return (
        <Badge variant="outline" className={cn('w-fit font-normal', LEDGER_STATUS_BADGE_CLASS[status])}>
            {LEDGER_STATUS_LABELS[status]}
        </Badge>
    );
}
