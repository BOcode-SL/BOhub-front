import { request, ApiError } from './api'

export type Client = {
  id: number
  name: string
  taxId: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  notes: string | null
  createdAt?: string
  updatedAt?: string
}

export type ClientInput = {
  name: string
  taxId?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  postalCode?: string | null
  country?: string | null
  notes?: string | null
}

export type ClientsMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

export type PaginatedClients = {
  data: Client[]
  meta: ClientsMeta
  links?: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
}

export async function listClients(
  params: {
    search?: string
    page?: number
    perPage?: number
    sort?: string
  } = {},
  signal?: AbortSignal,
): Promise<PaginatedClients> {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  if (params.page) q.set('page', String(params.page))
  if (params.perPage) q.set('per_page', String(params.perPage))
  if (params.sort) q.set('sort', params.sort)
  const qs = q.toString()
  return request<PaginatedClients>(`/api/clients${qs ? `?${qs}` : ''}`, {
    auth: true,
    signal,
  })
}

export async function getClient(id: number): Promise<Client> {
  return request<Client>(`/api/clients/${id}`, { auth: true })
}

export async function createClient(body: ClientInput): Promise<Client> {
  return request<Client>('/api/clients', { method: 'POST', body, auth: true })
}

export async function updateClient(
  id: number,
  body: ClientInput,
): Promise<Client> {
  return request<Client>(`/api/clients/${id}`, {
    method: 'PUT',
    body,
    auth: true,
  })
}

export async function deleteClient(id: number): Promise<void> {
  await request<{ ok: boolean }>(`/api/clients/${id}`, {
    method: 'DELETE',
    auth: true,
  })
}

export function clientErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Error inesperado'
}
