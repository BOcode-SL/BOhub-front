import { request, requestFormData, apiErrorMessage, ensureCsrf, getBaseUrl, ApiError } from './api';
import type { EmailMessage, EmailTemplate } from './emails';

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

export type InvoiceMode = 'legal' | 'none';

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
    /** First payment line (+N). List column Concepto. */
    concept?: string | null;
    invoiceNumber: string | null;
    /** legal = factura; none = cobro sin factura */
    invoiceMode?: InvoiceMode;
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
    invoiceMode?: InvoiceMode;
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
    /** @deprecated Drive; no usar para preview */
    invoiceUrl: string | null;
    project?: BillingProject | null;
    notes?: string | null;
    storageProvider?: string | null;
    storageKey?: string | null;
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
    /** Multipart justificante (create required; update si no hay R2) */
    file?: File | null;
    installments?: Installment[];
};

/** True if expense has R2/local archive (not Drive stub). */
export function expenseHasStoredFile(
    e: Pick<Expense, 'storageKey' | 'storageProvider'> | null | undefined,
): boolean {
    if (!e?.storageKey?.trim()) return false;
    const p = e.storageProvider;
    return p === 'r2' || p === 'local';
}

function appendExpenseFields(fd: FormData, body: Partial<ExpenseInput> & Pick<ExpenseInput, 'description' | 'baseAmount' | 'status'> | ExpenseInput): void {
    if (body.projectId != null) {
        fd.append('projectId', String(body.projectId));
    }
    if (body.description !== undefined) fd.append('description', body.description);
    if (body.recipient !== undefined) fd.append('recipient', body.recipient ?? '');
    if (body.category !== undefined) fd.append('category', body.category ?? '');
    if (body.baseAmount !== undefined) fd.append('baseAmount', String(body.baseAmount));
    if (body.ivaRate !== undefined) fd.append('ivaRate', String(body.ivaRate));
    if (body.irpfRate !== undefined) fd.append('irpfRate', String(body.irpfRate));
    if (body.status !== undefined) fd.append('status', body.status);
    if (body.expenseDate !== undefined) fd.append('expenseDate', body.expenseDate ?? '');
    if (body.paymentDate !== undefined) fd.append('paymentDate', body.paymentDate ?? '');
    if (body.notes !== undefined) fd.append('notes', body.notes ?? '');
    if (body.installments) {
        body.installments.forEach((inst, i) => {
            fd.append(`installments[${i}][amount]`, String(inst.amount ?? ''));
            fd.append(`installments[${i}][paidOn]`, String(inst.paidOn ?? ''));
            if (inst.method) fd.append(`installments[${i}][method]`, inst.method);
            if (inst.notes) fd.append(`installments[${i}][notes]`, inst.notes);
        });
    }
    if (body.file) fd.append('file', body.file);
}

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

export type BillingExportItem = {
    id: number;
    label: string;
    date: string | null;
    totalAmount: string;
    invoiceNumber?: string | null;
    fileName: string | null;
    hasFile: boolean;
};

export type BillingExportPreview = {
    year: number;
    month: number;
    payments: BillingExportItem[];
    expenses: BillingExportItem[];
};

export async function previewBillingExport(
    params: { year: number; month: number },
    signal?: AbortSignal,
): Promise<BillingExportPreview> {
    const q = new URLSearchParams({
        year: String(params.year),
        month: String(params.month),
    });
    return request<BillingExportPreview>(`/api/billing/export/preview?${q}`, { signal });
}

