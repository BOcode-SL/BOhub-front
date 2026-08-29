import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Paperclip, X } from 'lucide-react';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    FormPanel,
    FormPanelDescription,
    FormPanelFooter,
    FormPanelHeader,
    FormPanelTitle,
} from '@/components/responsive-form-panel';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import {
    MAX_ATTACHMENT_SIZE,
    MAX_ATTACHMENTS,
    sendEmail,
    substituteVars,
    fqdnEmailError,
    type EmailTemplate,
} from '@/lib/emails';
import { toastError, toastSuccess } from '@/lib/toast';
import { EmailHtmlPane } from '@/pages/emails/EmailHtmlPane';
import { cn } from '@/lib/utils';

type Props = {
    open: boolean;
    template: EmailTemplate | null;
    onOpenChange: (open: boolean) => void;
    onSent: () => void;
};

export function SendEmailSheet({ open, template, onOpenChange, onSent }: Props) {
    const [to, setTo] = useState('');
    const [cc, setCc] = useState('');
    const [subject, setSubject] = useState('');
    const [vars, setVars] = useState<Record<string, string>>({});
    const [schedule, setSchedule] = useState(false);
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!open || !template) return;
        setFieldErrors({});
        setTo('');
        setCc('');
        setSubject(template.subject);
        const init: Record<string, string> = {};
        for (const v of template.variables ?? []) init[v] = '';
        setVars(init);
        setSchedule(false);
        setDate('');
        setTime('');
        setFiles([]);
    }, [open, template]);

    const deferredVars = useDeferredValue(vars);
    const deferredSubject = useDeferredValue(subject);
    const previewHtml = useMemo(() => {
        if (!template?.htmlBody) return '';
        return substituteVars(template.htmlBody, deferredVars);
    }, [template, deferredVars]);
    const showPreview = Boolean(template?.htmlBody?.trim());

    function clearFieldError(key: string) {
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    function setVar(key: string, value: string) {
        setVars((prev) => ({ ...prev, [key]: value }));
        clearFieldError(key);
        clearFieldError('variables');
    }

    function addFiles(list: FileList | File[]) {
        const next = [...files];
        for (const f of Array.from(list)) {
            if (next.length >= MAX_ATTACHMENTS) {
                toastError(`Máximo ${MAX_ATTACHMENTS} adjuntos`);
                break;
            }
            if (f.size > MAX_ATTACHMENT_SIZE) {
                toastError(`«${f.name}» supera 10MB`);
                continue;
            }
            next.push(f);
        }
        setFiles(next);
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!template) return;

        const nextErrors: Record<string, string> = {};
        for (const v of template.variables ?? []) {
            if (!vars[v]?.trim()) nextErrors[v] = 'Requerido';
        }
        if (!to.trim()) nextErrors.to = 'Destinatario requerido';
        else {
            const toErr = fqdnEmailError(to);
            if (toErr) nextErrors.to = toErr;
        }
        const ccErr = fqdnEmailError(cc);
        if (ccErr) nextErrors.cc = ccErr;
        if (schedule) {
            if (!date) nextErrors.date = 'Fecha requerida';
            if (!time) nextErrors.time = 'Hora requerida';
            if (date && time) {
                const dt = new Date(`${date}T${time}`);
                if (Number.isNaN(dt.getTime()) || dt <= new Date()) {
                    nextErrors.scheduledAt = 'La fecha programada debe ser futura';
                }
            }
        }
        if (Object.keys(nextErrors).length) {
            setFieldErrors(nextErrors);
            return;
        }

        let scheduledAt: string | undefined;
        if (schedule) {
            scheduledAt = new Date(`${date}T${time}`).toISOString();
        }

        setSending(true);
        try {
            await sendEmail({
                templateId: template.id,
                to: to.trim(),
                cc: cc.trim() || undefined,
                subject: subject.trim(),
                variables: vars,
                scheduledAt,
                attachments: files,
            });
            toastSuccess(schedule ? 'Email programado' : 'Email enviado');
            onSent();
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) {
                const flat = flattenFieldErrors(err.fieldErrors);
                if (flat.variables && template.variables?.length) {
                    for (const v of template.variables) {
                        if (!vars[v]?.trim()) flat[v] = flat.variables;
                    }
                }
                setFieldErrors(flat);
            }
            toastError(err);
        } finally {
            setSending(false);
        }
    }

    return (
        <FormPanel
            open={open}
            onOpenChange={onOpenChange}
            contentClassName={cn(
                'flex w-full flex-col gap-0 p-0 transition-[max-width]',
                showPreview ? 'sm:max-w-[1200px]' : 'sm:max-w-lg',
            )}
        >
                <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
                    {showPreview ? (
                        <div className="order-2 flex max-h-[40vh] min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-t border-border p-3 md:order-1 md:max-h-none md:min-h-0 md:flex-1 md:border-t-0 md:border-r md:p-6">
                            <EmailHtmlPane
                                html={previewHtml}
                                subject={deferredSubject || template?.subject}
                                emptyLabel="Sin HTML en la plantilla"
                                className="h-full min-h-0 shadow-lg"
                            />
                        </div>
                    ) : null}
                    <div
                        className={cn(
                            'order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:order-2',
                            showPreview ? 'w-full md:w-[450px] md:flex-none md:shrink-0 lg:w-[500px]' : 'w-full',
                        )}
                    >
                        <FormPanelHeader>
                            <FormPanelTitle>Enviar: {template?.name}</FormPanelTitle>
                            <FormPanelDescription>Completa variables y destinatario. Opcional: programar y adjuntos.</FormPanelDescription>
                        </FormPanelHeader>

                        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="flex min-h-0 flex-1 flex-col">
                            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
                                <FormField id="send-to" label="Para" error={fieldErrors.to}>
                                    <Input
                                        id="send-to"
                                        type="email"
                                        maxLength={255}
                                        value={to}
                                        onChange={(e) => {
                                            setTo(e.target.value);
                                            clearFieldError('to');
                                        }}
                                        required
                                        aria-invalid={!!fieldErrors.to}
                                    />
                                </FormField>
                                <FormField id="send-cc" label="CC" error={fieldErrors.cc}>
                                    <Input
                                        id="send-cc"
                                        type="email"
                                        maxLength={255}
                                        value={cc}
                                        onChange={(e) => {
                                            setCc(e.target.value);
                                            clearFieldError('cc');
                                        }}
                                        aria-invalid={!!fieldErrors.cc}
                                    />
                                </FormField>
                                <FormField id="send-subject" label="Asunto" error={fieldErrors.subject}>
                                    <Input
                                        id="send-subject"
                                        maxLength={200}
                                        value={subject}
                                        onChange={(e) => {
                                            setSubject(e.target.value);
                                            clearFieldError('subject');
                                        }}
                                        required
                                        aria-invalid={!!fieldErrors.subject}
                                    />
                                </FormField>

                                {(template?.variables ?? []).map((v) => (
                                    <FormField key={v} id={`var-${v}`} label={`[${v}]`} error={fieldErrors[v]}>
                                        <Input
                                            id={`var-${v}`}
                                            value={vars[v] ?? ''}
                                            onChange={(e) => setVar(v, e.target.value)}
                                            required
                                            aria-invalid={!!fieldErrors[v]}
                                        />
                                    </FormField>
                                ))}

                                <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                                    <Label htmlFor="send-schedule" className="cursor-pointer">
                                        Programar envío
                                    </Label>
                                    <input
                                        id="send-schedule"
                                        type="checkbox"
                                        className="size-4 cursor-pointer accent-primary"
                                        checked={schedule}
                                        onChange={(e) => {
                                            setSchedule(e.target.checked);
                                            clearFieldError('date');
                                            clearFieldError('time');
                                            clearFieldError('scheduledAt');
                                        }}
                                    />
                                </div>
                                {schedule && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <FormField
                                            id="send-date"
                                            label="Fecha *"
                                            error={fieldErrors.date ?? fieldErrors.scheduledAt}
                                        >
                                            <Input
                                                id="send-date"
                                                type="date"
                                                required={schedule}
                                                value={date}
                                                onChange={(e) => {
                                                    setDate(e.target.value);
                                                    clearFieldError('date');
                                                    clearFieldError('scheduledAt');
                                                }}
                                                aria-invalid={!!(fieldErrors.date || fieldErrors.scheduledAt)}
                                            />
                                        </FormField>
                                        <FormField id="send-time" label="Hora *" error={fieldErrors.time}>
                                            <Input
                                                id="send-time"
                                                type="time"
                                                required={schedule}
                                                value={time}
                                                onChange={(e) => {
                                                    setTime(e.target.value);
                                                    clearFieldError('time');
                                                    clearFieldError('scheduledAt');
                                                }}
                                                aria-invalid={!!fieldErrors.time}
                                            />
                                        </FormField>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <Label>Adjuntos (máx {MAX_ATTACHMENTS} × 10MB)</Label>
                                    <div
                                        className={`rounded-md border border-dashed px-3 py-6 text-center text-sm transition-colors ${
                                            dragging ? 'border-primary bg-primary/5' : 'border-border text-muted-foreground'
                                        }`}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            setDragging(true);
                                        }}
                                        onDragLeave={() => setDragging(false)}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            setDragging(false);
                                            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
                                        }}
                                    >
                                        <Paperclip className="mx-auto mb-2 size-5 opacity-60" />
                                        <p>Arrastra archivos o</p>
                                        <label className="mt-1 inline-block cursor-pointer text-primary underline">
                                            selecciona
                                            <input
                                                type="file"
                                                className="sr-only"
                                                multiple
                                                onChange={(e) => {
                                                    if (e.target.files) addFiles(e.target.files);
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>
                                    </div>
                                    {files.length > 0 && (
                                        <ul className="space-y-1 text-xs">
                                            {files.map((f, i) => (
                                                <li
                                                    key={`${f.name}-${i}`}
                                                    className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1"
                                                >
                                                    <span className="truncate">
                                                        {f.name} ({Math.round(f.size / 1024)} KB)
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="cursor-pointer text-muted-foreground hover:text-foreground"
                                                        onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                                                        aria-label={`Quitar ${f.name}`}
                                                    >
                                                        <X className="size-3.5" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            <FormPanelFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="cursor-pointer"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button type="submit" className="cursor-pointer" disabled={sending}>
                                    {sending ? 'Enviando…' : schedule ? 'Programar' : 'Enviar ahora'}
                                </Button>
                            </FormPanelFooter>
                        </form>
                    </div>
                </div>
        </FormPanel>
    );
}
