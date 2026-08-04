import { request, apiErrorMessage } from './api';

export const LEDGER_STATUSES = ['draft', 'pending', 'paid', 'partially_paid'] as const;

export const VERIFACTU_STATUSES = ['unknown', 'pending', 'sent', 'n_a'] as const;

export type LedgerStatus = (typeof LEDGER_STATUSES)[number];
export type VerifactuStatus = (typeof VERIFACTU_STATUSES)[number];

export const LEDGER_STATUS_LABELS: Record<LedgerStatus, string> = {
    draft: 'Borrador',
    pending: 'Pendiente',
    paid: 'Pagado',
    partially_paid: 'Pago parcial',
};

export const VERIFACTU_STATUS_LABELS: Record<VerifactuStatus, string> = {
    unknown: 'Desconocido',
    pending: 'Pendiente',
    sent: 'Enviado',
    n_a: 'N/A',
};

export type BillingProject = {
    id: number;
    name: string;
    client?: { id: number; name: string } | null;
};

export type Payment = {
    id: number;
    projectId: number | null;
    baseAmount?: string;
    ivaRate?: string;
    irpfRate?: string;
    totalAmount: string;
    status: LedgerStatus;
    paymentMethod?: string | null;
    invoiceDate: string | null;
    paymentDate?: string | null;
    reference: string | null;
    invoiceNumber: string | null;
    verifactuStatus?: VerifactuStatus;
    invoiceUrl: string | null;
    project?: BillingProject | null;
    notes?: string | null;
    externalSystem?: string | null;
    externalInvoiceId?: string | null;
    externalUrl?: string | null;
    storageProvider?: string | null;
    storageKey?: string | null;
    fileName?: string | null;
};

export type PaymentInput = {
    projectId?: number | null;
    baseAmount: number | string;
    ivaRate?: number | string;
    irpfRate?: number | string;
    status: LedgerStatus;
    paymentMethod?: string | null;
    invoiceDate?: string | null;
    paymentDate?: string | null;
    reference?: string | null;
    notes?: string | null;
    externalSystem?: string | null;
    externalInvoiceId?: string | null;
    invoiceNumber?: string | null;
    externalUrl?: string | null;
    verifactuStatus?: VerifactuStatus;
    invoiceUrl?: string | null;
    fileName?: string | null;
};

export type Expense = {
    id: number;
    projectId: number | null;
    description: string;
    recipient: string | null;
    category?: string | null;
    baseAmount?: string;
    ivaRate?: string;
    irpfRate?: string;
    totalAmount: string;
    status: LedgerStatus;
    expenseDate: string | null;
    paymentDate?: string | null;
    invoiceUrl: string | null;
    project?: BillingProject | null;
    notes?: string | null;
    storageProvider?: string | null;
    fileName?: string | null;
};

export type ExpenseInput = {
    projectId?: number | null;
    description: string;
    recipient?: string | null;
    category?: string | null;
    baseAmount: number | string;
    ivaRate?: number | string;
    irpfRate?: number | string;
    status: LedgerStatus;
    expenseDate?: string | null;
    paymentDate?: string | null;
    notes?: string | null;
    invoiceUrl?: string | null;
    fileName?: string | null;
};

export type BillingMeta = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
};

export type BillingBucket = {
    count: number;
    base: string;
    iva: string;
    irpf: string;
    total: string;
    pendingCount: number;
    pendingTotal: string;
};

export type BillingSummary = {
    year: number;
    quarter: number | 'all';
    from: string;
    to: string;
    income: BillingBucket;
    expense: BillingBucket;
    net: string;
};

/** total = base + base*iva/100 - base*irpf/100 */
export function calcTotal(base: number, ivaRate: number, irpfRate: number): number {
    return Math.round((base + (base * ivaRate) / 100 - (base * irpfRate) / 100) * 100) / 100;
}

export function formatMoney(value: string | number): string {
    const n = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
    }).format(n);
}

export function currentQuarter(d = new Date()): 1 | 2 | 3 | 4 {
    return (Math.floor(d.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

export async function getBillingSummary(
    params: {
        year: number;
        quarter: 1 | 2 | 3 | 4 | 'all';
    },
    signal?: AbortSignal,
): Promise<BillingSummary> {
    const q = new URLSearchParams({
        year: String(params.year),
        quarter: String(params.quarter),
    });
    return request<BillingSummary>(`/api/billing/summary?${q}`, {
        signal,
    });
}

export async function listPayments(
    params: {
        search?: string;
        page?: number;
        perPage?: number;
        status?: string;
        projectId?: number;
        year?: number;
    } = {},
    signal?: AbortSignal,
) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
    if (params.perPage) q.set('per_page', String(params.perPage));
    if (params.status) q.set('status', params.status);
    if (params.projectId) q.set('project_id', String(params.projectId));
    if (params.year) q.set('year', String(params.year));
    const qs = q.toString();
    return request<{ data: Payment[]; meta: BillingMeta }>(`/api/payments${qs ? `?${qs}` : ''}`, { signal });
}

export async function getPayment(id: number): Promise<Payment> {
    return request<Payment>(`/api/payments/${id}`, {});
}

export async function createPayment(body: PaymentInput): Promise<Payment> {
    return request<Payment>('/api/payments', { method: 'POST', body });
}

export async function updatePayment(id: number, body: Partial<PaymentInput>): Promise<Payment> {
    return request<Payment>(`/api/payments/${id}`, {
        method: 'PUT',
        body,
    });
}

export async function deletePayment(id: number): Promise<void> {
    await request<{ ok: boolean }>(`/api/payments/${id}`, {
        method: 'DELETE',
    });
}

export async function listExpenses(
    params: {
        search?: string;
        page?: number;
        perPage?: number;
        status?: string;
        projectId?: number;
        year?: number;
    } = {},
    signal?: AbortSignal,
) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
    if (params.perPage) q.set('per_page', String(params.perPage));
    if (params.status) q.set('status', params.status);
    if (params.projectId) q.set('project_id', String(params.projectId));
    if (params.year) q.set('year', String(params.year));
    const qs = q.toString();
    return request<{ data: Expense[]; meta: BillingMeta }>(`/api/expenses${qs ? `?${qs}` : ''}`, { signal });
}

export async function getExpense(id: number): Promise<Expense> {
    return request<Expense>(`/api/expenses/${id}`, {});
}

export async function createExpense(body: ExpenseInput): Promise<Expense> {
    return request<Expense>('/api/expenses', { method: 'POST', body });
}

export async function updateExpense(id: number, body: Partial<ExpenseInput>): Promise<Expense> {
    return request<Expense>(`/api/expenses/${id}`, {
        method: 'PUT',
        body,
    });
}

export async function deleteExpense(id: number): Promise<void> {
    await request<{ ok: boolean }>(`/api/expenses/${id}`, {
        method: 'DELETE',
    });
}

export function billingErrorMessage(err: unknown): string {
    return apiErrorMessage(err);
}
