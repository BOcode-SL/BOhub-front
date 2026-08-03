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

export type PaginatedClients = {
  data: Client[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export async function listClients(params: {
  search?: string
  page?: number
  perPage?: number
} = {}): Promise<PaginatedClients> {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  if (params.page) q.set('page', String(params.page))
  if (params.perPage) q.set('per_page', String(params.perPage))
  const qs = q.toString()
  return request<PaginatedClients>(`/api/clients${qs ? `?${qs}` : ''}`, {
    auth: true,
  })
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
