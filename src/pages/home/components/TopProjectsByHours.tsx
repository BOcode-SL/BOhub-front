import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { TopProjectHours } from '@/hooks/useHomeDashboard'

type Props = {
  projects: TopProjectHours[]
  formatHours: (seconds: number) => string
  isLoading?: boolean
}

export function TopProjectsByHours({
  projects,
  formatHours,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Top Proyectos por Horas
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Proyectos con más horas registradas este mes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <Skeleton className="size-7 rounded-md sm:size-8" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">
          Top Proyectos por Horas
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Proyectos con más horas registradas este mes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {projects.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {projects.map((project, index) => (
              <div
                key={project.projectId}
                className="flex items-center justify-between gap-2 sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground sm:size-8 sm:text-sm">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1 truncate text-sm font-medium text-foreground sm:text-base">
                    {project.name}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-bold text-primary sm:text-base">
                  {formatHours(project.seconds)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No hay horas registradas este mes
          </div>
        )}
      </CardContent>
    </Card>
  )
}
