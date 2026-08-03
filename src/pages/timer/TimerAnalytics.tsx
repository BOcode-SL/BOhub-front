import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ListPageShell } from '@/components/list-page-shell'
import { Skeleton } from '@/components/ui/skeleton'
import { listProjects, type Project } from '@/lib/projects'
import {
  formatDuration,
  listHours,
  listTeamHours,
  timerErrorMessage,
  type Hour,
} from '@/lib/timer'
import {
  CHART_FALLBACK_COLORS,
  daysInMonth,
  fetchAllPages,
  formatHoursFromSeconds,
  monthBounds,
  monthLabelEs,
  normalizeHexColor,
} from '@/lib/time'

const selectClass =
  'h-9 rounded-md border border-border bg-input/30 px-2 text-sm text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

type SeriesMeta = {
  key: string
  projectId: number
  name: string
  color: string
}

type Props = {
  above?: ReactNode
}

export function TimerAnalytics({ above }: Props) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [monthIndex, setMonthIndex] = useState(now.getMonth())
  const [projectFilter, setProjectFilter] = useState<number | ''>('')
  const [projects, setProjects] = useState<Project[]>([])
  const [monthHours, setMonthHours] = useState<Hour[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // projects once (names + color for stacks)
  useEffect(() => {
    const ac = new AbortController()
    void listProjects({ perPage: 50, sort: 'name' }, ac.signal)
      .then((res) => setProjects(res.data))
      .catch(() => {})
    return () => ac.abort()
  }, [])

  // ponytail: 1 fetch per month (not per project filter / not timer tick); filter client-side
  useEffect(() => {
    const ac = new AbortController()
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const { from, to } = monthBounds(year, monthIndex)
        const rows = await fetchAllPages<Hour>(
          (page) =>
            isAdmin
              ? listTeamHours({ page, perPage: 50, from, to }, ac.signal)
              : listHours({ page, perPage: 50, from, to }, ac.signal),
          ac.signal,
        )
        if (!cancelled) setMonthHours(rows)
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(timerErrorMessage(err))
        setMonthHours([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [year, monthIndex, isAdmin])

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, monthIndex + delta, 1))
    setYear(d.getUTCFullYear())
    setMonthIndex(d.getUTCMonth())
  }

  const hours = useMemo(() => {
    if (!projectFilter) return monthHours
    return monthHours.filter((h) => h.projectId === projectFilter)
  }, [monthHours, projectFilter])

  const { series, chartData, totalSeconds, activeDays, chartConfig } =
    useMemo(() => {
      const projectMap = new Map(projects.map((p) => [p.id, p]))
      const nameFromHours = new Map<number, string>()
      const buckets = new Map<string, number>()
      const projectIds = new Set<number>()

      // O(n) one pass
      for (const h of hours) {
        projectIds.add(h.projectId)
        if (h.project?.name) nameFromHours.set(h.projectId, h.project.name)
        const key = `${h.workedOn}|${h.projectId}`
        buckets.set(key, (buckets.get(key) ?? 0) + h.durationSeconds)
      }

      const seriesList: SeriesMeta[] = [...projectIds]
        .map((id) => {
          const name =
            projectMap.get(id)?.name ?? nameFromHours.get(id) ?? `#${id}`
          return { id, name }
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ id, name }, i) => {
          const color =
            normalizeHexColor(projectMap.get(id)?.color ?? null) ??
            CHART_FALLBACK_COLORS[i % CHART_FALLBACK_COLORS.length]
          return { key: `p${id}`, projectId: id, name, color }
        })

      const nDays = daysInMonth(year, monthIndex)
      const rows: Record<string, string | number>[] = []
      const daysWithHours = new Set<string>()
      let total = 0

      for (let day = 1; day <= nDays; day++) {
        const dayKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const row: Record<string, string | number> = {
          day: String(day).padStart(2, '0'),
          dayKey,
        }
        let dayTotal = 0
        for (const s of seriesList) {
          const sec = buckets.get(`${dayKey}|${s.projectId}`) ?? 0
          row[s.key] = Number((sec / 3600).toFixed(2))
          dayTotal += sec
          total += sec
        }
        if (dayTotal > 0) daysWithHours.add(dayKey)
        rows.push(row)
      }

      const config: ChartConfig = {}
      for (const s of seriesList) {
        config[s.key] = { label: s.name, color: s.color }
      }

      return {
        series: seriesList,
        chartData: rows,
        totalSeconds: total,
        activeDays: daysWithHours.size,
        chartConfig: config,
      }
    }, [hours, projects, year, monthIndex])

  const dailyAvg = activeDays > 0 ? Math.round(totalSeconds / activeDays) : 0
  const hasBars = series.length > 0 && totalSeconds > 0
  const monthKey = `${year}-${monthIndex}`

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
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="shrink-0">Proyecto</span>
            <select
              value={projectFilter}
              onChange={(e) =>
                setProjectFilter(e.target.value ? Number(e.target.value) : '')
              }
              className={selectClass + ' min-w-48'}
            >
              <option value="">Todos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
    >
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground"
        >
          {error}
        </p>
      )}

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
          <div
            key={tile.title}
            className="rounded-xl border border-border bg-card/50 p-4"
          >
            <p className="text-sm text-muted-foreground">{tile.title}</p>
            <p className="mt-2 font-mono text-xl font-semibold text-primary tabular-nums sm:text-2xl">
              {loading ? <Skeleton className="h-7 w-24" /> : tile.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-md border">
        <div className="border-b border-border px-4 py-3">
          <p className="text-base font-medium text-foreground sm:text-lg">
            Horas por día
          </p>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Apilado por proyecto · {monthLabelEs(year, monthIndex)}
          </p>
        </div>
        <div className="p-4">
          {loading ? (
            <Skeleton className="h-[280px] w-full rounded-lg" />
          ) : hasBars ? (
            <ChartContainer
              key={monthKey}
              config={chartConfig}
              className="aspect-auto h-[320px] w-full"
            >
              <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
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
                        const row = payload?.[0]?.payload as
                          | { dayKey?: string }
                          | undefined
                        return row?.dayKey ?? ''
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
  )
}
