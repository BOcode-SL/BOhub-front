import { request, requestFormData, ensureCsrf, getBaseUrl, ApiError } from './api';
import type { EmailTemplate } from './emails';

export const CONTRACT_STATUSES = [
    'draft',
    'sent',
    'partially_signed',
    'signed',
    'declined',
    'cancelled',
    'expired',
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
    draft: 'Borrador',
    sent: 'Enviado',
    partially_signed: 'Parcialmente firmado',
    signed: 'Firmado',
    declined: 'Declinado',
    cancelled: 'Cancelado',
    expired: 'Caducado',
};

export const CONTRACT_STATUS_BADGE_CLASS: Record<ContractStatus, string> = {
    draft: 'border-transparent bg-muted text-muted-foreground',
    sent: 'border-transparent bg-sky-500/20 text-sky-300',
    partially_signed: 'border-transparent bg-amber-500/20 text-amber-300',
    signed: 'border-transparent bg-emerald-500/20 text-emerald-300',
    declined: 'border-transparent bg-destructive/20 text-destructive',
    cancelled: 'border-transparent bg-muted text-muted-foreground',
    expired: 'border-transparent bg-orange-500/20 text-orange-300',
};

export const CONTRACT_FIELD_TYPES = ['signature', 'date', 'name'] as const;
export type ContractFieldType = (typeof CONTRACT_FIELD_TYPES)[number];

export const CONTRACT_FIELD_TYPE_LABELS: Record<ContractFieldType, string> = {
    signature: 'Firma',
    date: 'Fecha',
    name: 'Nombre',
};

export const CONTRACT_EVENT_LABELS: Record<string, string> = {
    created: 'Creado',
    sent: 'Enviado',
    viewed: 'Visto',
    sign_started: 'Firma iniciada',
    sign_completed: 'Firma completada',
    declined: 'Declinado',
    reminded: 'Recordatorio',
    cancelled: 'Cancelado',
    expired: 'Caducado',
};

export type ContractClient = { id: number; name: string };
export type ContractProject = { id: number; name: string } | null;

export type ContractDocument = {
    id: number;
    contractId: number;
    position: number;
    fileName: string;
    storageProvider?: string | null;
    storageKeyOriginal?: string | null;
    storageKeySigned?: string | null;
    sha256Original?: string | null;
    sha256Signed?: string | null;
    pageCount: number | null;
    createdAt?: string;
    updatedAt?: string;
};

export type ContractSigner = {
    id: number;
    contractId: number;
    position: number;
    name: string;
    email: string;
    status: 'pending' | 'signed' | 'declined';
    signedAt?: string | null;
    declinedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
};

export type ContractField = {
    id: number;
    contractId: number;
    documentId: number;
    signerId: number;
    type: ContractFieldType;
    page: number;
    xPct: string | number;
    yPct: string | number;
    wPct: string | number;
    hPct: string | number;
    label: string | null;
    position: number;
};

export type ContractEvent = {
    id: number;
    contractId: number;
    signerId: number | null;
    type: string;
    ip?: string | null;
    userAgent?: string | null;
    meta?: Record<string, unknown> | null;
    createdAt: string;
};

export type Contract = {
    id: number;
    uuid: string;
    clientId: number;
    projectId: number | null;
    title: string;
    status: ContractStatus;
    signatureLevel: string;
    expiresAt: string | null;
    sentAt: string | null;
    signedAt: string | null;
    createdBy?: number | null;
    createdAt?: string;
    updatedAt?: string;
    client?: ContractClient | null;
    project?: ContractProject;
    documentCount?: number;
    signerCount?: number;
    documents?: ContractDocument[];
    signers?: ContractSigner[];
    fields?: ContractField[];
    events?: ContractEvent[];
};

export type ContractInput = {
    title: string;
    clientId: number;
    projectId?: number | null;
    expiresAt?: string | null;
};

export type ContractFieldInput = {
    documentId: number;
    signerId: number;
    type: ContractFieldType;
    page: number;
    xPct: number;
    yPct: number;
    wPct: number;
    hPct: number;
    label?: string | null;
    position?: number;
};

export type ContractsMeta = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
};

export type PaginatedContracts = {
    data: Contract[];
    meta: ContractsMeta;
};

/** Fixed palette by signer index (DocuSeal-like). */
export const SIGNER_COLORS = ['#ccff00', '#38bdf8', '#f472b6', '#a78bfa', '#fb923c', '#34d399'] as const;

export function signerColor(index: number): string {
    return SIGNER_COLORS[index % SIGNER_COLORS.length];
}

export function isDraft(status: ContractStatus): boolean {
    return status === 'draft';
}

export const BOCODE_SIGNER_EMAIL = 'hola@bocode.es';

export function isBocodeSigner(signer: { email: string }): boolean {
    return signer.email.trim().toLowerCase() === BOCODE_SIGNER_EMAIL;
}

export function sendBlockers(contract: Contract, fields?: ContractFieldInput[]): string[] {
    const docs = contract.documents ?? [];
    const signers = contract.signers ?? [];
    const rows = fields ?? (contract.fields ?? []).map(fieldToInput);
    const out: string[] = [];
    if (docs.length < 1) out.push('Añade al menos un PDF.');
    if (signers.length < 2) out.push('Se necesitan al menos 2 firmantes.');
    for (const signer of signers) {
        const hasSig = rows.some((f) => f.signerId === signer.id && f.type === 'signature');
        if (!hasSig) out.push(`${signer.name} necesita al menos un campo de firma.`);
    }
    return out;
}

