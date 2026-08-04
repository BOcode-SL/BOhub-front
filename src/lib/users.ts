import { request, apiErrorMessage } from './api';

export type UserRole = 'admin' | 'employee' | 'billing';

export const USER_ROLES: UserRole[] = ['admin', 'employee', 'billing'];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Administrador',
    employee: 'Empleado',
    billing: 'Facturación',
};

export type HubUser = {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl: string | null;
    employeeName?: string | null;
    dni?: string | null;
    category?: string | null;
    createdAt?: string;
    updatedAt?: string;
};

export type UserInput = {
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    avatarUrl?: string | null;
    employeeName?: string | null;
    dni?: string | null;
    category?: string | null;
};

export type UsersMeta = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
};

export type PaginatedUsers = {
    data: HubUser[];
    meta: UsersMeta;
};

export function homePathForRole(role: string): string {
    return role === 'billing' ? '/dashboard/billing' : '/dashboard';
}

export async function listUsers(
    params: {
        search?: string;
        page?: number;
        perPage?: number;
    } = {},
    signal?: AbortSignal,
): Promise<PaginatedUsers> {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
    if (params.perPage) q.set('per_page', String(params.perPage));
    const qs = q.toString();
    return request<PaginatedUsers>(`/api/users${qs ? `?${qs}` : ''}`, { signal });
}

export async function getUser(id: number): Promise<HubUser> {
    return request<HubUser>(`/api/users/${id}`, {});
}

export async function createUser(body: UserInput): Promise<HubUser> {
    return request<HubUser>('/api/users', { method: 'POST', body });
}

export async function updateUser(id: number, body: UserInput): Promise<HubUser> {
    return request<HubUser>(`/api/users/${id}`, { method: 'PUT', body });
}

export async function deleteUser(id: number): Promise<void> {
    await request<{ ok: boolean }>(`/api/users/${id}`, { method: 'DELETE' });
}

export function userErrorMessage(err: unknown): string {
    return apiErrorMessage(err);
}
