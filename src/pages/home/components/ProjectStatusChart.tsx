import { useMemo } from 'react'
import { Pie, PieChart, Cell } from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import type { StatusSlice } from '@/hooks/useHomeDashboard'

type Props = {
  data: StatusSlice[]
  isMobile: boolean
  isLoading?: boolean
}

export function ProjectStatusChart({ data, isMobile, isLoading }: Props) {
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      value: { label: 'Proyectos' },
    }
    for (const s of data) {
      config[s.status] = { label: s.name, color: s.color }
    }
    return config
  }, [data])

  const chartData = data.map((s) => ({
    status: s.status,
    name: s.name,
    value: s.value,
    fill: `var(--color-${s.status})`,
  }))

  return (
    <Card className="w-full min-w-0 max-w-full">
      <CardHeader className="min-w-0">
        <CardTitle className="truncate text-base sm:text-lg">
          Estado de Proyectos
        </CardTitle>
        <CardDescription className="truncate text-xs sm:text-sm">
          Distribución por estado
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        {isLoading ? (
          <div className="flex h-[200px] items-center justify-center sm:h-[240px]">
            <Skeleton className="size-[160px] rounded-full sm:size-[200px]" />
          </div>
        ) : chartData.length > 0 ? (
          <div className="flex flex-col items-center gap-3">
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square h-[200px] w-full max-w-[240px] sm:h-[240px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel nameKey="name" />}
                />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={isMobile ? 40 : 50}
                  outerRadius={isMobile ? 70 : 85}
                  strokeWidth={2}
                >
                  {chartData.map((item) => (
                    <Cell key={item.status} fill={item.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="flex w-full flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {data.map((s) => (
                <li key={s.status} className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-foreground">
                    {s.name} ({s.value})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex h-[200px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
            No hay proyectos activos para mostrar
          </div>
        )}
      </CardContent>
    </Card>
  )
}
