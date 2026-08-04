import { ReceiptEuro } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ListPageShell } from '@/components/list-page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';
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
                    {Array.from({ length: 11 }).map((_, i) => (
                        <Skeleton key={i} className="h-28 w-full rounded-xl" />
                    ))}
                </div>
            )}

            {summary && (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <SummaryCard
                            title="Resultado / Beneficio neto"
                            value={formatMoney(summary.result ?? summary.net)}
                            emphasize
                        />
                        <SummaryCard title="Total Bruto" value={formatMoney(summary.grossIncome ?? summary.income.total)} />
                        <SummaryCard title="Total Neto" value={formatMoney(summary.netIncome ?? summary.income.total)} />
                        <SummaryCard
                            title="Pendiente"
                            value={formatMoney(summary.pending ?? summary.income.pendingTotal)}
                        />
                        <SummaryCard
                            title="Bruto Gastos"
                            value={formatMoney(summary.grossExpenses ?? summary.expense.total)}
                        />
                        <SummaryCard title="Neto Gastos" value={formatMoney(summary.netExpenses ?? summary.expense.total)} />
                        <SummaryCard title="Gastos Nóminas" value={formatMoney(summary.payrollExpenses ?? '0')} />
                        <SummaryCard title="IVA Repercutido" value={formatMoney(summary.ivaCollected ?? '0')} />
                        <SummaryCard title="IVA Soportado" value={formatMoney(summary.ivaPaid ?? '0')} />
                        <SummaryCard title="Balance IVA" value={formatMoney(summary.ivaBalance ?? '0')} />
                        <SummaryCard title="IRPF a Pagar" value={formatMoney(summary.irpfPayable ?? '0')} />
                    </div>

                    {summary.months && summary.months.length > 0 && (
                        <MonthChart year={summary.year} quarter={summary.quarter} months={summary.months} />
                    )}
                </>
            )}
        </ListPageShell>
    );
}

function SummaryCard({ title, value, emphasize }: { title: string; value: string; emphasize?: boolean }) {
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
        </div>
    );
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function MonthChart({
    year,
    quarter,
    months,
}: {
    year: number;
    quarter: number | 'all';
    months: Array<{ month: number; gross: string; pending: string; payroll: string; expenses: string }>;
}) {
    const chartData = useMemo(() => {
        return months.map((m) => ({
            month: MONTH_LABELS[m.month - 1] || String(m.month),
            bruto: Number(m.gross),
            pendiente: Number(m.pending),
            nominas: Number(m.payroll),
            gastos: Number(m.expenses),
        }));
    }, [months]);

    const chartConfig: ChartConfig = {
        bruto: { label: 'Bruto', color: '#ccff00' },
        pendiente: { label: 'Pendiente', color: '#fbbf24' },
        nominas: { label: 'Nóminas', color: '#60a5fa' },
        gastos: { label: 'Gastos', color: '#f472b6' },
    };

    const periodLabel = quarter === 'all' ? `Año ${year}` : `T${quarter} ${year}`;

    return (
        <div className="rounded-md border">
            <div className="border-b border-border px-4 py-3">
                <p className="text-base font-medium text-foreground sm:text-lg">Resumen mensual</p>
                <p className="text-xs text-muted-foreground sm:text-sm">{periodLabel}</p>
            </div>
            <div className="p-4">
                <ChartContainer config={chartConfig} className="aspect-auto h-[320px] w-full">
                    <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            width={60}
                            tickFormatter={(v) => `${v.toLocaleString('es-ES')}€`}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="bruto" fill="var(--color-bruto)" radius={4} />
                        <Bar dataKey="pendiente" fill="var(--color-pendiente)" radius={4} />
                        <Bar dataKey="nominas" fill="var(--color-nominas)" radius={4} />
                        <Bar dataKey="gastos" fill="var(--color-gastos)" radius={4} />
                    </BarChart>
                </ChartContainer>
            </div>
        </div>
    );
}
