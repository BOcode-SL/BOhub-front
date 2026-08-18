import { request } from './api';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'meeting' | 'won' | 'lost';
export type LeadSource = 'meta' | 'manual';

export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'meeting', 'won', 'lost'];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
    new: 'Nueva',
    contacted: 'Contactada',
    qualified: 'Cualificada',
    meeting: 'Reunión',
    won: 'Ganada',
    lost: 'Perdida',
};

export const LEAD_SOURCES: LeadSource[] = ['meta', 'manual'];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
    meta: 'Meta',
    manual: 'Manual',
};

export const LEAD_STATUS_BADGE_CLASS: Record<LeadStatus, string> = {
    new: 'border-transparent bg-muted text-muted-foreground',
    contacted: 'border-transparent bg-blue-500/20 text-blue-300',
    qualified: 'border-transparent bg-sky-500/20 text-sky-300',
    meeting: 'border-transparent bg-amber-500/20 text-amber-300',
    won: 'border-transparent bg-emerald-500/20 text-emerald-300',
    lost: 'border-transparent bg-destructive/20 text-destructive',
};

export const LEAD_SOURCE_BADGE_CLASS: Record<LeadSource, string> = {
    meta: 'border-transparent bg-[#1877F2]/20 text-[#1877F2]',
    manual: 'border-transparent bg-primary/20 text-primary',
};

const HIDDEN_FORM_KEYS = new Set([
    'email',
    'phone',
    'phone_number',
    'full_name',
    'first_name',
    'last_name',
    'nombre',
    'nombre_completo',
    'name',
    'apellidos',
]);

export function leadFormAnswers(payload: Record<string, unknown> | null): { label: string; value: string }[] {
    if (!payload) return [];
    return Object.entries(payload)
        .filter(([key]) => !HIDDEN_FORM_KEYS.has(key.trim().toLowerCase()))
        .map(([label, raw]) => {
            if (raw == null || raw === '') return { label, value: '—' };
            if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
                return { label, value: String(raw) };
            }
            try {
                return { label, value: JSON.stringify(raw) };
            } catch {
                return { label, value: '—' };
            }
        });
}

export type LeadEvent = {
    id: number;
    type: 'note' | 'ingest' | 'status' | 'assign' | 'notify';
    body: string;
    user: { id: number | null; name: string | null } | null;
    createdAt: string | null;
};

export type Lead = {
    id: number;
    source: LeadSource;
    status: LeadStatus;
    assignedUserId: number | null;
    clientId: number | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    metaLeadId: string | null;
    campaignName: string | null;
    formName: string | null;
    adName: string | null;
    lostReason: string | null;
    payload: Record<string, unknown> | null;
    assignedUser?: { id: number | null; name: string | null; email: string | null } | null;
    events?: LeadEvent[];
    createdAt: string | null;
    updatedAt: string | null;
};

export type LeadInput = {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    source?: LeadSource;
    assignedUserId?: number | null;
    lostReason?: string | null;
};

type PaginatedLeads = {
    data: Lead[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from?: number | null;
        to?: number | null;
    };
};

export async function listLeads(
    params: { search?: string; status?: LeadStatus; assignedUserId?: number | 'none'; page?: number; perPage?: number } = {},
    signal?: AbortSignal,
): Promise<PaginatedLeads> {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.status) q.set('status', params.status);
    if (params.assignedUserId === 'none') q.set('assigned_user_id', 'none');
    else if (params.assignedUserId) q.set('assigned_user_id', String(params.assignedUserId));
    if (params.page) q.set('page', String(params.page));
    if (params.perPage) q.set('per_page', String(params.perPage));
    const qs = q.toString();
    return request<PaginatedLeads>(`/api/leads${qs ? `?${qs}` : ''}`, { signal });
}

export function listLeadAssignees(signal?: AbortSignal): Promise<{ data: { id: number; name: string; email: string | null }[] }> {
    return request('/api/leads/assignees', { signal });
}

export function getLead(id: number): Promise<Lead> {
    return request(`/api/leads/${id}`);
}

export function createLead(body: LeadInput): Promise<Lead> {
    return request('/api/leads', { method: 'POST', body });
}

export function updateLead(id: number, body: LeadInput): Promise<Lead> {
    return request(`/api/leads/${id}`, { method: 'PUT', body });
}

export function patchLeadStatus(id: number, status: LeadStatus, lostReason?: string | null): Promise<Lead> {
    return request(`/api/leads/${id}/status`, { method: 'PATCH', body: { status, lostReason: lostReason ?? null } });
}

export function patchLeadAssign(id: number, userId: number | null): Promise<Lead> {
    return request(`/api/leads/${id}/assign`, { method: 'PATCH', body: { userId } });
}

export function addLeadNote(id: number, body: string): Promise<Lead> {
    return request(`/api/leads/${id}/notes`, { method: 'POST', body: { body } });
}

export function deleteLead(id: number): Promise<{ ok: boolean }> {
    return request(`/api/leads/${id}`, { method: 'DELETE' });
}

export function whatsAppUrl(phone: string): string {
    const digits = phone.replace(/\D+/g, '');
    return `https://wa.me/${digits}`;
}
