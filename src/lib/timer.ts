import { request, apiErrorMessage } from './api'

export type TimerState = 'running' | 'paused'

export type ActiveTimer = {
  id: number
  state: TimerState
  elapsedSeconds: number
  startedAt: string | null
  accumulatedSeconds: number
  projectId: number | null
  description: string | null
  project?: { id: number; name: string } | null
}

export type Hour = {
  id: number
  userId: number
  projectId: number
  durationSeconds: number
  description: string | null
  workedOn: string
  project?: { id: number; name: string } | null
  user?: { id: number; name: string } | null
}

export type HourInput = {
  projectId: number
  hours?: number
  minutes?: number
  seconds?: number
  durationSeconds?: number
  description?: string | null
  workedOn: string
}

export type HoursMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':')
}

export async function getActiveTimer(
  signal?: AbortSignal,
): Promise<ActiveTimer | null> {
  const res = await request<{ timer: ActiveTimer | null }>(
    '/api/timers/active',
    { signal },
  )
  return res.timer
}

export async function startTimer(body: {
  projectId?: number | null
  description?: string | null
}): Promise<ActiveTimer> {
  const res = await request<{ timer: ActiveTimer }>('/api/timers/start', {
    method: 'POST',
    body,
  })
  return res.timer
}

export async function patchTimer(
  id: number,
  body: {
    action?: 'pause' | 'resume'
    projectId?: number | null
    description?: string | null
  },
): Promise<ActiveTimer> {
  const res = await request<{ timer: ActiveTimer }>(`/api/timers/${id}`, {
    method: 'PATCH',
    body,
  })
  return res.timer
}

export async function saveTimer(
  id: number,
  body: {
    projectId?: number | null
    description?: string | null
    workedOn?: string | null
  } = {},
): Promise<{ hour: Hour; timer: null }> {
  return request(`/api/timers/${id}/save`, {
    method: 'POST',
    body,
  })
}

export async function discardTimer(id: number): Promise<void> {
  await request(`/api/timers/${id}`, { method: 'DELETE' })
}

export async function listHours(
  params: {
    page?: number
    perPage?: number
    projectId?: number
    from?: string
    to?: string
  } = {},
  signal?: AbortSignal,
): Promise<{ data: Hour[]; meta: HoursMeta }> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.perPage) q.set('per_page', String(params.perPage))
  if (params.projectId) q.set('project_id', String(params.projectId))
  if (params.from) q.set('from', params.from)
  if (params.to) q.set('to', params.to)
  const qs = q.toString()
  return request(`/api/hours${qs ? `?${qs}` : ''}`, { signal })
}

export async function listTeamHours(
  params: {
    page?: number
    perPage?: number
    projectId?: number
    userId?: number
    from?: string
    to?: string
  } = {},
  signal?: AbortSignal,
): Promise<{
  data: Hour[]
  meta: HoursMeta
  users: { id: number; name: string }[]
}> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.perPage) q.set('per_page', String(params.perPage))
  if (params.projectId) q.set('project_id', String(params.projectId))
  if (params.userId) q.set('user_id', String(params.userId))
  if (params.from) q.set('from', params.from)
  if (params.to) q.set('to', params.to)
  const qs = q.toString()
  return request(`/api/hours/team${qs ? `?${qs}` : ''}`, { signal })
}

export async function createHour(body: HourInput): Promise<Hour> {
  return request('/api/hours', { method: 'POST', body })
}

export async function updateHour(
  id: number,
  body: Partial<HourInput>,
): Promise<Hour> {
  return request(`/api/hours/${id}`, { method: 'PUT', body })
}

export async function deleteHour(id: number): Promise<void> {
  await request(`/api/hours/${id}`, { method: 'DELETE' })
}

export type HoursAnalyticsProject = {
  id: number
  name: string
  color: string | null
}

export type HoursAnalyticsBucket = {
  workedOn: string
  projectId: number
  seconds: number
}

export type HoursAnalyticsResponse = {
  year: number
  month: number
  from: string
  to: string
  projects: HoursAnalyticsProject[]
  buckets: HoursAnalyticsBucket[]
}

export function getHoursAnalytics(
  params: { year: number; month: number; projectId?: number },
  signal?: AbortSignal,
): Promise<HoursAnalyticsResponse> {
  const q = new URLSearchParams()
  q.set('year', String(params.year))
  q.set('month', String(params.month))
  if (params.projectId) q.set('project_id', String(params.projectId))
  return request(`/api/hours/analytics?${q}`, { signal })
}

export function timerErrorMessage(err: unknown): string {
  return apiErrorMessage(err)
}
