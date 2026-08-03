import { request, apiErrorMessage } from './api'

export const MAINTENANCE_STATUSES = [
  'scheduled',
  'active',
  'ended',
  'cancelled',
] as const

export const MAINTENANCE_PERIODS = ['monthly', 'annual'] as const

export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number]
export type MaintenancePeriodKind = (typeof MAINTENANCE_PERIODS)[number]

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  scheduled: 'Programado',
  active: 'Activo',
  ended: 'Finalizado',
  cancelled: 'Cancelado',
}

export const MAINTENANCE_PERIOD_LABELS: Record<MaintenancePeriodKind, string> = {
  monthly: 'Mensual',
  annual: 'Anual',
}

export type MaintenanceClient = {
  id: number
  name: string
  email?: string | null
  phone?: string | null
}

export type MaintenancePeriod = {
  id: number
  projectId: number
  clientId: number
  period: MaintenancePeriodKind
  startsOn: string
  endsOn: string
  status: MaintenanceStatus
  notes?: string | null
  project?: { id: number; name: string } | null
  client?: MaintenanceClient | null
  createdBy?: number | null
}

export type MaintenanceInput = {
  projectId: number
  period: MaintenancePeriodKind
  startsOn: string
  endsOn: string
  notes?: string | null
  status?: MaintenanceStatus
}

export type MaintenanceMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

/** starts_on + 1 month|year − 1 day (inclusive). Keep in sync with back suggestEndsOn. */
export function suggestEndsOn(
  startsOn: string,
  period: MaintenancePeriodKind,
): string {
  const [y, m, d] = startsOn.split('-').map(Number)
  if (!y || !m || !d) return startsOn
  const start = new Date(Date.UTC(y, m - 1, d))
  if (period === 'monthly') {
    start.setUTCMonth(start.getUTCMonth() + 1)
  } else {
    start.setUTCFullYear(start.getUTCFullYear() + 1)
  }
  start.setUTCDate(start.getUTCDate() - 1)
  return start.toISOString().slice(0, 10)
}

export async function listMaintenances(
  params: {
    page?: number
    perPage?: number
    status?: string
    scope?: string
    period?: MaintenancePeriodKind | ''
    clientId?: number
    projectId?: number
    endingWithin?: 7 | 30
    sort?: string
  } = {},
  signal?: AbortSignal,
): Promise<{ data: MaintenancePeriod[]; meta: MaintenanceMeta }> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.perPage) q.set('per_page', String(params.perPage))
  if (params.status) q.set('status', params.status)
  if (params.scope) q.set('scope', params.scope)
  if (params.period) q.set('period', params.period)
  if (params.clientId) q.set('client_id', String(params.clientId))
  if (params.projectId) q.set('project_id', String(params.projectId))
  if (params.endingWithin) q.set('ending_within', String(params.endingWithin))
  if (params.sort) q.set('sort', params.sort)
  const qs = q.toString()
  return request(`/api/maintenances${qs ? `?${qs}` : ''}`, {
    signal,
  })
}

export async function getMaintenance(id: number): Promise<MaintenancePeriod> {
  return request(`/api/maintenances/${id}`, {})
}

export async function createMaintenance(
  body: MaintenanceInput,
): Promise<MaintenancePeriod> {
  return request('/api/maintenances', { method: 'POST', body })
}

export async function updateMaintenance(
  id: number,
  body: Partial<MaintenanceInput> & { status?: MaintenanceStatus },
): Promise<MaintenancePeriod> {
  return request(`/api/maintenances/${id}`, {
    method: 'PUT',
    body,
  })
}

export async function deleteMaintenance(id: number): Promise<void> {
  await request(`/api/maintenances/${id}`, { method: 'DELETE' })
}

export function maintenanceErrorMessage(err: unknown): string {
  return apiErrorMessage(err)
}
