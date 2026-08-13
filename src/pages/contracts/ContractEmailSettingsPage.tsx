import { FilePen } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { ListPageShell } from '@/components/list-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { getContractEmailTemplate, updateContractEmailTemplate } from '@/lib/contracts';
import { detectVariables, substituteVars, type EmailTemplate } from '@/lib/emails';
import { toastError, toastSuccess } from '@/lib/toast';
import { ContractTabs } from '@/pages/contracts/ContractTabs';
import { EmailHtmlPane } from '@/pages/emails/EmailHtmlPane';

const TEMPLATE_NAME = 'Contrato — solicitud de firma';

const SAMPLE_EMAIL_VARS: Record<string, string> = {
    SIGNER_NAME: 'Ana Cliente',
    CONTRACT_TITLE: 'Contrato de servicios',
    CLIENT_NAME: 'Del Mar Para Ti',
    SIGN_URL: 'https://hub.bocode.es/sign/demo',
    EXPIRES_AT: '31/08/2026',
    DOCUMENT_COUNT: '2',
    SIGNER_COUNT: '2',
};

const EMAIL_VAR_KEYS = [
    'SIGNER_NAME',
    'CONTRACT_TITLE',
    'CLIENT_NAME',
    'SIGN_URL',
    'EXPIRES_AT',
    'DOCUMENT_COUNT',
    'SIGNER_COUNT',
] as const;

export function ContractEmailSettingsPage() {
    const [emailTpl, setEmailTpl] = useState<EmailTemplate | null>(null);
    const [emailDesc, setEmailDesc] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailHtml, setEmailHtml] = useState('');
    const [emailVars, setEmailVars] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const deferredHtml = useDeferredValue(emailHtml);
    const deferredSubject = useDeferredValue(emailSubject);
    const previewHtml = useMemo(() => substituteVars(deferredHtml, SAMPLE_EMAIL_VARS), [deferredHtml]);
    const previewSubject = useMemo(
        () => substituteVars(deferredSubject, SAMPLE_EMAIL_VARS),
        [deferredSubject],
    );

    useEffect(() => {
        const ac = new AbortController();
        setLoading(true);
        void getContractEmailTemplate(ac.signal)
            .then((tpl) => {
                setEmailTpl(tpl);
                setEmailDesc(tpl.description ?? '');
                setEmailSubject(tpl.subject);
                setEmailHtml(tpl.htmlBody ?? '');
                setEmailVars(tpl.variables ?? []);
            })
            .catch((err) => toastError(err))
            .finally(() => setLoading(false));
        return () => ac.abort();
    }, []);

    function clearError(key: string) {
        setErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    function onSubjectChange(value: string) {
        setEmailSubject(value);
        clearError('subject');
        setEmailVars(detectVariables(emailHtml, value));
    }

    function onHtmlChange(value: string) {
        setEmailHtml(value);
        clearError('htmlBody');
        setEmailVars(detectVariables(value, emailSubject));
    }

    async function onSave(e: FormEvent) {
        e.preventDefault();
        if (!emailSubject.trim()) {
            setErrors({ subject: 'El asunto es obligatorio.' });
            return;
        }
        if (!emailHtml.trim()) {
            setErrors({ htmlBody: 'El HTML es obligatorio.' });
            return;
        }
        setSaving(true);
        setErrors({});
        try {
            const saved = await updateContractEmailTemplate({
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
                setErrors(flattenFieldErrors(err.fieldErrors));
            }
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    return (
        <ListPageShell
            title="Plantilla email"
            description="Solicitud de firma SES. El nombre de la plantilla no se puede cambiar."
            icon={FilePen}
            above={<ContractTabs />}
        >
            {loading ? (
                <div className="grid gap-6">
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-[320px] w-full rounded-xl" />
                </div>
            ) : (
                <form className="grid w-full gap-6" noValidate onSubmit={(e) => void onSave(e)}>
                    <div className="grid gap-4 lg:grid-cols-2 lg:items-end">
                        <div className="grid gap-2">
                            <p className="text-sm font-medium text-foreground">Email al firmante</p>
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
                            <FormField id="contract-email-desc" label="Descripción" error={errors.description}>
                                <Input
                                    id="contract-email-desc"
                                    maxLength={500}
                                    value={emailDesc}
                                    onChange={(e) => {
                                        setEmailDesc(e.target.value);
                                        clearError('description');
                                    }}
                                    aria-invalid={!!errors.description}
                                />
                            </FormField>
                            <FormField id="contract-email-subject" label="Asunto" error={errors.subject}>
                                <Input
                                    id="contract-email-subject"
                                    required
                                    maxLength={200}
                                    value={emailSubject}
                                    onChange={(e) => onSubjectChange(e.target.value)}
                                    aria-invalid={!!errors.subject}
                                />
                            </FormField>
                        </div>
                    </div>

                    <div className="grid min-h-[320px] gap-6 lg:h-[800px] lg:max-h-[80vh] lg:grid-cols-2 lg:items-stretch">
                        <FormField
                            id="contract-email-html"
                            label="HTML"
                            error={errors.htmlBody}
                            className="flex h-full min-h-0 flex-col"
                        >
                            <Textarea
                                id="contract-email-html"
                                required
                                value={emailHtml}
                                onChange={(e) => onHtmlChange(e.target.value)}
                                className="min-h-[320px] flex-1 resize-none font-mono text-xs lg:min-h-0"
                                aria-invalid={!!errors.htmlBody}
                            />
                        </FormField>
                        <div className="flex min-h-[320px] min-w-0 flex-col lg:min-h-0">
                            <EmailHtmlPane
                                html={previewHtml}
                                subject={previewSubject}
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
                        <Button type="submit" disabled={saving} className="cursor-pointer">
                            {saving ? 'Guardando…' : 'Guardar plantilla'}
                        </Button>
                    </div>
                </form>
            )}
        </ListPageShell>
    );
}
