import { request, apiErrorMessage } from './api'
import type { ProjectStatus } from './projects'

export type HomeStatusSliceRaw = {
  status: ProjectStatus
  value: number
}

export type HomeDeadline = {
  id: number
  name: string
  status: ProjectStatus
  endDate: string
  client: { id: number; name: string } | null
}

export type HomeTopProject = {
  projectId: number
  name: string
  seconds: number
}

export type HomeDashboardResponse = {
  clientsCount: number
  projectsCount: number
  projectsInProgress: number
  hoursThisMonthSeconds: number
  topProjects: HomeTopProject[]
  statusSlices: HomeStatusSliceRaw[]
  deadlinesCount: number
  deadlines: HomeDeadline[]
  from: string
  to: string
}

export function getHomeDashboard(signal?: AbortSignal) {
  return request<HomeDashboardResponse>('/api/dashboard/home', {
    auth: true,
    signal,
  })
}

export const dashboardErrorMessage = apiErrorMessage
