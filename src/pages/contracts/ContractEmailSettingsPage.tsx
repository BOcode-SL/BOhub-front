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
import {
    getContractEmailTemplate,
    getContractPackEmailTemplate,
    updateContractEmailTemplate,
    updateContractPackEmailTemplate,
} from '@/lib/contracts';
import { detectVariables, substituteVars, type EmailTemplate } from '@/lib/emails';
import { toastError, toastSuccess } from '@/lib/toast';
import { ContractTabs } from '@/pages/contracts/ContractTabs';
import { EmailHtmlPane } from '@/pages/emails/EmailHtmlPane';

const INVITE_NAME = 'Contrato — solicitud de firma';
const PACK_NAME = 'Contrato — pack firmado';

const INVITE_SAMPLE: Record<string, string> = {
    SIGNER_NAME: 'Ana Cliente',
    CONTRACT_TITLE: 'Contrato de servicios',
    CLIENT_NAME: 'Del Mar Para Ti',
    SIGN_URL: 'https://hub.bocode.es/sign/demo',
    EXPIRES_AT: '31/08/2026',
    DOCUMENT_COUNT: '2',
    SIGNER_COUNT: '2',
};

const PACK_SAMPLE: Record<string, string> = {
    SIGNER_NAME: 'Ana Cliente',
    CONTRACT_TITLE: 'Contrato de servicios',
    CLIENT_NAME: 'Del Mar Para Ti',
    SIGNED_AT: '13/08/2026 13:40',
    DOCUMENT_COUNT: '2',
    SIGNER_COUNT: '2',
};

const INVITE_VARS = [
    'SIGNER_NAME',
    'CONTRACT_TITLE',
    'CLIENT_NAME',
    'SIGN_URL',
    'EXPIRES_AT',
    'DOCUMENT_COUNT',
    'SIGNER_COUNT',
] as const;

const PACK_VARS = [
    'SIGNER_NAME',
    'CONTRACT_TITLE',
    'CLIENT_NAME',
    'SIGNED_AT',
    'DOCUMENT_COUNT',
    'SIGNER_COUNT',
] as const;

type SaveFn = (input: {
    subject: string;
    htmlBody: string;
    description?: string | null;
}) => Promise<EmailTemplate>;

function LockedTemplateForm({
    heading,
    lockedName,
    varKeys,
    sampleVars,
    initial,
    onSave,
}: {
    heading: string;
    lockedName: string;
    varKeys: readonly string[];
    sampleVars: Record<string, string>;
    initial: EmailTemplate;
    onSave: SaveFn;
}) {
    const [tpl, setTpl] = useState(initial);
    const [desc, setDesc] = useState(initial.description ?? '');
    const [subject, setSubject] = useState(initial.subject);
    const [html, setHtml] = useState(initial.htmlBody ?? '');
    const [vars, setVars] = useState(initial.variables ?? []);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const deferredHtml = useDeferredValue(html);
    const deferredSubject = useDeferredValue(subject);
    const previewHtml = useMemo(() => substituteVars(deferredHtml, sampleVars), [deferredHtml, sampleVars]);
    const previewSubject = useMemo(
        () => substituteVars(deferredSubject, sampleVars),
        [deferredSubject, sampleVars],
    );

    function clearError(key: string) {
        setErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!subject.trim()) {
            setErrors({ subject: 'El asunto es obligatorio.' });
            return;
        }
        if (!html.trim()) {
            setErrors({ htmlBody: 'El HTML es obligatorio.' });
            return;
        }
        setSaving(true);
        setErrors({});
        try {
            const saved = await onSave({
                subject: subject.trim(),
                htmlBody: html,
                description: desc.trim() || null,
            });
            setTpl(saved);
            setDesc(saved.description ?? '');
            setSubject(saved.subject);
            setHtml(saved.htmlBody ?? '');
            setVars(saved.variables ?? []);
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

    const prefix = lockedName === PACK_NAME ? 'pack' : 'invite';

    return (
        <form className="grid w-full gap-6" noValidate onSubmit={(e) => void onSubmit(e)}>
            <div className="grid gap-4 lg:grid-cols-2 lg:items-end">
                <div className="grid gap-2">
                    <p className="text-sm font-medium text-foreground">{heading}</p>
                    <p className="text-xs text-muted-foreground">Plantilla: {tpl.name ?? lockedName}</p>
                    <div className="flex flex-wrap gap-1.5">
                        {varKeys.map((v) => (
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
                    <FormField id={`${prefix}-email-desc`} label="Descripción" error={errors.description}>
                        <Input
                            id={`${prefix}-email-desc`}
                            maxLength={500}
                            value={desc}
                            onChange={(e) => {
                                setDesc(e.target.value);
                                clearError('description');
                            }}
                            aria-invalid={!!errors.description}
                        />
                    </FormField>
                    <FormField id={`${prefix}-email-subject`} label="Asunto" error={errors.subject}>
                        <Input
                            id={`${prefix}-email-subject`}
                            required
                            maxLength={200}
                            value={subject}
                            onChange={(e) => {
                                setSubject(e.target.value);
                                clearError('subject');
                                setVars(detectVariables(html, e.target.value));
                            }}
                            aria-invalid={!!errors.subject}
                        />
                    </FormField>
                </div>
            </div>

            <div className="grid min-h-[320px] gap-6 lg:h-[800px] lg:max-h-[80vh] lg:grid-cols-2 lg:items-stretch">
                <FormField
                    id={`${prefix}-email-html`}
                    label="HTML"
                    error={errors.htmlBody}
                    className="flex h-full min-h-0 flex-col"
                >
                    <Textarea
                        id={`${prefix}-email-html`}
                        required
                        value={html}
                        onChange={(e) => {
                            setHtml(e.target.value);
                            clearError('htmlBody');
                            setVars(detectVariables(e.target.value, subject));
                        }}
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
                        {vars.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Ninguna</span>
                        ) : (
                            vars.map((v) => (
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
    );
}

export function ContractEmailSettingsPage() {
    const [invite, setInvite] = useState<EmailTemplate | null>(null);
    const [pack, setPack] = useState<EmailTemplate | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ac = new AbortController();
        setLoading(true);
        void Promise.all([getContractEmailTemplate(ac.signal), getContractPackEmailTemplate(ac.signal)])
            .then(([a, b]) => {
                setInvite(a);
                setPack(b);
            })
            .catch((err) => toastError(err))
            .finally(() => setLoading(false));
        return () => ac.abort();
    }, []);

    return (
        <ListPageShell
            title="Plantilla email"
            description="Solicitud de firma y pack firmado. El nombre de cada plantilla no se puede cambiar."
            icon={FilePen}
            above={<ContractTabs />}
        >
            {loading || !invite || !pack ? (
                <div className="grid gap-6">
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-[320px] w-full rounded-xl" />
                </div>
            ) : (
                <div className="grid gap-12">
                    <LockedTemplateForm
                        heading="Email al firmante"
                        lockedName={INVITE_NAME}
                        varKeys={INVITE_VARS}
                        sampleVars={INVITE_SAMPLE}
                        initial={invite}
                        onSave={updateContractEmailTemplate}
                    />
                    <LockedTemplateForm
                        heading="Pack firmado (adjunto PDF)"
                        lockedName={PACK_NAME}
                        varKeys={PACK_VARS}
                        sampleVars={PACK_SAMPLE}
                        initial={pack}
                        onSave={updateContractPackEmailTemplate}
                    />
                </div>
            )}
        </ListPageShell>
    );
}
