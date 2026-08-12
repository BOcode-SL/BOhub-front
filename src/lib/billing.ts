import { request, apiErrorMessage, ensureCsrf, getBaseUrl, ApiError } from './api';

export const LEDGER_STATUSES = ['draft', 'pending', 'paid', 'partially_paid'] as const;

export const PAYMENT_METHODS = [
    'Transferencia Bancaria',
    'Bizum',
    'Efectivo',
    'Tarjeta',
    'Otro',
] as const;

export type LedgerStatus = (typeof LEDGER_STATUSES)[number];

export const LEDGER_STATUS_LABELS: Record<LedgerStatus, string> = {
    draft: 'Borrador',
    pending: 'Pendiente',
    paid: 'Pagado',
    partially_paid: 'Pago parcial',
};

/** Soft badge tints for dark BOcode UI (ledger tables). */
export const LEDGER_STATUS_BADGE_CLASS: Record<LedgerStatus, string> = {
    draft: 'border-transparent bg-muted text-muted-foreground',
    pending: 'border-transparent bg-amber-500/20 text-amber-300',
    paid: 'border-transparent bg-emerald-500/20 text-emerald-300',
    partially_paid: 'border-transparent bg-sky-500/20 text-sky-300',
};

export type BillingProject = {
    id: number;
    name: string;
    client?: { id: number; name: string } | null;
};

export type Installment = {
    amount: string;
    paidOn: string | null;
    method?: string | null;
    notes?: string | null;
};

export type PaymentLine = {
    id?: number;
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    discountPercent?: string | number;
    lineNet?: string;
    sortOrder?: number;
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
    lastPaymentDate?: string | null;
    reference: string | null;
    invoiceNumber: string | null;
    invoiceUrl: string | null;
    project?: BillingProject | null;
    notes?: string | null;
    externalSystem?: string | null;
    externalInvoiceId?: string | null;
    externalUrl?: string | null;
    storageProvider?: string | null;
    storageKey?: string | null;
    fileName?: string | null;
    installments?: Installment[];
    lines?: PaymentLine[];
    paidAmount?: string;
    remainingAmount?: string;
};

export type PaymentInput = {
    projectId?: number | null;
    baseAmount?: number | string;
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
    invoiceUrl?: string | null;
    fileName?: string | null;
    installments?: Installment[];
    lines?: PaymentLine[];
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
    paymentMethod?: string | null;
    expenseDate: string | null;
    paymentDate?: string | null;
    lastPaymentDate?: string | null;
    invoiceUrl: string | null;
    project?: BillingProject | null;
    notes?: string | null;
    storageProvider?: string | null;
    fileName?: string | null;
    installments?: Installment[];
    paidAmount?: string;
    remainingAmount?: string;
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
    installments?: Installment[];
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
    result?: string;
    grossIncome?: string;
    netIncome?: string;
    pending?: string;
    grossExpenses?: string;
    netExpenses?: string;
    payrollExpenses?: string;
    ivaCollected?: string;
    ivaPaid?: string;
    ivaBalance?: string;
    irpfPayable?: string;
    months?: Array<{
        month: number;
        gross: string;
        pending: string;
        payroll: string;
        expenses: string;
    }>;
};

/** total = base + base*iva/100 - base*irpf/100 */
export function calcTotal(base: number, ivaRate: number, irpfRate: number): number {
    return Math.round((base + (base * ivaRate) / 100 - (base * irpfRate) / 100) * 100) / 100;
}

/** Inverse: base = total / (1 + iva/100 - irpf/100) */
export function calcBaseFromTotal(total: number, ivaRate: number, irpfRate: number): number {
    const factor = 1 + ivaRate / 100 - irpfRate / 100;
    return factor !== 0 ? Math.round((total / factor) * 100) / 100 : 0;
}

/** lineNet = round(qty × unitPrice × (1 − dto%/100), 2) */
export function calcLineNet(quantity: number, unitPrice: number, discountPercent = 0): number {
    const gross = quantity * unitPrice;
    return Math.round(gross * (1 - discountPercent / 100) * 100) / 100;
}

export function sumLineNets(lines: PaymentLine[]): number {
    return lines.reduce((acc, line) => {
        const net = calcLineNet(
            Number(line.quantity) || 0,
            Number(line.unitPrice) || 0,
            Number(line.discountPercent) || 0,
        );
        return acc + net;
    }, 0);
}

export function emptyPaymentLine(): PaymentLine {
    return { description: '', quantity: '1', unitPrice: '', discountPercent: '0' };
}

export function formatMoney(value: string | number): string {
    const n = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
    }).format(n);
}

