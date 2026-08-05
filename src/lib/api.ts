export type AuthUser = {
    id: number;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string | null;
    employeeName?: string | null;
    dni?: string | null;
    category?: string | null;
};

export class ApiError extends Error {
    status: number;
    fieldErrors?: Record<string, string[]>;
    /** Raw JSON body (e.g. start 409 `{ message, timer }`). */
    data?: unknown;

    constructor(message: string, status: number, fieldErrors?: Record<string, string[]>, data?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.fieldErrors = fieldErrors;
        this.data = data;
    }
}

function getBaseUrl(): string {
    const isProd = import.meta.env.VITE_ENV === 'Production';
    return (
        (isProd ? import.meta.env.VITE_API_URL_PROD : import.meta.env.VITE_API_URL_DEV) ??
        'http://localhost:8000'
    );
}

/** One-time cleanup of legacy Bearer token storage. */
function clearLegacyToken(): void {
    try {
        localStorage.removeItem('bohub_token');
    } catch {
        /* ignore */
    }
}

function readXsrfToken(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    if (!match?.[1]) return null;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

let csrfPromise: Promise<void> | null = null;

/** Hit Sanctum csrf endpoint so session + XSRF-TOKEN cookies exist. */
export async function ensureCsrf(): Promise<void> {
    if (!csrfPromise) {
        csrfPromise = (async () => {
            const res = await fetch(`${getBaseUrl()}/sanctum/csrf-cookie`, {
                method: 'GET',
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) {
                throw new ApiError(`CSRF init failed (${res.status})`, res.status);
            }
        })().finally(() => {
            csrfPromise = null;
        });
    }
    await csrfPromise;
}

type RequestOptions = {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    /** Internal: already retried after 419 */
    _retried?: boolean;
};

function buildHeaders(method: string, isJsonBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };
    if (isJsonBody) {
        headers['Content-Type'] = 'application/json';
    }
    const xsrf = readXsrfToken();
    if (xsrf && method !== 'GET' && method !== 'HEAD') {
        headers['X-XSRF-TOKEN'] = xsrf;
    }
    return headers;
}

async function parseError(res: Response, data: unknown): Promise<ApiError> {
    let message = `Error ${res.status}`;
    let fieldErrors: Record<string, string[]> | undefined;
    if (data && typeof data === 'object') {
        if ('message' in data && typeof (data as { message: unknown }).message === 'string') {
            message = (data as { message: string }).message;
        }
        if ('errors' in data && data.errors && typeof data.errors === 'object') {
            const raw = data.errors as Record<string, unknown>;
            fieldErrors = {};
            for (const [key, value] of Object.entries(raw)) {
                if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
                    fieldErrors[key] = value as string[];
                } else if (typeof value === 'string') {
                    fieldErrors[key] = [value];
                }
            }
            if (Object.keys(fieldErrors).length === 0) {
                fieldErrors = undefined;
            } else {
                const first = Object.values(fieldErrors)[0];
                if (first?.[0]) message = first[0];
            }
        }
    }
    return new ApiError(message, res.status, fieldErrors, data);
}

export async function request<T>(path: string, { method = 'GET', body, signal, _retried }: RequestOptions = {}): Promise<T> {
    clearLegacyToken();

    const headers = buildHeaders(method, body !== undefined);

    let res: Response;
    try {
        res = await fetch(`${getBaseUrl()}${path}`, {
            method,
            headers,
            credentials: 'include',
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal,
        });
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw err;
        }
        throw new ApiError('No se pudo conectar con la API. ¿Está el back en marcha?', 0);
    }

    if (res.status === 419 && !_retried) {
        await ensureCsrf();
        return request<T>(path, { method, body, signal, _retried: true });
    }

    const data: unknown = await res.json().catch(() => null);

    if (!res.ok) {
        throw await parseError(res, data);
    }

    return data as T;
}

/** Multipart POST with session cookies + CSRF (no Content-Type: let browser set boundary). */
export async function requestFormData<T>(
    path: string,
    formData: FormData,
    { signal, _retried }: { signal?: AbortSignal; _retried?: boolean } = {},
): Promise<T> {
    clearLegacyToken();

    const headers = buildHeaders('POST', false);
    delete headers['Content-Type'];

    let res: Response;
    try {
        res = await fetch(`${getBaseUrl()}${path}`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: formData,
            signal,
        });
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw err;
        }
        throw new ApiError('No se pudo conectar con la API. ¿Está el back en marcha?', 0);
    }

    if (res.status === 419 && !_retried) {
        await ensureCsrf();
        return requestFormData<T>(path, formData, { signal, _retried: true });
    }

    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
        throw await parseError(res, data);
    }
    return data as T;
}

export async function login(email: string, password: string): Promise<{ user: AuthUser }> {
    await ensureCsrf();
    return request<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
    });
}

export async function logout(): Promise<void> {
    try {
        await request<{ ok: boolean }>('/api/auth/logout', {
            method: 'POST',
        });
    } catch (err) {
        // ponytail: already logged out / network — still clear client state
        if (!(err instanceof ApiError && (err.status === 401 || err.status === 419))) {
            throw err;
        }
    }
}

export async function me(): Promise<AuthUser> {
    const data = await request<{ user: AuthUser }>('/api/auth/me');
    return data.user;
}

export function apiErrorMessage(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Error inesperado';
}

/** Laravel 422 `errors` map from an ApiError (empty if none). */
export function apiFieldErrors(err: unknown): Record<string, string[]> {
    if (err instanceof ApiError && err.fieldErrors) return err.fieldErrors;
    return {};
}

export function firstFieldError(
    errors: Record<string, string[]> | Record<string, string> | undefined,
    key: string,
): string | undefined {
    if (!errors) return undefined;
    const v = errors[key];
    if (Array.isArray(v)) return v[0];
    return typeof v === 'string' ? v : undefined;
}

/** Flatten Laravel errors to first message per field (form state). */
export function flattenFieldErrors(errors: Record<string, string[]>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, msgs] of Object.entries(errors)) {
        if (msgs?.[0]) out[key] = msgs[0];
    }
    return out;
}

export { getBaseUrl };
