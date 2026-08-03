import { request, ApiError } from './api'

export const PROJECT_TYPES = [
  'web',
  'webapp',
  'mobil',
  'api',
  'automation',
  'ia',
  'consulting',
  'other',
] as const

export const PROJECT_STATUSES = [
  'todo',
  'in_progress',
  'in_review',
  'blocked',
  'done',
  'maintenance',
] as const

export const PROJECT_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

export type ProjectType = (typeof PROJECT_TYPES)[number]
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number]

export type ProjectClient = { id: number; name: string }

export type Project = {
  id: number
  clientId: number
  name: string
  type: ProjectType
  status: ProjectStatus
  priority: ProjectPriority
  color: string | null
  icon: string | null
  startDate: string | null
  endDate: string | null
  client?: ProjectClient
  description?: string | null
  createdBy?: number | null
  createdAt?: string
  updatedAt?: string
}

export type ProjectInput = {
  clientId: number
  name: string
  type: ProjectType
  status: ProjectStatus
  priority: ProjectPriority
  color?: string | null
  icon?: string | null
  description?: string | null
  startDate?: string | null
  endDate?: string | null
}

export type ProjectsMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

export type PaginatedProjects = {
  data: Project[]
  meta: ProjectsMeta
}

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  web: 'Web',
  webapp: 'Web app',
  mobil: 'Móvil',
  api: 'API',
  automation: 'Automatización',
  ia: 'IA',
  consulting: 'Consultoría',
  other: 'Otro',
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  todo: 'Por hacer',
  in_progress: 'En progreso',
  in_review: 'En revisión',
  blocked: 'Bloqueado',
  done: 'Finalizado',
  maintenance: 'En mantenimiento',
}

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

export async function listProjects(
  params: {
    search?: string
    page?: number
    perPage?: number
    status?: string
    clientId?: number
    sort?: string
  } = {},
  signal?: AbortSignal,
): Promise<PaginatedProjects> {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  if (params.page) q.set('page', String(params.page))
  if (params.perPage) q.set('per_page', String(params.perPage))
  if (params.status) q.set('status', params.status)
  if (params.clientId) q.set('client_id', String(params.clientId))
  if (params.sort) q.set('sort', params.sort)
  const qs = q.toString()
  return request<PaginatedProjects>(`/api/projects${qs ? `?${qs}` : ''}`, {
    auth: true,
    signal,
  })
}

export async function getProject(id: number): Promise<Project> {
  return request<Project>(`/api/projects/${id}`, { auth: true })
}

export async function createProject(body: ProjectInput): Promise<Project> {
  return request<Project>('/api/projects', { method: 'POST', body, auth: true })
}

export async function updateProject(
  id: number,
  body: Partial<ProjectInput>,
): Promise<Project> {
  return request<Project>(`/api/projects/${id}`, {
    method: 'PUT',
    body,
    auth: true,
  })
}

export async function deleteProject(id: number): Promise<void> {
  await request<{ ok: boolean }>(`/api/projects/${id}`, {
    method: 'DELETE',
    auth: true,
  })
}

export function projectErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Error inesperado'
}
