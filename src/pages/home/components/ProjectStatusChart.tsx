import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { StatusSlice } from '@/hooks/useHomeDashboard'

type Props = {
  data: StatusSlice[]
  isMobile: boolean
  isLoading?: boolean
}

/** ponytail: SVG donut — no recharts dep; upgrade = ChartContainer if needed */
function Donut({ data, size }: { data: StatusSlice[]; size: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total <= 0) return null

  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto"
      aria-hidden
    >
      {data.map((slice) => {
        const len = (slice.value / total) * c
        const el = (
          <circle
            key={slice.status}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={slice.color}
            strokeWidth={14}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )
        offset += len
        return el
      })}
    </svg>
  )
}

export function ProjectStatusChart({ data, isMobile, isLoading }: Props) {
  const size = isMobile ? 160 : 200

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
        ) : data.length > 0 ? (
          <div className="flex flex-col items-center gap-4">
            <Donut data={data} size={size} />
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
