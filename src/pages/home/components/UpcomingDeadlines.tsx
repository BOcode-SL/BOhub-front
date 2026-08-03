import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, Calendar, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Project } from '@/lib/projects'

type Props = {
  projects: Project[]
  isLoading?: boolean
}

export function UpcomingDeadlines({ projects, isLoading }: Props) {
  const navigate = useNavigate()
  const upcoming = projects.slice(0, 3)

  if (isLoading) {
    return (
      <Card className="w-full min-w-0 max-w-full">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Próximos Vencimientos
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Próximos 3 vencimientos de proyectos activos
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-[240px] flex-col">
          <div className="flex flex-1 flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex flex-1 items-center gap-3">
                  <Skeleton className="size-8 rounded-md" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
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
    <Card className="w-full min-w-0 max-w-full">
      <CardHeader>
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base sm:text-lg">
              Próximos Vencimientos
            </CardTitle>
            <CardDescription className="truncate text-xs sm:text-sm">
              Próximos 3 vencimientos de proyectos activos
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 cursor-pointer text-xs sm:text-sm"
            onClick={() => navigate('/app/projects')}
          >
            Ver todos
            <ArrowRight className="size-3 sm:size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-[240px] flex-col">
        {upcoming.length > 0 ? (
          <div className="flex flex-1 flex-col gap-2 sm:gap-3">
            {upcoming.map((project) => {
              const endDate = new Date(project.endDate! + 'T00:00:00')
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const days = Math.ceil(
                (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
              )
              const isOverdue = days < 0
              const isSoon = days >= 0 && days <= 7

              return (
                <button
                  key={project.id}
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-border p-2 text-left transition-colors duration-200 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none sm:p-3"
                  onClick={() => navigate(`/app/projects/${project.id}`)}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-primary sm:size-8">
                      <Folder className="size-3 sm:size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground sm:text-base">
                        {project.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground sm:text-sm">
                        {project.client?.name
                          ? `${project.client.name} · `
                          : ''}
                        {endDate.toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {isOverdue ? (
                      <div className="flex items-center gap-1 text-xs whitespace-nowrap text-destructive sm:text-sm">
                        <AlertCircle className="size-3 shrink-0 sm:size-4" />
                        <span>Vencido</span>
                      </div>
                    ) : isSoon ? (
                      <div className="flex items-center gap-1 text-xs whitespace-nowrap text-amber-200 sm:text-sm">
                        <AlertCircle className="size-3 shrink-0 sm:size-4" />
                        <span>{days === 0 ? 'Hoy' : `${days}d`}</span>
                      </div>
                    ) : (
                      <div className="text-xs whitespace-nowrap text-muted-foreground sm:text-sm">
                        {days} días
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center py-8 text-muted-foreground">
            <div className="text-center">
              <Calendar className="mx-auto mb-2 size-10 opacity-50" />
              <p className="text-sm">No hay proyectos con fecha límite</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
