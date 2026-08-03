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
}

export async function request<T>(
  path: string,
  { method = 'GET', body, auth = false }: RequestOptions = {},
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
    })
  } catch {
    throw new ApiError('No se pudo conectar con la API. ¿Está el back en marcha?', 0)
  }

  const data: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    const message =
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof (data as { message: unknown }).message === 'string'
        ? (data as { message: string }).message
        : `Error ${res.status}`
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

export { TOKEN_KEY }