/** Drive share/view → embeddable /preview. Never returns relative/garbage (iframe would load our SPA). */
export function drivePreviewUrl(raw: string | null | undefined): string | null {
    const url = raw?.trim();
    if (!url || !/^https?:\/\//i.test(url)) return null;

    const resourcekey = url.match(/[?&]resourcekey=([^&]+)/i)?.[1];
    const fileId =
        url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];

    if (fileId) {
        const qs = resourcekey ? `?resourcekey=${encodeURIComponent(decodeURIComponent(resourcekey))}` : '';
        return `https://drive.google.com/file/d/${fileId}/preview${qs}`;
    }

    if (url.includes('drive.google.com') && /\/view(\?|$)/.test(url)) {
        return url.replace(/\/view(\?.*)?$/, '/preview');
    }

    if (url.includes('drive.google.com') || url.includes('docs.google.com') || /\.pdf(\?|#|$)/i.test(url)) {
        return url;
    }

    return null;
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

export function isPaymentIssued(status: LedgerStatus): boolean {
    return status !== 'draft';
}

export async function emitPayment(id: number): Promise<Payment> {
    return request<Payment>(`/api/payments/${id}/emit`, { method: 'POST' });
}

/** Download Dompdf invoice (draft or official) as a file. */
export async function downloadPaymentInvoice(id: number): Promise<void> {
    await ensureCsrf();
    const res = await fetch(`${getBaseUrl()}/api/payments/${id}/invoice`, {
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
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') ?? '';
    let filename = `factura-${id}.pdf`;
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

export const PAYROLL_STATUSES = ['pending', 'paid'] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];
export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
    pending: 'Pendiente',
    paid: 'Pagada',
};

export type Payroll = {
    id: number;
    employeeName: string;
    nif?: string | null;
    category?: string | null;
    month: number;
    year: number;
    baseSalary: string;
    netSalary: string;
    socialSecurityEmployer?: string | null;
    irpfRetained?: string | null;
    status: PayrollStatus;
    paymentDate?: string | null;
    invoiceUrl?: string | null;
    totalCost?: string;
};

export type PayrollInput = {
    employeeName: string;
    nif?: string | null;
    category?: string | null;
    month: number;
    year: number;
    baseSalary: number | string;
    netSalary: number | string;
    socialSecurityEmployer?: number | string | null;
    irpfRetained?: number | string | null;
    status: PayrollStatus;
    paymentDate?: string | null;
    invoiceUrl?: string | null;
};

export async function listPayrolls(
    params: {
        search?: string;
        page?: number;
        perPage?: number;
        year?: number;
    } = {},
    signal?: AbortSignal,
) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
    if (params.perPage) q.set('per_page', String(params.perPage));
    if (params.year) q.set('year', String(params.year));
    const qs = q.toString();
    return request<{ data: Payroll[]; meta: BillingMeta }>(`/api/payrolls${qs ? `?${qs}` : ''}`, { signal });
}

export async function createPayroll(body: PayrollInput): Promise<Payroll> {
    return request<Payroll>('/api/payrolls', { method: 'POST', body });
}

export async function updatePayroll(id: number, body: Partial<PayrollInput>): Promise<Payroll> {
    return request<Payroll>(`/api/payrolls/${id}`, {
        method: 'PUT',
        body,
    });
}

export async function deletePayroll(id: number): Promise<void> {
    await request<{ ok: boolean }>(`/api/payrolls/${id}`, {
        method: 'DELETE',
    });
}

export type InvoiceSettings = {
    id: number;
    name: string;
    taxId: string;
    address: string;
    postalCode: string;
    city: string;
    province: string | null;
    country: string;
    email: string;
    website: string | null;
    roleLabel: string | null;
    iban: string;
    bankName: string | null;
    numberPrefix: string;
    nextSequence: number;
};

export type InvoiceSettingsInput = {
    name: string;
    taxId: string;
    address: string;
    postalCode: string;
    city: string;
    province?: string | null;
    country: string;
    email: string;
    website?: string | null;
    roleLabel?: string | null;
    iban: string;
    bankName?: string | null;
    numberPrefix: string;
    nextSequence: number;
};

/** Resolve `{year}` in invoice number prefix (client preview). */
export function resolveInvoiceNumberPrefix(prefix: string, year = new Date().getFullYear()): string {
    return prefix.replaceAll('{year}', String(year));
}

export function previewNextInvoiceNumber(prefix: string, nextSequence: number): string {
    const seq = Number.isFinite(nextSequence) && nextSequence >= 1 ? Math.floor(nextSequence) : 1;
    return `${resolveInvoiceNumberPrefix(prefix)}${seq}`;
}

export async function getInvoiceSettings(): Promise<InvoiceSettings> {
    return request<InvoiceSettings>('/api/billing/invoice-settings');
}

export async function updateInvoiceSettings(body: InvoiceSettingsInput): Promise<InvoiceSettings> {
    return request<InvoiceSettings>('/api/billing/invoice-settings', {
        method: 'PUT',
        body,
    });
}
