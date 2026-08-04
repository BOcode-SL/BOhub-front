import { ReceiptEuro } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListPageShell } from '@/components/list-page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { currentQuarter, formatMoney, getBillingSummary, type BillingSummary } from '@/lib/billing';
import { toastError } from '@/lib/toast';
import { ToolbarSelect } from '@/components/toolbar-field';
import { BillingTabs } from '@/pages/billing/BillingTabs';

function parseYear(v: string | null): number {
    const n = Number(v);
    const y = new Date().getFullYear();
    return Number.isFinite(n) && n >= 2000 && n <= 2100 ? Math.floor(n) : y;
}

function parseQuarter(v: string | null): 1 | 2 | 3 | 4 | 'all' {
    if (v === 'all') return 'all';
    const n = Number(v);
    if (n === 1 || n === 2 || n === 3 || n === 4) return n;
    return currentQuarter();
}

export function BillingSummaryPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlHasPeriod = searchParams.has('year') && searchParams.has('quarter');
    const year = parseYear(searchParams.get('year'));
    const quarter = parseQuarter(searchParams.get('quarter'));

    const [summary, setSummary] = useState<BillingSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!urlHasPeriod) {
            setSearchParams({ year: String(year), quarter: String(quarter) }, { replace: true });
            return;
        }

        const ac = new AbortController();
        let cancelled = false;
        setLoading(true);
        void getBillingSummary({ year, quarter }, ac.signal)
            .then((s) => {
                if (!cancelled) setSummary(s);
            })
            .catch((err) => {
                if (cancelled) return;
                toastError(err);
                setSummary(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [urlHasPeriod, year, quarter, setSearchParams]);

    const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

    function setPeriod(nextYear: number, nextQuarter: 1 | 2 | 3 | 4 | 'all') {
        setSearchParams({ year: String(nextYear), quarter: String(nextQuarter) });
    }

    return (
        <ListPageShell
            title="Resumen"
            description="Ingresos y gastos del periodo."
            icon={ReceiptEuro}
            above={<BillingTabs />}
            toolbar={
                <div className="flex flex-wrap items-end gap-2 py-1">
                    <ToolbarSelect
                        id="billing-year"
                        label="Año"
                        items={years.map((y) => ({ label: String(y), value: String(y) }))}
                        value={String(year)}
                        onValueChange={(value) => {
                            if (value) setPeriod(Number(value), quarter);
                        }}
                    />
                    <ToolbarSelect
                        id="billing-quarter"
                        label="Trimestre"
                        items={[
                            { label: 'T1', value: '1' },
                            { label: 'T2', value: '2' },
                            { label: 'T3', value: '3' },
                            { label: 'T4', value: '4' },
                            { label: 'Todo el año', value: 'all' },
                        ]}
                        value={quarter === 'all' ? 'all' : String(quarter)}
                        onValueChange={(value) => {
                            if (value) setPeriod(year, value === 'all' ? 'all' : (Number(value) as 1 | 2 | 3 | 4));
                        }}
                    />
                </div>
            }
        >
            {loading && !summary && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-28 w-full rounded-xl" />
                    ))}
                </div>
            )}

            {summary && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryCard
                        title="Ingresos"
                        value={formatMoney(summary.income.total)}
                        hint={`${summary.income.count} facturas · base ${formatMoney(summary.income.base)}`}
                    />
                    <SummaryCard
                        title="Gastos"
                        value={formatMoney(summary.expense.total)}
                        hint={`${summary.expense.count} gastos · base ${formatMoney(summary.expense.base)}`}
                    />
                    <SummaryCard
                        title="Pendiente cobro"
                        value={formatMoney(summary.income.pendingTotal)}
                        hint={`${summary.income.pendingCount} ingresos`}
                    />
                    <SummaryCard
                        title="Neto periodo"
                        value={formatMoney(summary.net)}
                        hint={`${summary.from} → ${summary.to}`}
                        emphasize
                    />
                </div>
            )}
        </ListPageShell>
    );
}

function SummaryCard({ title, value, hint, emphasize }: { title: string; value: string; hint: string; emphasize?: boolean }) {
    return (
        <div className="rounded-xl border border-border bg-card/50 p-4">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p
                className={
                    emphasize
                        ? 'mt-2 text-2xl font-semibold tracking-tight text-primary'
                        : 'mt-2 text-2xl font-semibold tracking-tight text-foreground'
                }
            >
                {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
    );
}
