import { request } from './api';

export const SUBSCRIPTION_STATUSES = ['active', 'expired', 'cancelled'] as const;
export const SUBSCRIPTION_CATEGORIES = ['domain', 'hosting', 'vps', 'saas', 'ia', 'other'] as const;
export const SUBSCRIPTION_BILLING_CYCLES = ['monthly', 'semiannual', 'annual', 'biennial', 'other'] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type SubscriptionCategory = (typeof SUBSCRIPTION_CATEGORIES)[number];
export type SubscriptionBillingCycle = (typeof SUBSCRIPTION_BILLING_CYCLES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
    active: 'Activa',
    expired: 'Caducada',
    cancelled: 'Cancelada',
};

export const SUBSCRIPTION_STATUS_BADGE_CLASS: Record<SubscriptionStatus, string> = {
    active: 'border-transparent bg-primary/20 text-primary',
    expired: 'border-transparent bg-slate-500/25 text-slate-300',
    cancelled: 'border-transparent bg-destructive/20 text-destructive',
};

export const SUBSCRIPTION_CATEGORY_LABELS: Record<SubscriptionCategory, string> = {
    domain: 'Dominio',
    hosting: 'Hosting',
    vps: 'VPS',
    saas: 'SaaS',
    ia: 'IA',
    other: 'Otro',
};

export const SUBSCRIPTION_BILLING_CYCLE_LABELS: Record<SubscriptionBillingCycle, string> = {
    monthly: 'Mensual',
    semiannual: 'Semestral',
    annual: 'Anual',
    biennial: 'Bienal',
    other: 'Otro',
};

/** Days from today (UTC date) until dateYmd; null if unparseable. */
export function daysUntilDate(dateYmd: string): number | null {
    const [y, m, d] = dateYmd.split('-').map(Number);
    if (!y || !m || !d) return null;
    const end = Date.UTC(y, m - 1, d);
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.round((end - today) / 86_400_000);
}

/** @deprecated use daysUntilDate */
export function daysUntilRenewsOn(renewsOn: string): number | null {
    return daysUntilDate(renewsOn);
}

export function displaySubscriptionStatus(
    status: SubscriptionStatus,
    expiresOn: string,
): SubscriptionStatus | 'expiring' {
    if (status === 'cancelled' || status === 'expired') return status;
    const days = daysUntilDate(expiresOn);
    if (days != null && days >= 0 && days <= 30) return 'expiring';
    return 'active';
}

export const EXPIRING_BADGE_CLASS = 'border-transparent bg-amber-500/20 text-amber-200';

/** Hide number input spinners (Chrome/Safari/Firefox). */
export const NO_SPINNER_INPUT_CLASS =
    '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

export type Subscription = {
    id: number;
    name: string;
    provider?: string | null;
    category: SubscriptionCategory;
    renewalPrice?: string | null;
    currency: string;
    billingCycle: SubscriptionBillingCycle;
    autoRenew: boolean;
    renewsOn: string;
    expiresOn: string;
    status: SubscriptionStatus;
    notes?: string | null;
    projectId?: number | null;
    lastPaidAmount?: string | null;
    lastPaidOn?: string | null;
    project?: { id: number; name: string } | null;
    createdBy?: number | null;
};

export type SubscriptionInput = {
    name: string;
    provider?: string | null;
    category: SubscriptionCategory;
    renewalPrice?: number | null;
    currency?: string;
    billingCycle: SubscriptionBillingCycle;
    autoRenew?: boolean;
    renewsOn: string;
    expiresOn: string;
    notes?: string | null;
    projectId?: number | null;
    lastPaidAmount?: number | null;
    lastPaidOn?: string | null;
    status?: SubscriptionStatus;
};

export type SubscriptionMeta = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
};

export function formatRenewalPrice(amount: string | null | undefined, currency = 'EUR'): string {
    if (amount == null || amount === '') return '—';
    const n = Number(amount);
    if (!Number.isFinite(n)) return String(amount);
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(n);
}

export async function listSubscriptions(
    params: {
        page?: number;
        perPage?: number;
        scope?: string;
        category?: SubscriptionCategory | '';
        provider?: string;
        search?: string;
        status?: SubscriptionStatus | '';
        sort?: string;
    } = {},
    signal?: AbortSignal,
): Promise<{ data: Subscription[]; meta: SubscriptionMeta }> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.perPage) q.set('per_page', String(params.perPage));
    if (params.scope) q.set('scope', params.scope);
    if (params.category) q.set('category', params.category);
    if (params.provider) q.set('provider', params.provider);
    if (params.search) q.set('search', params.search);
    if (params.status) q.set('status', params.status);
    if (params.sort) q.set('sort', params.sort);
    const qs = q.toString();
    return request(`/api/subscriptions${qs ? `?${qs}` : ''}`, { signal });
}

export async function createSubscription(body: SubscriptionInput): Promise<Subscription> {
    return request('/api/subscriptions', { method: 'POST', body });
}

export async function updateSubscription(
    id: number,
    body: Partial<SubscriptionInput> & { status?: SubscriptionStatus },
): Promise<Subscription> {
    return request(`/api/subscriptions/${id}`, { method: 'PUT', body });
}

export async function deleteSubscription(id: number): Promise<void> {
    await request(`/api/subscriptions/${id}`, { method: 'DELETE' });
}
