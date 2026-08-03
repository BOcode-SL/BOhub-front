import { useEffect, useState } from 'react'
import {
  formatHoursFromSeconds,
  useHomeDashboard,
} from '@/hooks/useHomeDashboard'
import {
  ProjectStatusChart,
  StatsCards,
  TopProjectsByHours,
  UpcomingDeadlines,
} from './components'

function useIsMobile(breakpoint = 640) {
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [breakpoint])
  return mobile
}

export function HomePage() {
  const isMobile = useIsMobile()
  const {
    clientsCount,
    projects,
    projectsInProgress,
    hoursThisMonthSeconds,
    topProjects,
    statusSlices,
    deadlines,
    loading,
    error,
  } = useHomeDashboard()

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground"
        >
          {error}
        </p>
      )}

      <StatsCards
        clientsCount={clientsCount}
        projectsCount={projects.length}
        projectsInProgress={projectsInProgress}
        hoursThisMonth={formatHoursFromSeconds(hoursThisMonthSeconds)}
        upcomingDeadlinesCount={deadlines.length}
        isLoading={loading}
      />

      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ProjectStatusChart
            data={statusSlices}
            isMobile={isMobile}
            isLoading={loading}
          />
        </div>
        <div className="lg:col-span-2">
          <UpcomingDeadlines projects={deadlines} isLoading={loading} />
        </div>
      </div>

      <TopProjectsByHours
        projects={topProjects}
        formatHours={formatHoursFromSeconds}
        isLoading={loading}
      />
    </div>
  )
}
