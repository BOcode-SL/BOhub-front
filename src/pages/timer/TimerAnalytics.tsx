import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { listProjects, type Project } from '@/lib/projects'
import {
  formatDuration,
  listHours,
  listTeamHours,
  timerErrorMessage,
  type Hour,
} from '@/lib/timer'
import { formatHoursFromSeconds } from '@/hooks/useHomeDashboard'

const selectClass =
  'h-9 cursor-pointer rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40'

const FALLBACK_COLORS = [
  '#ccff00',
  '#60a5fa',
  '#fbbf24',
  '#a78bfa',
  '#34d399',
  '#f472b6',
  '#38bdf8',
  '#fb923c',
]

function monthBounds(year: number, monthIndex: number) {
  const from = new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(year, monthIndex + 1, 0))
    .toISOString()
    .slice(0, 10)
  return { from, to }
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function monthLabel(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

async function fetchAllHours(
  isAdmin: boolean,
  from: string,
  to: string,
  projectId: number | undefined,
  signal: AbortSignal,
): Promise<Hour[]> {
  const out: Hour[] = []
  let page = 1
  for (;;) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const res = isAdmin
      ? await listTeamHours(
          { page, perPage: 50, from, to, projectId },
          signal,
        )
      : await listHours({ page, perPage: 50, from, to, projectId }, signal)
    out.push(...res.data)
    if (page >= res.meta.last_page) break
    page += 1
  }
  return out
}

type SeriesMeta = {
  key: string
  projectId: number
  name: string
  color: string
}

export function TimerAnalytics() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [monthIndex, setMonthIndex] = useState(now.getMonth())
  const [projectFilter, setProjectFilter] = useState<number | ''>('')
  const [projects, setProjects] = useState<Project[]>([])
  const [hours, setHours] = useState<Hour[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    void listProjects({ perPage: 50, sort: 'name' }, ac.signal)
      .then((res) => setProjects(res.data))
      .catch(() => {})
    return () => ac.abort()
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const { from, to } = monthBounds(year, monthIndex)
        const rows = await fetchAllHours(
          isAdmin,
          from,
          to,
          projectFilter || undefined,
          ac.signal,
        )
        if (!cancelled) setHours(rows)
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(timerErrorMessage(err))
        setHours([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [year, monthIndex, projectFilter, isAdmin])

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, monthIndex + delta, 1))
    setYear(d.getUTCFullYear())
    setMonthIndex(d.getUTCMonth())
  }

  const { series, chartData, totalSeconds, activeDays, chartConfig } =
    useMemo(() => {
      const projectMap = new Map(projects.map((p) => [p.id, p]))
      const buckets = new Map<string, number>() // `${day}|${projectId}` → seconds
      const projectIds = new Set<number>()

      for (const h of hours) {
        projectIds.add(h.projectId)
        const key = `${h.workedOn}|${h.projectId}`
        buckets.set(key, (buckets.get(key) ?? 0) + h.durationSeconds)
      }

      const seriesList: SeriesMeta[] = [...projectIds]
        .sort((a, b) => {
          const na = projectMap.get(a)?.name ?? hours.find((h) => h.projectId === a)?.project?.name ?? `#${a}`
          const nb = projectMap.get(b)?.name ?? hours.find((h) => h.projectId === b)?.project?.name ?? `#${b}`
          return na.localeCompare(nb)
        })
        .map((id, i) => {
          const p = projectMap.get(id)
          const name =
            p?.name ??
            hours.find((h) => h.projectId === id)?.project?.name ??
            `#${id}`
          const color =
            p?.color && /^#?[0-9a-fA-F]{3,8}$/.test(p.color)
              ? p.color.startsWith('#')
                ? p.color
                : `#${p.color}`
              : FALLBACK_COLORS[i % FALLBACK_COLORS.length]
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
          const hoursVal = Number((sec / 3600).toFixed(2))
          row[s.key] = hoursVal
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

  const dailyAvg =
    activeDays > 0 ? Math.round(totalSeconds / activeDays) : 0

  const hasBars = series.length > 0 && totalSeconds > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="cursor-pointer"
            onClick={() => shiftMonth(-1)}
            aria-label="Mes anterior"
          >
            <ChevronLeft />
          </Button>
          <p className="min-w-40 text-center text-sm font-medium capitalize text-foreground">
            {monthLabel(year, monthIndex)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="cursor-pointer"
            onClick={() => shiftMonth(1)}
            aria-label="Mes siguiente"
          >
            <ChevronRight />
          </Button>
        </div>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Proyecto
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
          <Card key={tile.title}>
            <CardHeader className="pb-2">
              <CardDescription>{tile.title}</CardDescription>
              <CardTitle className="font-mono text-xl text-primary tabular-nums sm:text-2xl">
                {loading ? <Skeleton className="h-7 w-24" /> : tile.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Horas por día</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Apilado por proyecto · {monthLabel(year, monthIndex)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[280px] w-full rounded-lg" />
          ) : hasBars ? (
            <ChartContainer
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
        </CardContent>
      </Card>
    </div>
  )
}
