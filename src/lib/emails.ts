import { request, requestFormData, apiErrorMessage } from './api';

export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const RESERVED_VARS = ['EMAIL', 'TO', 'CC'] as const;

export type EmailTemplate = {
    id: number;
    name: string;
    description?: string | null;
    subject: string;
    htmlBody?: string;
    variables: string[];
    createdBy?: number | null;
    createdAt?: string;
    updatedAt?: string;
};

export type EmailTemplateInput = {
    name: string;
    description?: string | null;
    subject: string;
    htmlBody: string;
    variables?: string[];
};

export type EmailAttachmentMeta = {
    filename: string;
    size: number;
    mimetype: string;
};

export type EmailMessageStatus = 'pending' | 'scheduled' | 'sent' | 'failed' | 'cancelled';

export type EmailMessage = {
    id: number;
    templateId?: number | null;
    templateName?: string | null;
    to: string;
    cc?: string | null;
    subject: string;
    htmlBody?: string;
    variables?: Record<string, string>;
    status: EmailMessageStatus;
    scheduledAt?: string | null;
    sentAt?: string | null;
    sentBy?: number | null;
    errorMessage?: string | null;
    attachments?: EmailAttachmentMeta[];
    attachmentCount?: number;
    hasAttachmentFiles?: boolean;
    createdAt?: string;
    updatedAt?: string;
};

export type PageMeta = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
};

type Paginated<T> = { data: T[]; meta: PageMeta };

export function detectVariables(...sources: string[]): string[] {
    const found = new Set<string>();
    const re = /\[([A-Z_][A-Z0-9_]*)\]/g;
    for (const src of sources) {
        for (const m of src.matchAll(re)) {
            const name = m[1];
            if (name && !(RESERVED_VARS as readonly string[]).includes(name)) {
                found.add(name);
            }
        }
    }
    return Array.from(found);
}

export function substituteVars(text: string, vars: Record<string, string>): string {
    let out = text;
    for (const [key, value] of Object.entries(vars)) {
        out = out.replaceAll(`[${key}]`, value);
    }
    return out;
}

export async function listTemplates(params: {
    page?: number;
    perPage?: number;
    q?: string;
    signal?: AbortSignal;
}): Promise<Paginated<EmailTemplate>> {
    const sp = new URLSearchParams();
    sp.set('page', String(params.page ?? 1));
    sp.set('per_page', String(params.perPage ?? 15));
    if (params.q) sp.set('q', params.q);
    return request(`/api/email-templates?${sp}`, {
        signal: params.signal,
    });
}

export async function getTemplate(id: number): Promise<EmailTemplate> {
    return request(`/api/email-templates/${id}`, {});
}

export async function createTemplate(input: EmailTemplateInput): Promise<EmailTemplate> {
    return request('/api/email-templates', {
        method: 'POST',
        body: input,
    });
}

export async function updateTemplate(id: number, input: EmailTemplateInput): Promise<EmailTemplate> {
    return request(`/api/email-templates/${id}`, {
        method: 'PUT',
        body: input,
    });
}

export async function deleteTemplate(id: number): Promise<void> {
    await request(`/api/email-templates/${id}`, {
        method: 'DELETE',
    });
}

export async function listMessages(params: {
    page?: number;
    perPage?: number;
    tab?: 'sent' | 'scheduled' | 'all';
    status?: string;
    signal?: AbortSignal;
}): Promise<Paginated<EmailMessage>> {
    const sp = new URLSearchParams();
    sp.set('page', String(params.page ?? 1));
    sp.set('per_page', String(params.perPage ?? 15));
    if (params.tab) sp.set('tab', params.tab);
    if (params.status) sp.set('status', params.status);
    return request(`/api/emails/messages?${sp}`, {
        signal: params.signal,
    });
}

export async function getMessage(id: number): Promise<EmailMessage> {
    return request(`/api/emails/messages/${id}`, {});
}

export async function updateScheduledMessage(
    id: number,
    input: {
        to?: string;
        cc?: string | null;
        subject?: string;
        scheduledAt?: string;
    },
): Promise<EmailMessage> {
    return request(`/api/emails/messages/${id}`, {
        method: 'PATCH',
        body: input,
    });
}

export async function cancelMessage(id: number): Promise<EmailMessage> {
    return request(`/api/emails/messages/${id}/cancel`, {
        method: 'POST',
    });
}

export type SendEmailInput = {
    templateId: number;
    to: string;
    cc?: string;
    subject?: string;
    variables: Record<string, string>;
    scheduledAt?: string;
    attachments?: File[];
};

export async function sendEmail(input: SendEmailInput): Promise<EmailMessage> {
    const fd = new FormData();
    fd.append('templateId', String(input.templateId));
    fd.append('to', input.to);
    if (input.cc) fd.append('cc', input.cc);
    if (input.subject) fd.append('subject', input.subject);
    fd.append('variables', JSON.stringify(input.variables));
    if (input.scheduledAt) fd.append('scheduledAt', input.scheduledAt);
    for (const file of input.attachments ?? []) {
        fd.append('attachments[]', file);
    }

    return requestFormData<EmailMessage>('/api/emails/send', fd);
}

export function emailsErrorMessage(err: unknown): string {
    return apiErrorMessage(err);
}

export const STATUS_LABELS: Record<EmailMessageStatus, string> = {
    pending: 'Pendiente',
    scheduled: 'Programado',
    sent: 'Enviado',
    failed: 'Fallido',
    cancelled: 'Cancelado',
};
