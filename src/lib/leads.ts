import { request } from './api';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'meeting' | 'won' | 'lost';
export type LeadSource = 'meta' | 'manual';

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
    };
};

export async function listLeads(
    params: { search?: string; status?: LeadStatus; assignedUserId?: number; page?: number; perPage?: number } = {},
    signal?: AbortSignal,
): Promise<PaginatedLeads> {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.status) q.set('status', params.status);
    if (params.assignedUserId) q.set('assigned_user_id', String(params.assignedUserId));
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
