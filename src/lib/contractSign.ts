import { ApiError, getBaseUrl } from './api';
import type { ContractDocument, ContractField, ContractStatus } from './contracts';

export type SignMeta = {
    title: string;
    uuid: string;
    status: ContractStatus;
    expiresAt: string | null;
    documents: ContractDocument[];
    fields: ContractField[];
    signer: { id: number; name: string; email: string; position: number };
    yourTurn: boolean;
    consentText: string;
};

export type SignFieldPayload = {
    fieldId: number;
    pngBase64?: string;
    value?: string;
};

export type SignResult = { ok: boolean; status: ContractStatus };

/** Public sign API — no cookies, no CSRF. */
async function signFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    headers.set('X-Requested-With', 'XMLHttpRequest');

    try {
        return await fetch(`${getBaseUrl()}${path}`, {
            ...init,
            headers,
            credentials: 'omit',
        });
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        throw new ApiError('No se pudo conectar con la API. ¿Está el back en marcha?', 0);
    }
}

async function parseSignError(res: Response): Promise<ApiError> {
    let message = `Error ${res.status}`;
    let fieldErrors: Record<string, string[]> | undefined;
    let data: unknown;
    try {
        data = await res.json();
        if (data && typeof data === 'object') {
            const obj = data as { message?: string; errors?: Record<string, string[]> };
            if (typeof obj.message === 'string') message = obj.message;
            if (obj.errors) {
                fieldErrors = obj.errors;
                const first = Object.values(obj.errors)[0]?.[0];
                if (first) message = first;
            }
        }
    } catch {
        /* ignore */
    }
    return new ApiError(message, res.status, fieldErrors, data);
}

export async function getSignMeta(token: string, signal?: AbortSignal): Promise<SignMeta> {
    const res = await signFetch(`/api/sign/${encodeURIComponent(token)}`, { method: 'GET', signal });
    if (!res.ok) throw await parseSignError(res);
    return (await res.json()) as SignMeta;
}

export async function getSignDocumentBlob(token: string, docId: number): Promise<Blob> {
    const res = await signFetch(`/api/sign/${encodeURIComponent(token)}/documents/${docId}/file`, {
        method: 'GET',
        headers: { Accept: 'application/pdf,application/json' },
    });
    if (!res.ok) throw await parseSignError(res);
    return res.blob();
}

export async function postSignView(token: string): Promise<void> {
    const res = await signFetch(`/api/sign/${encodeURIComponent(token)}/view`, {
        method: 'POST',
        body: '{}',
    });
    if (!res.ok) throw await parseSignError(res);
}

export async function postSign(
    token: string,
    body: { consent: true; timezone?: string; fields: SignFieldPayload[] },
): Promise<SignResult> {
    const res = await signFetch(`/api/sign/${encodeURIComponent(token)}`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
    if (!res.ok) throw await parseSignError(res);
    return (await res.json()) as SignResult;
}

export async function postSignDecline(token: string, reason?: string): Promise<void> {
    const res = await signFetch(`/api/sign/${encodeURIComponent(token)}/decline`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || null }),
    });
    if (!res.ok) throw await parseSignError(res);
}

export function signErrorCurrentEmail(err: unknown): string | null {
    if (!(err instanceof ApiError) || !err.data || typeof err.data !== 'object') return null;
    const email = (err.data as { currentSignerEmail?: unknown }).currentSignerEmail;
    return typeof email === 'string' && email ? email : null;
}
