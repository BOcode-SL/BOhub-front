import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { createTemplate, detectVariables, emailsErrorMessage, updateTemplate, type EmailTemplate } from '@/lib/emails';

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
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setError(null);
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

    function onHtmlChange(value: string) {
        setHtmlBody(value);
        setVariables(detectVariables(value, subject));
    }

    function onSubjectChange(value: string) {
        setSubject(value);
        setVariables(detectVariables(htmlBody, value));
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
        setSaving(true);
        setError(null);
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
            } else {
                await createTemplate(payload);
            }
            onSaved();
        } catch (err) {
            setError(emailsErrorMessage(err));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>{mode === 'edit' ? 'Editar plantilla' : 'Nueva plantilla'}</SheetTitle>
                    <SheetDescription>HTML con variables tipo [NOMBRE]. Sin WYSIWYG.</SheetDescription>
                </SheetHeader>

                <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="tpl-name">Nombre</Label>
                            <Input
                                id="tpl-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                maxLength={200}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="tpl-desc">Descripción</Label>
                            <Input
                                id="tpl-desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                maxLength={500}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="tpl-subject">Asunto</Label>
                            <Input
                                id="tpl-subject"
                                value={subject}
                                onChange={(e) => onSubjectChange(e.target.value)}
                                required
                                maxLength={200}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="tpl-html">HTML</Label>
                            <Textarea
                                id="tpl-html"
                                value={htmlBody}
                                onChange={(e) => onHtmlChange(e.target.value)}
                                className="min-h-[180px] font-mono text-xs"
                                required
                                maxLength={100000}
                            />
                        </div>
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
                        {htmlBody && (
                            <div className="space-y-1.5">
                                <Label>Preview</Label>
                                <iframe
                                    title="Preview plantilla"
                                    className="h-40 w-full rounded-md border border-border bg-white"
                                    srcDoc={htmlBody}
                                    sandbox=""
                                />
                            </div>
                        )}
                        {error && (
                            <p className="text-sm text-destructive" role="alert">
                                {error}
                            </p>
                        )}
                    </div>

                    <SheetFooter>
                        <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="cursor-pointer" disabled={saving}>
                            {saving ? 'Guardando…' : 'Guardar'}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
