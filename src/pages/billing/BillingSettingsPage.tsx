import { Building2 } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FormField } from '@/components/form-field';
import { ListPageShell } from '@/components/list-page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import {
    getInvoiceEmailTemplate,
    getInvoiceSettings,
    previewNextInvoiceNumber,
    updateInvoiceEmailTemplate,
    updateInvoiceSettings,
    type InvoiceSettingsInput,
} from '@/lib/billing';
import { detectVariables, substituteVars, type EmailTemplate } from '@/lib/emails';
import { toastError, toastSuccess } from '@/lib/toast';
import { BillingTabs } from '@/pages/billing/BillingTabs';
import { EmailHtmlPane } from '@/pages/emails/EmailHtmlPane';
import { cn } from '@/lib/utils';

const empty: InvoiceSettingsInput = {
    name: '',
    taxId: '',
    address: '',
    postalCode: '',
    city: '',
    province: '',
    country: 'España',
    email: '',
    website: '',
    roleLabel: '',
    iban: '',
    bankName: '',
    numberPrefix: '{year}-',
    nextSequence: 1,
};

const SAMPLE_EMAIL_VARS: Record<string, string> = {
    CLIENT_NAME: 'Cliente Ejemplo',
    INVOICE_NUMBER: '2026-18',
    INVOICE_DATE: '12/06/2026',
    TOTAL: '1.210,00 €',
    PROJECT_NAME: 'Proyecto Demo',
};

const EMAIL_VAR_KEYS = ['CLIENT_NAME', 'INVOICE_NUMBER', 'INVOICE_DATE', 'TOTAL', 'PROJECT_NAME'] as const;
const TEMPLATE_NAME = 'Factura — envío al cliente';

const SECTIONS = [
    { id: 'factura', label: 'Datos de factura' },
    { id: 'email', label: 'Email al cliente' },
] as const;

type Section = (typeof SECTIONS)[number]['id'];

function sectionFromSearch(searchParams: URLSearchParams): Section {
    return searchParams.get('section') === 'email' ? 'email' : 'factura';
}

function formFromSettings(
    s: InvoiceSettingsInput & {
        province?: string | null;
        website?: string | null;
        roleLabel?: string | null;
        bankName?: string | null;
    },
): InvoiceSettingsInput {
    return {
        name: s.name,
        taxId: s.taxId,
        address: s.address,
        postalCode: s.postalCode,
        city: s.city,
        province: s.province ?? '',
        country: s.country,
        email: s.email,
        website: s.website ?? '',
        roleLabel: s.roleLabel ?? '',
        iban: s.iban,
        bankName: s.bankName ?? '',
        numberPrefix: s.numberPrefix || '{year}-',
        nextSequence: s.nextSequence >= 1 ? s.nextSequence : 1,
    };
}

function SettingsSkeleton() {
    return (
        <div className="grid gap-6">
            <div className="flex flex-wrap gap-2">
                <Skeleton className="h-8 w-32 rounded-md" />
                <Skeleton className="h-8 w-28 rounded-md" />
            </div>
            <div className="grid w-full gap-6 xl:grid-cols-2">
                <Skeleton className="h-64 w-full rounded-xl" />
                <div className="grid gap-6">
                    <Skeleton className="h-36 w-full rounded-xl" />
                    <Skeleton className="h-48 w-full rounded-xl" />
                </div>
            </div>
        </div>
    );
}

