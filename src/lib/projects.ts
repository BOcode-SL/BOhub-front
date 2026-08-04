import { request, apiErrorMessage } from './api';

export const PROJECT_TYPES = ['web', 'webapp', 'mobil', 'api', 'automation', 'ia', 'consulting', 'other'] as const;

export const PROJECT_STATUSES = ['todo', 'in_progress', 'in_review', 'blocked', 'done', 'maintenance'] as const;

export const PROJECT_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export type ProjectClient = { id: number; name: string };

export type Project = {
    id: number;
    clientId: number;
    name: string;
    type: ProjectType;
    status: ProjectStatus;
    priority: ProjectPriority;
    color: string | null;
    icon?: string | null;
    startDate: string | null;
    endDate: string | null;
    client?: ProjectClient;
    description?: string | null;
    createdBy?: number | null;
    createdAt?: string;
    updatedAt?: string;
    jiraProjectKey?: string | null;
    jiraIssueKey?: string | null;
    jiraProjectUrl?: string | null;
    jiraIssueUrl?: string | null;
    jiraLinked?: boolean;
};

export type ProjectInput = {
    clientId: number;
    name: string;
    type: ProjectType;
    status: ProjectStatus;
    priority: ProjectPriority;
    color?: string | null;
    icon?: string | null;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    jiraProjectKey?: string;
    jiraMode?: 'create' | 'link';
    jiraIssueKey?: string | null;
    unlinkJira?: boolean;
};

export type ProjectSummary = {
    daysRemaining: number | null;
    jiraProjectKey: string | null;
    jiraIssueKey: string | null;
    jiraProjectUrl: string | null;
    jiraIssueUrl: string | null;
    jiraBaseUrl: string | null;
    jiraLinked: boolean;
};

export type ProjectHoursSummary = {
    totalSeconds: number;
    pricePerHour: number | string | null;
};

export type ProjectBillingSummary = {
    paymentsTotal: number | string;
    paymentsNet: number | string;
    expensesTotal: number | string;
    netBenefit: number | string;
};

export type ProjectActivity = {
    id: number;
    projectId: number;
    userId: number | null;
    user?: { id: number; name: string } | null;
    source: 'local';
    event: string;
    occurredAt: string;
    message: string;
    meta?: Record<string, unknown> | null;
};

export type PaginatedProjectActivities = {
    data: ProjectActivity[];
    meta: ProjectsMeta;
};

export type ProjectsMeta = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
};

export type PaginatedProjects = {
    data: Project[];
    meta: ProjectsMeta;
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
    web: 'Web',
    webapp: 'Web app',
    mobil: 'Móvil',
    api: 'API',
    automation: 'Automatización',
    ia: 'IA',
    consulting: 'Consultoría',
    other: 'Otro',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
    todo: 'Por hacer',
    in_progress: 'En progreso',
    in_review: 'En revisión',
    blocked: 'Bloqueado',
    done: 'Finalizado',
    maintenance: 'En mantenimiento',
};

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    urgent: 'Urgente',
};

export async function listProjects(
    params: {
        search?: string;
        page?: number;
        perPage?: number;
        status?: string;
        clientId?: number;
        sort?: string;
    } = {},
    signal?: AbortSignal,
): Promise<PaginatedProjects> {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
    if (params.perPage) q.set('per_page', String(params.perPage));
    if (params.status) q.set('status', params.status);
    if (params.clientId) q.set('client_id', String(params.clientId));
    if (params.sort) q.set('sort', params.sort);
    const qs = q.toString();
    return request<PaginatedProjects>(`/api/projects${qs ? `?${qs}` : ''}`, {
        signal,
    });
}

// ponytail: 60s options cache for billing sheets; upgrade = /projects/options
let projectOptionsCache: { at: number; data: { id: number; name: string }[] } | null = null;

export async function listProjectOptions(signal?: AbortSignal): Promise<{ id: number; name: string }[]> {
    if (projectOptionsCache && Date.now() - projectOptionsCache.at < 60_000) {
        return projectOptionsCache.data;
    }
    const res = await listProjects({ perPage: 50, sort: 'name' }, signal);
    const data = res.data.map((p) => ({ id: p.id, name: p.name }));
    projectOptionsCache = { at: Date.now(), data };
    return data;
}

export function invalidateProjectOptionsCache(): void {
    projectOptionsCache = null;
}

export async function getProject(id: number): Promise<Project> {
    return request<Project>(`/api/projects/${id}`, {});
}

export async function getProjectSummary(id: number, signal?: AbortSignal): Promise<ProjectSummary> {
    return request<ProjectSummary>(`/api/projects/${id}/summary`, { signal });
}

export async function getHoursSummary(id: number, signal?: AbortSignal): Promise<ProjectHoursSummary> {
    return request<ProjectHoursSummary>(`/api/projects/${id}/hours-summary`, { signal });
}

export async function getBillingSummary(id: number, signal?: AbortSignal): Promise<ProjectBillingSummary> {
    return request<ProjectBillingSummary>(`/api/projects/${id}/billing-summary`, { signal });
}

export async function listProjectActivities(
    id: number,
    params: { page?: number; perPage?: number } = {},
    signal?: AbortSignal,
): Promise<PaginatedProjectActivities> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.perPage) q.set('per_page', String(params.perPage));
    return request<PaginatedProjectActivities>(`/api/projects/${id}/activities${q.size ? `?${q}` : ''}`, { signal });
}

export async function syncProjectJira(id: number): Promise<Project> {
    return request<Project>(`/api/projects/${id}/sync-jira`, { method: 'POST' });
}

export async function createProject(body: ProjectInput): Promise<Project> {
    const created = await request<Project>('/api/projects', {
        method: 'POST',
        body,
    });
    invalidateProjectOptionsCache();
    return created;
}

export async function updateProject(id: number, body: Partial<ProjectInput>): Promise<Project> {
    const updated = await request<Project>(`/api/projects/${id}`, {
        method: 'PUT',
        body,
    });
    invalidateProjectOptionsCache();
    return updated;
}

export async function deleteProject(id: number): Promise<void> {
    await request<{ ok: boolean }>(`/api/projects/${id}`, {
        method: 'DELETE',
    });
    invalidateProjectOptionsCache();
}

export function projectErrorMessage(err: unknown): string {
    return apiErrorMessage(err);
}
