import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';
import { ListPageShell } from '@/components/list-page-shell';
import { EntitySelect } from '@/components/entity-select';
import { Skeleton } from '@/components/ui/skeleton';
import { listProjects, type Project } from '@/lib/projects';
import { toastError } from '@/lib/toast';
import {
    formatDuration,
    getHoursAnalytics,
    type HoursAnalyticsBucket,
    type HoursAnalyticsProject,
} from '@/lib/timer';
import { CHART_FALLBACK_COLORS, daysInMonth, formatHoursFromSeconds, monthLabelEs, normalizeHexColor } from '@/lib/time';

type SeriesMeta = {
    key: string;
    projectId: number;
    name: string;
    color: string;
};

type Props = {
    above?: ReactNode;
};

export function TimerAnalytics({ above }: Props) {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [monthIndex, setMonthIndex] = useState(now.getMonth());
    const [projectFilter, setProjectFilter] = useState<number | ''>('');
    const [projectOptions, setProjectOptions] = useState<Project[]>([]);
    const [projects, setProjects] = useState<HoursAnalyticsProject[]>([]);
    const [buckets, setBuckets] = useState<HoursAnalyticsBucket[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ac = new AbortController();
        void listProjects({ perPage: 50, sort: 'name' }, ac.signal)
            .then((res) => setProjectOptions(res.data))
            .catch(() => {});
        return () => ac.abort();
    }, []);

    useEffect(() => {
        const ac = new AbortController();
        let cancelled = false;
        async function run() {
            setLoading(true);
            try {
                const res = await getHoursAnalytics(
                    {
                        year,
                        month: monthIndex + 1,
                        projectId: projectFilter || undefined,
                    },
                    ac.signal,
                );
                if (!cancelled) {
                    setProjects(res.projects);
                    setBuckets(res.buckets);
                }
            } catch (err) {
                if (cancelled) return;
                toastError(err);
                setProjects([]);
                setBuckets([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void run();
        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [year, monthIndex, projectFilter]);

    function shiftMonth(delta: number) {
        const d = new Date(Date.UTC(year, monthIndex + delta, 1));
        setYear(d.getUTCFullYear());
        setMonthIndex(d.getUTCMonth());
    }

    const { series, chartData, totalSeconds, activeDays, chartConfig } = useMemo(() => {
        const projectMap = new Map(projects.map((p) => [p.id, p]));
        const bucketMap = new Map<string, number>();
        const projectIds = new Set<number>();

        for (const b of buckets) {
            projectIds.add(b.projectId);
            bucketMap.set(`${b.workedOn}|${b.projectId}`, b.seconds);
        }

        const seriesList: SeriesMeta[] = [...projectIds]
            .map((id) => {
                const name = projectMap.get(id)?.name ?? `#${id}`;
                return { id, name };
            })
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(({ id, name }, i) => {
                const color =
                    normalizeHexColor(projectMap.get(id)?.color ?? null) ??
                    CHART_FALLBACK_COLORS[i % CHART_FALLBACK_COLORS.length];
                return { key: `p${id}`, projectId: id, name, color };
            });

        const nDays = daysInMonth(year, monthIndex);
        const rows: Record<string, string | number>[] = [];
        const daysWithHours = new Set<string>();
        let total = 0;

        for (let day = 1; day <= nDays; day++) {
            const dayKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const row: Record<string, string | number> = {
                day: String(day).padStart(2, '0'),
                dayKey,
            };
            let dayTotal = 0;
            for (const s of seriesList) {
                const sec = bucketMap.get(`${dayKey}|${s.projectId}`) ?? 0;
                row[s.key] = Number((sec / 3600).toFixed(2));
                dayTotal += sec;
                total += sec;
            }
            if (dayTotal > 0) daysWithHours.add(dayKey);
            rows.push(row);
        }

        const config: ChartConfig = {};
        for (const s of seriesList) {
            config[s.key] = { label: s.name, color: s.color };
        }

        return {
            series: seriesList,
            chartData: rows,
            totalSeconds: total,
            activeDays: daysWithHours.size,
            chartConfig: config,
        };
    }, [buckets, projects, year, monthIndex]);

    const dailyAvg = activeDays > 0 ? Math.round(totalSeconds / activeDays) : 0;
    const hasBars = series.length > 0 && totalSeconds > 0;
    const monthKey = `${year}-${monthIndex}`;

    return (
        <ListPageShell
            title="Analytics"
            description={`Horas por día · ${monthLabelEs(year, monthIndex)}`}
            icon={BarChart3}
            above={above}
            toolbar={
                <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => shiftMonth(-1)}
                            aria-label="Mes anterior"
                        >
                            <ChevronLeft />
                        </Button>
                        <p className="min-w-40 text-center text-sm font-medium capitalize text-foreground">
                            {monthLabelEs(year, monthIndex)}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => shiftMonth(1)}
                            aria-label="Mes siguiente"
                        >
                            <ChevronRight />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <label htmlFor="analytics-project" className="shrink-0">
                            Proyecto
                        </label>
                        <EntitySelect
                            id="analytics-project"
                            items={projectOptions}
                            value={projectFilter || null}
                            onValueChange={(value) => setProjectFilter(value ?? '')}
                            allowClear
                            placeholder="Todos"
                            className="min-w-48"
                        />
                    </div>
                </div>
            }
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                    {
                        title: 'Total del mes',
                        value: formatDuration(totalSeconds),
                    },
                    {
                        title: 'Media diaria',
                        value: formatHoursFromSeconds(dailyAvg),
                    },
                    {
                        title: 'Días activos',
                        value: String(activeDays),
                    },
                ].map((tile) => (
                    <div key={tile.title} className="rounded-xl border border-border bg-card/50 p-4">
                        <p className="text-sm text-muted-foreground">{tile.title}</p>
                        <p className="mt-2 font-mono text-xl font-semibold text-primary tabular-nums sm:text-2xl">
                            {loading ? <Skeleton className="h-7 w-24" /> : tile.value}
                        </p>
                    </div>
                ))}
            </div>

            <div className="rounded-md border">
                <div className="border-b border-border px-4 py-3">
                    <p className="text-base font-medium text-foreground sm:text-lg">Horas por día</p>
                    <p className="text-xs text-muted-foreground sm:text-sm">
                        Apilado por proyecto · {monthLabelEs(year, monthIndex)}
                    </p>
                </div>
                <div className="p-4">
                    {loading ? (
                        <Skeleton className="h-[280px] w-full rounded-lg" />
                    ) : hasBars ? (
                        <ChartContainer key={monthKey} config={chartConfig} className="aspect-auto h-[320px] w-full">
                            <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    width={36}
                                    tickFormatter={(v) => `${v}h`}
                                />
                                <ChartTooltip
                                    content={
                                        <ChartTooltipContent
                                            labelFormatter={(_, payload) => {
                                                const row = payload?.[0]?.payload as { dayKey?: string } | undefined;
                                                return row?.dayKey ?? '';
                                            }}
                                        />
                                    }
                                />
                                <ChartLegend content={<ChartLegendContent />} />
                                {series.map((s) => (
                                    <Bar
                                        key={s.key}
                                        dataKey={s.key}
                                        name={s.name}
                                        stackId="hours"
                                        fill={`var(--color-${s.key})`}
                                        radius={2}
                                    />
                                ))}
                            </BarChart>
                        </ChartContainer>
                    ) : (
                        <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                            No hay horas este mes
                        </div>
                    )}
                </div>
            </div>
        </ListPageShell>
    );
}
