import { useDeferredValue, useEffect, useState, type FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { createTemplate, detectVariables, updateTemplate, type EmailTemplate } from '@/lib/emails';
import { toastError, toastSuccess } from '@/lib/toast';
import { EmailHtmlPane } from '@/pages/emails/EmailHtmlPane';
import { cn } from '@/lib/utils';

type Props = {
    open: boolean;
    mode: 'add' | 'edit';
    template: EmailTemplate | null;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
};

export function TemplateFormSheet({ open, mode, template, onOpenChange, onSaved }: Props) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [subject, setSubject] = useState('');
    const [htmlBody, setHtmlBody] = useState('');
    const [variables, setVariables] = useState<string[]>([]);
    const [manualVar, setManualVar] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const deferredHtml = useDeferredValue(htmlBody);
    const deferredSubject = useDeferredValue(subject);
    const showPreview = deferredHtml.trim().length > 0;

    useEffect(() => {
        if (!open) return;
        setFieldErrors({});
        if (mode === 'edit' && template) {
            setName(template.name);
            setDescription(template.description ?? '');
            setSubject(template.subject);
            setHtmlBody(template.htmlBody ?? '');
            setVariables(template.variables ?? []);
        } else {
            setName('');
            setDescription('');
            setSubject('');
            setHtmlBody('');
            setVariables([]);
        }
        setManualVar('');
    }, [open, mode, template]);

    function clearFieldError(key: string) {
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    function onHtmlChange(value: string) {
        setHtmlBody(value);
        setVariables(detectVariables(value, subject));
        clearFieldError('htmlBody');
    }

    function onSubjectChange(value: string) {
        setSubject(value);
        setVariables(detectVariables(htmlBody, value));
        clearFieldError('subject');
    }

    function addManualVar() {
        const v = manualVar
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9_]/g, '');
        if (!v || !/^[A-Z_][A-Z0-9_]*$/.test(v)) return;
        if (!variables.includes(v)) setVariables([...variables, v]);
        setManualVar('');
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!name.trim()) {
            setFieldErrors({ name: 'El nombre es obligatorio.' });
            return;
        }
        if (!subject.trim()) {
            setFieldErrors({ subject: 'El asunto es obligatorio.' });
            return;
        }
        if (!htmlBody.trim()) {
            setFieldErrors({ htmlBody: 'El HTML es obligatorio.' });
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name: name.trim(),
                description: description.trim() || null,
                subject: subject.trim(),
                htmlBody,
                variables,
            };
            if (mode === 'edit' && template) {
                await updateTemplate(template.id, payload);
                toastSuccess('Plantilla actualizada');
            } else {
                await createTemplate(payload);
                toastSuccess('Plantilla creada');
            }
            onSaved();
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) {
                setFieldErrors(flattenFieldErrors(err.fieldErrors));
            }
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                className={cn(
                    'flex w-full flex-col gap-0 p-0 transition-[max-width]',
                    showPreview
                        ? 'data-[side=right]:w-[95vw] data-[side=right]:sm:max-w-[1200px]'
                        : 'data-[side=right]:sm:max-w-lg',
                )}
            >
                <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
                    {showPreview ? (
                        <div className="flex min-h-[240px] min-w-0 flex-1 flex-col overflow-hidden border-b border-border p-4 md:min-h-0 md:border-r md:border-b-0 md:p-6">
                            <EmailHtmlPane html={deferredHtml} subject={deferredSubject} className="h-full shadow-lg" />
                        </div>
                    ) : null}
                    <div
                        className={cn(
                            'flex min-h-0 min-w-0 flex-col overflow-hidden',
                            showPreview ? 'w-full md:w-[450px] md:shrink-0 lg:w-[500px]' : 'w-full flex-1',
                        )}
                    >
                        <SheetHeader>
                            <SheetTitle>{mode === 'edit' ? 'Editar plantilla' : 'Nueva plantilla'}</SheetTitle>
                            <SheetDescription>HTML con variables.</SheetDescription>
                        </SheetHeader>

                        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="flex min-h-0 flex-1 flex-col">
                            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
                                <FormField id="tpl-name" label="Nombre" error={fieldErrors.name}>
                                    <Input
                                        id="tpl-name"
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value);
                                            clearFieldError('name');
                                        }}
                                        required
                                        maxLength={200}
                                        aria-invalid={!!fieldErrors.name}
                                    />
                                </FormField>
                                <FormField id="tpl-desc" label="Descripción" error={fieldErrors.description}>
                                    <Input
                                        id="tpl-desc"
                                        value={description}
                                        onChange={(e) => {
                                            setDescription(e.target.value);
                                            clearFieldError('description');
                                        }}
                                        maxLength={500}
                                        aria-invalid={!!fieldErrors.description}
                                    />
                                </FormField>
                                <FormField id="tpl-subject" label="Asunto" error={fieldErrors.subject}>
                                    <Input
                                        id="tpl-subject"
                                        value={subject}
                                        onChange={(e) => onSubjectChange(e.target.value)}
                                        required
                                        maxLength={200}
                                        aria-invalid={!!fieldErrors.subject}
                                    />
                                </FormField>
                                <FormField id="tpl-html" label="HTML" error={fieldErrors.htmlBody}>
                                    <Textarea
                                        id="tpl-html"
                                        value={htmlBody}
                                        onChange={(e) => onHtmlChange(e.target.value)}
                                        className="min-h-[180px] font-mono text-xs"
                                        required
                                        maxLength={100000}
                                        aria-invalid={!!fieldErrors.htmlBody}
                                    />
                                </FormField>
                                <div className="space-y-2">
                                    <Label>Variables</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {variables.length === 0 && (
                                            <span className="text-xs text-muted-foreground">Ninguna detectada</span>
                                        )}
                                        {variables.map((v) => (
                                            <button
                                                key={v}
                                                type="button"
                                                className="cursor-pointer rounded-md bg-muted px-2 py-0.5 text-xs text-foreground transition-colors hover:bg-destructive/20"
                                                onClick={() => setVariables(variables.filter((x) => x !== v))}
                                                title="Quitar"
                                            >
                                                [{v}] ×
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={manualVar}
                                            onChange={(e) => setManualVar(e.target.value.toUpperCase())}
                                            placeholder="AÑADIR_VAR"
                                            className="font-mono text-xs"
                                        />
                                        <Button type="button" variant="outline" className="cursor-pointer" onClick={addManualVar}>
                                            Añadir
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <SheetFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="cursor-pointer"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button type="submit" className="cursor-pointer" disabled={saving}>
                                    {saving ? 'Guardando…' : 'Guardar'}
                                </Button>
                            </SheetFooter>
                        </form>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