/** POST export → download ZIP blob. */
export async function downloadBillingExport(body: {
    year: number;
    month: number;
    paymentIds: number[];
    expenseIds: number[];
    confirmed: true;
}): Promise<void> {
    await ensureCsrf();
    const xsrfMatch = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    const headers: Record<string, string> = {
        Accept: 'application/zip,application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };
    if (xsrfMatch?.[1]) {
        headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrfMatch[1]);
    }
    const res = await fetch(`${getBaseUrl()}/api/billing/export`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        let message = `Error ${res.status}`;
        let fieldErrors: Record<string, string[]> | undefined;
        try {
            const data = (await res.json()) as { message?: string; errors?: Record<string, string[]> };
            if (data.message) message = data.message;
            if (data.errors) fieldErrors = data.errors;
            if (fieldErrors) {
                const first = Object.values(fieldErrors)[0]?.[0];
                if (first) message = first;
            }
        } catch {
            /* ignore */
        }
        throw new ApiError(message, res.status, fieldErrors);
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') ?? '';
    let filename = `BOhub-gestoria-${body.year}-${String(body.month).padStart(2, '0')}.zip`;
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

export async function listPayments(
    params: {
        search?: string;
        page?: number;
        perPage?: number;
        status?: string;
        invoiceFilter?: string;
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
    if (params.invoiceFilter) q.set('invoice_filter', params.invoiceFilter);
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

/** True if payment has R2/local archive (not Drive stub). */
export function hasArchivedInvoice(
    p: Pick<Payment, 'storageKey' | 'storageProvider'> | null | undefined,
): boolean {
    if (!p?.storageKey?.trim()) return false;
    const provider = p.storageProvider;
    return provider === 'r2' || provider === 'local';
}

export async function emitPayment(id: number): Promise<Payment> {
    return request<Payment>(`/api/payments/${id}/emit`, { method: 'POST' });
}

/** Draft → pending without invoice number / PDF. */
export async function confirmPaymentWithoutInvoice(id: number): Promise<Payment> {
    return request<Payment>(`/api/payments/${id}/confirm-without-invoice`, { method: 'POST' });
}

export function isPaymentWithoutInvoice(
    p: Pick<Payment, 'invoiceMode'> | null | undefined,
): boolean {
    return p?.invoiceMode === 'none';
}

/** Attach / replace invoice file on R2 (non-draft only). */
export async function attachPaymentInvoice(id: number, file: File): Promise<Payment> {
    const fd = new FormData();
    fd.append('file', file);
    return requestFormData<Payment>(`/api/payments/${id}/attach-invoice`, fd);
}

/** Fetch invoice PDF/bytes (draft Dompdf or R2 archive). */
export async function fetchPaymentInvoiceBlob(id: number): Promise<Blob> {
    await ensureCsrf();
    const res = await fetch(`${getBaseUrl()}/api/payments/${id}/invoice`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            Accept: 'application/pdf,image/*,application/json',
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
    return res.blob();
}

/** Download Dompdf invoice (draft or official) as a file. */
export async function downloadPaymentInvoice(id: number): Promise<void> {
    await ensureCsrf();
    const res = await fetch(`${getBaseUrl()}/api/payments/${id}/invoice`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            Accept: 'application/pdf,image/*,application/json',
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

export const INVOICE_FILTERS = ['draft', 'issued', 'no_invoice', 'no_number'] as const;
export type InvoiceFilter = (typeof INVOICE_FILTERS)[number];

export const INVOICE_FILTER_LABELS: Record<InvoiceFilter, string> = {
    draft: 'Borrador',
    issued: 'Emitida',
    no_invoice: 'Sin factura',
    no_number: 'Sin número',
};

export type InvoiceSendPreview = {
    to: string;
    cc: string | null;
    subject: string;
    htmlPreview: string;
    templateId: number;
    variables: Record<string, string>;
};

export type InvoiceSendInput = {
    to?: string | null;
    cc?: string | null;
    variables?: Record<string, string>;
};

export async function previewInvoiceSend(id: number): Promise<InvoiceSendPreview> {
    return request<InvoiceSendPreview>(`/api/payments/${id}/invoice-send-preview`);
}

export async function sendInvoice(id: number, input: InvoiceSendInput = {}): Promise<EmailMessage> {
    return request<EmailMessage>(`/api/payments/${id}/send-invoice`, {
        method: 'POST',
        body: input,
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

export type ExpenseOcrDraft = {
    recipient: string | null;
    description: string | null;
    expenseDate: string | null;
    baseAmount: string | null;
    ivaRate: string | null;
    irpfRate: string | null;
    totalAmount: string | null;
    category: string | null;
    confidence: number | null;
    rawNotes: string | null;
};

export type ExpenseOcrPreview = {
    draft: ExpenseOcrDraft;
    fileMeta: { name: string; size: number; mime: string };
};

/** Vision OCR draft — does not create expense; front keeps File for create. */
export async function ocrExpensePreview(file: File): Promise<ExpenseOcrPreview> {
    const fd = new FormData();
    fd.append('file', file);
    return requestFormData<ExpenseOcrPreview>('/api/expenses/ocr-preview', fd);
}

export async function createExpense(body: ExpenseInput): Promise<Expense> {
    const fd = new FormData();
    appendExpenseFields(fd, body);
    if (!body.file) {
        throw new ApiError('Adjunta el justificante (PDF o imagen).', 422, {
            file: ['Adjunta el justificante (PDF o imagen).'],
        });
    }
    return requestFormData<Expense>('/api/expenses', fd);
}

export async function updateExpense(id: number, body: Partial<ExpenseInput>): Promise<Expense> {
    if (body.file) {
        const fd = new FormData();
        // Laravel method spoof — browsers/PHP multipart on PUT is unreliable
        fd.append('_method', 'PUT');
        appendExpenseFields(fd, {
            description: body.description ?? '',
            baseAmount: body.baseAmount ?? 0,
            status: body.status ?? 'pending',
            ...body,
        });
        return requestFormData<Expense>(`/api/expenses/${id}`, fd);
    }

    const { file: _file, ...json } = body;
    return request<Expense>(`/api/expenses/${id}`, {
        method: 'PUT',
        body: json,
    });
}

export async function fetchExpenseFileBlob(
    id: number,
    opts: { inline?: boolean } = {},
): Promise<Blob> {
    await ensureCsrf();
    const q = opts.inline ? '?inline=1' : '';
    const res = await fetch(`${getBaseUrl()}/api/expenses/${id}/file${q}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            Accept: 'application/pdf,image/*,application/json',
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
    return res.blob();
}

/** Download expense receipt from R2/local. */
export async function downloadExpenseFile(id: number, fallbackName = `gasto-${id}`): Promise<void> {
    const blob = await fetchExpenseFileBlob(id, { inline: false });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
    readyToEmit?: boolean;
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

export async function getInvoiceEmailTemplate(): Promise<EmailTemplate> {
    return request<EmailTemplate>('/api/billing/invoice-email-template');
}

export async function updateInvoiceEmailTemplate(input: {
    subject: string;
    htmlBody: string;
    description?: string | null;
}): Promise<EmailTemplate> {
    return request<EmailTemplate>('/api/billing/invoice-email-template', {
        method: 'PUT',
        body: input,
    });
}
