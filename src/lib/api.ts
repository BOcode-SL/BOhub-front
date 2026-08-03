const TOKEN_KEY = 'bohub_token'

export type AuthUser = {
  id: number
  name: string
  email: string
  role: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

type RequestOptions = {
  method?: string
  body?: unknown
  auth?: boolean
  signal?: AbortSignal
}

export async function request<T>(
  path: string,
  { method = 'GET', body, auth = false, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  if (auth) {
    const token = getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  let res: Response
  try {
    res = await fetch(`${getBaseUrl()}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err
    }
    throw new ApiError('No se pudo conectar con la API. ¿Está el back en marcha?', 0)
  }

  const data: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    let message = `Error ${res.status}`
    if (data && typeof data === 'object') {
      if (
        'message' in data &&
        typeof (data as { message: unknown }).message === 'string'
      ) {
        message = (data as { message: string }).message
      }
      if (
        'errors' in data &&
        data.errors &&
        typeof data.errors === 'object'
      ) {
        const first = Object.values(data.errors as Record<string, string[]>)[0]
        if (Array.isArray(first) && first[0]) {
          message = first[0]
        }
      }
    }
    throw new ApiError(message, res.status)
  }

  return data as T
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const data = await request<{ token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  setToken(data.token)
  return data
}

export async function logout(): Promise<void> {
  try {
    if (getToken()) {
      await request<{ ok: boolean }>('/api/auth/logout', {
        method: 'POST',
        auth: true,
      })
    }
  } finally {
    clearToken()
  }
}

export async function me(): Promise<AuthUser> {
  const data = await request<{ user: AuthUser }>('/api/auth/me', { auth: true })
  return data.user
}

export function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Error inesperado'
}

export { TOKEN_KEY }