export function BillingSettingsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const section = sectionFromSearch(searchParams);

    const [form, setForm] = useState<InvoiceSettingsInput>(empty);
    const [readyToEmit, setReadyToEmit] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const [emailTpl, setEmailTpl] = useState<EmailTemplate | null>(null);
    const [emailDesc, setEmailDesc] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailHtml, setEmailHtml] = useState('');
    const [emailVars, setEmailVars] = useState<string[]>([]);
    const [emailSaving, setEmailSaving] = useState(false);
    const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});

    const nextPreview = useMemo(
        () => previewNextInvoiceNumber(form.numberPrefix || '{year}-', Number(form.nextSequence) || 1),
        [form.numberPrefix, form.nextSequence],
    );

    const deferredHtml = useDeferredValue(emailHtml);
    const deferredSubject = useDeferredValue(emailSubject);
    const emailPreviewHtml = useMemo(
        () => substituteVars(deferredHtml, SAMPLE_EMAIL_VARS),
        [deferredHtml],
    );
    const emailPreviewSubject = useMemo(
        () => substituteVars(deferredSubject, SAMPLE_EMAIL_VARS),
        [deferredSubject],
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const [s, tpl] = await Promise.all([getInvoiceSettings(), getInvoiceEmailTemplate()]);
                if (cancelled) return;
                setForm(formFromSettings(s));
                setReadyToEmit(s.readyToEmit ?? true);
                setEmailTpl(tpl);
                setEmailDesc(tpl.description ?? '');
                setEmailSubject(tpl.subject);
                setEmailHtml(tpl.htmlBody ?? '');
                setEmailVars(tpl.variables ?? detectVariables(tpl.htmlBody ?? '', tpl.subject));
            } catch (err) {
                if (!cancelled) toastError(err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    function setSection(next: Section) {
        if (next === section) return;
        setSearchParams(next === 'factura' ? {} : { section: next }, { replace: true });
    }

    function clearFieldError(key: string) {
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    function setField<K extends keyof InvoiceSettingsInput>(key: K, value: InvoiceSettingsInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
        clearFieldError(String(key));
    }

    function clearEmailError(key: string) {
        setEmailErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    function onEmailHtmlChange(value: string) {
        setEmailHtml(value);
        setEmailVars(detectVariables(value, emailSubject));
        clearEmailError('htmlBody');
    }

    function onEmailSubjectChange(value: string) {
        setEmailSubject(value);
        setEmailVars(detectVariables(emailHtml, value));
        clearEmailError('subject');
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        setFieldErrors({});
        try {
            const saved = await updateInvoiceSettings({
                name: form.name.trim(),
                taxId: form.taxId.trim(),
                address: form.address.trim(),
                postalCode: form.postalCode.trim(),
                city: form.city.trim(),
                province: form.province?.toString().trim() || null,
                country: form.country.trim(),
                email: form.email.trim(),
                website: form.website?.toString().trim() || null,
                roleLabel: form.roleLabel?.toString().trim() || null,
                iban: form.iban.trim(),
                bankName: form.bankName?.toString().trim() || null,
                numberPrefix: form.numberPrefix.trim() || '{year}-',
                nextSequence: Math.max(1, Math.floor(Number(form.nextSequence) || 1)),
            });
            setForm(formFromSettings(saved));
            setReadyToEmit(saved.readyToEmit ?? true);
            toastSuccess('Configuración de factura guardada');
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) {
                setFieldErrors(flattenFieldErrors(err.fieldErrors));
            }
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    async function onSaveEmailTemplate(e: FormEvent) {
        e.preventDefault();
        if (!emailSubject.trim()) {
            setEmailErrors({ subject: 'El asunto es obligatorio.' });
            return;
        }
        if (!emailHtml.trim()) {
            setEmailErrors({ htmlBody: 'El HTML es obligatorio.' });
            return;
        }
        setEmailSaving(true);
        setEmailErrors({});
        try {
            const saved = await updateInvoiceEmailTemplate({
                subject: emailSubject.trim(),
                htmlBody: emailHtml,
                description: emailDesc.trim() || null,
            });
            setEmailTpl(saved);
            setEmailDesc(saved.description ?? '');
            setEmailSubject(saved.subject);
            setEmailHtml(saved.htmlBody ?? '');
            setEmailVars(saved.variables ?? []);
            toastSuccess('Plantilla de email guardada');
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) {
                setEmailErrors(flattenFieldErrors(err.fieldErrors));
            }
            toastError(err);
        } finally {
            setEmailSaving(false);
        }
    }

    return (
        <ListPageShell
            title="Configuración"
            description="Datos del emisor, IBAN, numeración y plantilla de email al cliente."
            icon={Building2}
            above={<BillingTabs />}
        >
            {loading ? (
                <SettingsSkeleton />
            ) : (
                <div className="grid gap-6">
                    <nav aria-label="Secciones de configuración" className="flex flex-wrap gap-2 border-b border-border pb-3">
                        {SECTIONS.map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                className={cn(
                                    'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                                    section === id
                                        ? 'bg-sidebar-accent font-medium text-primary'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                )}
                                onClick={() => setSection(id)}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>

                    {section === 'factura' ? (
                        <form
                            className="grid w-full gap-6 pb-20 xl:grid-cols-2 xl:items-start md:pb-0"
                            noValidate
                            onSubmit={(e) => void onSubmit(e)}
                        >
                            {!readyToEmit ? (
                                <p className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground xl:col-span-2">
                                    Completa emisor, banco y numeración para poder emitir facturas.
                                </p>
                            ) : null}

                            <Card className="gap-4 py-4">
                                <CardHeader className="px-4">
                                    <CardTitle>Emisor</CardTitle>
                                    <CardDescription>Aparece en el PDF como emisor</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-4 px-4 md:grid-cols-2">
                                    <FormField id="inv-name" label="Razón social" error={fieldErrors.name}>
                                        <Input
                                            id="inv-name"
                                            required
                                            value={form.name}
                                            onChange={(e) => setField('name', e.target.value)}
                                            aria-invalid={!!fieldErrors.name}
                                        />
                                    </FormField>
                                    <FormField id="inv-tax" label="NIF / CIF" error={fieldErrors.taxId}>
                                        <Input
                                            id="inv-tax"
                                            required
                                            value={form.taxId}
                                            onChange={(e) => setField('taxId', e.target.value)}
                                            aria-invalid={!!fieldErrors.taxId}
                                        />
                                    </FormField>
                                    <FormField id="inv-address" label="Dirección" error={fieldErrors.address} className="md:col-span-2">
                                        <Input
                                            id="inv-address"
                                            required
                                            value={form.address}
                                            onChange={(e) => setField('address', e.target.value)}
                                            aria-invalid={!!fieldErrors.address}
                                        />
                                    </FormField>
                                    <div className="grid gap-4 sm:grid-cols-3 md:col-span-2">
                                        <FormField id="inv-cp" label="CP" error={fieldErrors.postalCode}>
                                            <Input
                                                id="inv-cp"
                                                required
                                                value={form.postalCode}
                                                onChange={(e) => setField('postalCode', e.target.value)}
                                                aria-invalid={!!fieldErrors.postalCode}
                                            />
                                        </FormField>
                                        <FormField id="inv-city" label="Ciudad" error={fieldErrors.city}>
                                            <Input
                                                id="inv-city"
                                                required
                                                value={form.city}
                                                onChange={(e) => setField('city', e.target.value)}
                                                aria-invalid={!!fieldErrors.city}
                                            />
                                        </FormField>
                                        <FormField id="inv-province" label="Provincia" error={fieldErrors.province}>
                                            <Input
                                                id="inv-province"
                                                value={form.province ?? ''}
                                                onChange={(e) => setField('province', e.target.value)}
                                                aria-invalid={!!fieldErrors.province}
                                            />
                                        </FormField>
                                    </div>
                                    <FormField id="inv-country" label="País" error={fieldErrors.country}>
                                        <Input
                                            id="inv-country"
                                            required
                                            value={form.country}
                                            onChange={(e) => setField('country', e.target.value)}
                                            aria-invalid={!!fieldErrors.country}
                                        />
                                    </FormField>
                                    <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
                                        <FormField id="inv-email" label="Email" error={fieldErrors.email}>
                                            <Input
                                                id="inv-email"
                                                type="email"
                                                required
                                                value={form.email}
                                                onChange={(e) => setField('email', e.target.value)}
                                                aria-invalid={!!fieldErrors.email}
                                            />
                                        </FormField>
                                        <FormField id="inv-web" label="Website" error={fieldErrors.website}>
                                            <Input
                                                id="inv-web"
                                                value={form.website ?? ''}
                                                onChange={(e) => setField('website', e.target.value)}
                                                aria-invalid={!!fieldErrors.website}
                                            />
                                        </FormField>
                                    </div>
                                    <FormField id="inv-role" label="Etiqueta rol" error={fieldErrors.roleLabel} className="md:col-span-2">
                                        <Input
                                            id="inv-role"
                                            placeholder="DESARROLLADOR"
                                            value={form.roleLabel ?? ''}
                                            onChange={(e) => setField('roleLabel', e.target.value)}
                                            aria-invalid={!!fieldErrors.roleLabel}
                                        />
                                    </FormField>
                                </CardContent>
                            </Card>

                            <div className="grid gap-6">
                            <Card className="gap-4 py-4">
                                <CardHeader className="px-4">
                                    <CardTitle>Banco</CardTitle>
                                    <CardDescription>Datos de cobro en la factura</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-4 px-4">
                                    <FormField id="inv-iban" label="IBAN" error={fieldErrors.iban}>
                                        <Input
                                            id="inv-iban"
                                            required
                                            value={form.iban}
                                            onChange={(e) => setField('iban', e.target.value)}
                                            aria-invalid={!!fieldErrors.iban}
                                        />
                                    </FormField>
                                    <FormField id="inv-bank" label="Nombre del banco" error={fieldErrors.bankName}>
                                        <Input
                                            id="inv-bank"
                                            value={form.bankName ?? ''}
                                            onChange={(e) => setField('bankName', e.target.value)}
                                            aria-invalid={!!fieldErrors.bankName}
                                        />
                                    </FormField>
                                </CardContent>
                            </Card>

                            <Card className="gap-4 py-4">
                                <CardHeader className="px-4">
                                    <CardTitle>Numeración</CardTitle>
                                    <CardDescription>
                                        Usa <code className="rounded bg-muted px-1">{'{year}'}</code> en el prefijo (ej.{' '}
                                        <code className="rounded bg-muted px-1">{'{year}-'}</code> + 11 → {new Date().getFullYear()}
                                        -11).
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-4 px-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <FormField id="inv-prefix" label="Prefijo / patrón" error={fieldErrors.numberPrefix}>
                                            <Input
                                                id="inv-prefix"
                                                required
                                                placeholder="{year}-"
                                                value={form.numberPrefix}
                                                onChange={(e) => setField('numberPrefix', e.target.value)}
                                                aria-invalid={!!fieldErrors.numberPrefix}
                                            />
                                        </FormField>
                                        <FormField id="inv-next" label="Siguiente número" error={fieldErrors.nextSequence}>
                                            <Input
                                                id="inv-next"
                                                type="number"
                                                min={1}
                                                step={1}
                                                required
                                                value={form.nextSequence}
                                                onChange={(e) => setField('nextSequence', Number(e.target.value) || 1)}
                                                aria-invalid={!!fieldErrors.nextSequence}
                                            />
                                        </FormField>
                                    </div>
                                    <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
                                        <p className="text-xs text-muted-foreground">Próxima factura</p>
                                        <p className="font-mono text-lg font-medium text-foreground">{nextPreview}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            </div>

                            <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 p-4 backdrop-blur-sm md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none xl:col-span-2">
                                <Button type="submit" disabled={saving} className="w-full cursor-pointer md:w-auto">
                                    {saving ? 'Guardando…' : 'Guardar datos de factura'}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <form className="grid w-full gap-6" noValidate onSubmit={(e) => void onSaveEmailTemplate(e)}>
                            <div className="grid gap-4 lg:grid-cols-2 lg:items-end">
                                <div className="grid gap-2">
                                    <p className="text-sm font-medium text-foreground">Email al cliente</p>
                                    <p className="text-xs text-muted-foreground">
                                        Plantilla: {emailTpl?.name ?? TEMPLATE_NAME}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {EMAIL_VAR_KEYS.map((v) => (
                                            <span
                                                key={v}
                                                className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
                                            >
                                                [{v}]
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                    <FormField id="inv-email-desc" label="Descripción" error={emailErrors.description}>
                                        <Input
                                            id="inv-email-desc"
                                            maxLength={500}
                                            value={emailDesc}
                                            onChange={(e) => {
                                                setEmailDesc(e.target.value);
                                                clearEmailError('description');
                                            }}
                                            aria-invalid={!!emailErrors.description}
                                        />
                                    </FormField>
                                    <FormField id="inv-email-subject" label="Asunto" error={emailErrors.subject}>
                                        <Input
                                            id="inv-email-subject"
                                            required
                                            maxLength={200}
                                            value={emailSubject}
                                            onChange={(e) => onEmailSubjectChange(e.target.value)}
                                            aria-invalid={!!emailErrors.subject}
                                        />
                                    </FormField>
                                </div>
                            </div>

                            <div className="grid min-h-[320px] gap-6 lg:h-[800px] lg:max-h-[80vh] lg:grid-cols-2 lg:items-stretch">
                                <FormField
                                    id="inv-email-html"
                                    label="HTML"
                                    error={emailErrors.htmlBody}
                                    className="flex h-full min-h-0 flex-col"
                                >
                                    <Textarea
                                        id="inv-email-html"
                                        required
                                        value={emailHtml}
                                        onChange={(e) => onEmailHtmlChange(e.target.value)}
                                        className="min-h-[320px] flex-1 resize-none font-mono text-xs lg:min-h-0"
                                        aria-invalid={!!emailErrors.htmlBody}
                                    />
                                </FormField>
                                <div className="flex min-h-[320px] min-w-0 flex-col lg:min-h-0">
                                    <EmailHtmlPane
                                        html={emailPreviewHtml}
                                        subject={emailPreviewSubject}
                                        className="h-full min-h-0 flex-1 shadow-lg"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-end justify-between gap-4">
                                <div className="space-y-2">
                                    <Label>Variables detectadas</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {emailVars.length === 0 ? (
                                            <span className="text-xs text-muted-foreground">Ninguna</span>
                                        ) : (
                                            emailVars.map((v) => (
                                                <span
                                                    key={v}
                                                    className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
                                                >
                                                    [{v}]
                                                </span>
                                            ))
                                        )}
                                    </div>
                                </div>
                                <Button type="submit" disabled={emailSaving} className="cursor-pointer">
                                    {emailSaving ? 'Guardando…' : 'Guardar plantilla'}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </ListPageShell>
    );
}