export function fieldToInput(f: ContractField): ContractFieldInput {
    return {
        documentId: f.documentId,
        signerId: f.signerId,
        type: f.type,
        page: f.page,
        xPct: Number(f.xPct),
        yPct: Number(f.yPct),
        wPct: Number(f.wPct),
        hPct: Number(f.hPct),
        label: f.label,
        position: f.position,
    };
}

export async function listContracts(
    params: {
        search?: string;
        status?: string;
        page?: number;
        perPage?: number;
    } = {},
    signal?: AbortSignal,
): Promise<PaginatedContracts> {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.status) q.set('status', params.status);
    if (params.page) q.set('page', String(params.page));
    if (params.perPage) q.set('per_page', String(params.perPage));
    const qs = q.toString();
    return request<PaginatedContracts>(`/api/contracts${qs ? `?${qs}` : ''}`, { signal });
}

export async function getContract(id: number, signal?: AbortSignal): Promise<Contract> {
    return request<Contract>(`/api/contracts/${id}`, { signal });
}

export async function createContract(body: ContractInput): Promise<Contract> {
    return request<Contract>('/api/contracts', { method: 'POST', body });
}

export async function updateContract(id: number, body: Partial<ContractInput>): Promise<Contract> {
    return request<Contract>(`/api/contracts/${id}`, { method: 'PATCH', body });
}

export async function deleteContract(id: number): Promise<void> {
    await request<{ ok: boolean }>(`/api/contracts/${id}`, { method: 'DELETE' });
}

export async function uploadContractDocument(contractId: number, file: File): Promise<ContractDocument> {
    const fd = new FormData();
    fd.append('file', file);
    return requestFormData<ContractDocument>(`/api/contracts/${contractId}/documents`, fd);
}

export async function reorderDocuments(contractId: number, ids: number[]): Promise<ContractDocument[]> {
    const res = await request<{ documents: ContractDocument[] }>(`/api/contracts/${contractId}/documents/reorder`, {
        method: 'PATCH',
        body: { ids },
    });
    return res.documents;
}

export async function deleteDocument(contractId: number, documentId: number): Promise<void> {
    await request<{ ok: boolean }>(`/api/contracts/${contractId}/documents/${documentId}`, { method: 'DELETE' });
}

async function fetchAuthBlob(path: string): Promise<Response> {
    await ensureCsrf();
    const res = await fetch(`${getBaseUrl()}${path}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            Accept: 'application/pdf,application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });
    if (!res.ok) {
        let message = `Error ${res.status}`;
        try {
            const data = (await res.json()) as { message?: string };
            if (data.message) message = data.message;
        } catch {
            /* ignore */
        }
        throw new ApiError(message, res.status);
    }
    return res;
}

export async function getDocumentFileBlob(contractId: number, documentId: number): Promise<Blob> {
    const res = await fetchAuthBlob(`/api/contracts/${contractId}/documents/${documentId}/file`);
    return res.blob();
}

export async function addSigner(
    contractId: number,
    body: { name: string; email: string },
): Promise<ContractSigner> {
    return request<ContractSigner>(`/api/contracts/${contractId}/signers`, { method: 'POST', body });
}

export async function updateSigner(
    contractId: number,
    signerId: number,
    body: { name?: string; email?: string; position?: number },
): Promise<ContractSigner> {
    return request<ContractSigner>(`/api/contracts/${contractId}/signers/${signerId}`, {
        method: 'PATCH',
        body,
    });
}

export async function deleteSigner(contractId: number, signerId: number): Promise<void> {
    await request<{ ok: boolean }>(`/api/contracts/${contractId}/signers/${signerId}`, { method: 'DELETE' });
}

export async function replaceFields(contractId: number, fields: ContractFieldInput[]): Promise<ContractField[]> {
    const res = await request<{ fields: ContractField[] }>(`/api/contracts/${contractId}/fields`, {
        method: 'PUT',
        body: { fields },
    });
    return res.fields;
}

export async function sendContract(id: number): Promise<Contract> {
    return request<Contract>(`/api/contracts/${id}/send`, { method: 'POST' });
}

export async function remindContract(id: number): Promise<void> {
    await request<{ ok: boolean }>(`/api/contracts/${id}/remind`, { method: 'POST' });
}

export async function cancelContract(id: number): Promise<Contract> {
    return request<Contract>(`/api/contracts/${id}/cancel`, { method: 'POST' });
}

export async function downloadContractPack(id: number): Promise<void> {
    let res: Response;
    try {
        res = await fetchAuthBlob(`/api/contracts/${id}/download`);
    } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
            throw new ApiError(
                err.status === 404
                    ? 'El pack firmado no está en almacenamiento.'
                    : err.message || 'El pack solo está disponible cuando el sobre está firmado.',
                err.status,
            );
        }
        throw err;
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') ?? '';
    let filename = `contrato-${id}-firmado.pdf`;
    const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
    const plain = /filename="?([^";]+)"?/i.exec(cd);
    if (star?.[1]) filename = decodeURIComponent(star[1]);
    else if (plain?.[1]) filename = plain[1];

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export async function getContractEmailTemplate(signal?: AbortSignal): Promise<EmailTemplate> {
    return request<EmailTemplate>('/api/contracts/email-template', { signal });
}

export async function updateContractEmailTemplate(input: {
    subject: string;
    htmlBody: string;
    description?: string | null;
}): Promise<EmailTemplate> {
    return request<EmailTemplate>('/api/contracts/email-template', {
        method: 'PUT',
        body: input,
    });
}
