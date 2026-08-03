import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { listClients } from '@/lib/clients'
import {
  listProjects,
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectStatus,
} from '@/lib/projects'
import { listHours, listTeamHours, type Hour } from '@/lib/timer'
import {
  currentMonthBounds,
  fetchAllPages,
} from '@/lib/time'

export type StatusSlice = {
  status: ProjectStatus
  name: string
  value: number
  color: string
}

export type TopProjectHours = {
  projectId: number
  name: string
  seconds: number
}

export type HomeDashboard = {
  clientsCount: number
  projects: Project[]
  projectsInProgress: number
  hoursThisMonthSeconds: number
  topProjects: TopProjectHours[]
  statusSlices: StatusSlice[]
  deadlines: Project[]
  loading: boolean
  error: string | null
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  todo: '#8b9294',
  in_progress: '#ccff00',
  in_review: '#60a5fa',
  blocked: '#f87171',
  done: '#64748b',
  maintenance: '#fbbf24',
}

export function useHomeDashboard(): HomeDashboard {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [clientsCount, setClientsCount] = useState(0)
  const [projects, setProjects] = useState<Project[]>([])
  const [hoursThisMonthSeconds, setHoursThisMonthSeconds] = useState(0)
  const [topProjects, setTopProjects] = useState<TopProjectHours[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      try {
        const { from, to } = currentMonthBounds()
        // one Promise.all; AbortSignal on unmount — no shell re-fetch
        const [clientsRes, projectsList, hoursList] = await Promise.all([
          listClients({ perPage: 5, page: 1 }, ac.signal),
          fetchAllPages<Project>(
            (page) =>
              listProjects({ page, perPage: 50, sort: 'name' }, ac.signal),
            ac.signal,
          ),
          fetchAllPages<Hour>(
            (page) =>
              isAdmin
                ? listTeamHours({ page, perPage: 50, from, to }, ac.signal)
                : listHours({ page, perPage: 50, from, to }, ac.signal),
            ac.signal,
          ),
        ])

        if (cancelled) return

        const byProject = new Map<number, TopProjectHours>()
        let monthSec = 0
        for (const h of hoursList) {
          monthSec += h.durationSeconds
          const cur = byProject.get(h.projectId)
          const name = h.project?.name ?? `#${h.projectId}`
          if (cur) {
            cur.seconds += h.durationSeconds
          } else {
            byProject.set(h.projectId, {
              projectId: h.projectId,
              name,
              seconds: h.durationSeconds,
            })
          }
        }
        const top = [...byProject.values()]
          .sort((a, b) => b.seconds - a.seconds)
          .slice(0, 5)

        setClientsCount(clientsRes.meta.total)
        setProjects(projectsList)
        setHoursThisMonthSeconds(monthSec)
        setTopProjects(top)
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Error al cargar inicio')
        setProjects([])
        setTopProjects([])
        setHoursThisMonthSeconds(0)
        setClientsCount(0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [isAdmin])

  const projectsInProgress = useMemo(
    () => projects.filter((p) => p.status !== 'done').length,
    [projects],
  )

  const statusSlices = useMemo((): StatusSlice[] => {
    const counts = {} as Record<ProjectStatus, number>
    for (const p of projects) {
      counts[p.status] = (counts[p.status] ?? 0) + 1
    }
    return (Object.keys(counts) as ProjectStatus[])
      .filter((s) => s !== 'done' && s !== 'blocked')
      .map((status) => ({
        status,
        name: PROJECT_STATUS_LABELS[status],
        value: counts[status],
        color: STATUS_COLORS[status],
      }))
      .filter((s) => s.value > 0)
  }, [projects])

  const deadlines = useMemo(
    () =>
      projects
        .filter((p) => p.status !== 'done' && p.endDate)
        .sort((a, b) => (a.endDate ?? '').localeCompare(b.endDate ?? '')),
    [projects],
  )

  return {
    clientsCount,
    projects,
    projectsInProgress,
    hoursThisMonthSeconds,
    topProjects,
    statusSlices,
    deadlines,
    loading,
    error,
  }
}
