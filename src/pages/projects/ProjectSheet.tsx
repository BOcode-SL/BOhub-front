import { useEffect, useLayoutEffect, useState, type FormEvent } from 'react';
import { AppSelect } from '@/components/app-select';
import { EntitySelect } from '@/components/entity-select';
import { FormField } from '@/components/form-field';
import { FormFieldsSkeleton } from '@/components/form-fields-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { listClientOptions } from '@/lib/clients';
import { listJiraProjects, searchJiraIssues, type JiraIssue, type JiraProject } from '@/lib/jira';
import {
    PROJECT_PRIORITY_LABELS,
    PROJECT_STATUS_LABELS,
    PROJECT_TYPES,
    PROJECT_TYPE_LABELS,
    getProject,
    type Project,
    type ProjectInput,
    type ProjectType,
} from '@/lib/projects';
import { toastError } from '@/lib/toast';

/** Defaults aligned with Jira board: POR HACER + Medium */
const DEFAULT_STATUS = 'todo' as const;
const DEFAULT_PRIORITY = 'medium' as const;

const emptyForm: ProjectInput = {
    clientId: 0,
    name: '',
    type: 'web',
    status: DEFAULT_STATUS,
    priority: DEFAULT_PRIORITY,
    color: '#ccff00',
    description: '',
    jiraMode: 'create',
};

function toForm(p: Project): ProjectInput {
    return {
        clientId: p.clientId,
        name: p.name,
        type: p.type,
        status: p.status,
        priority: p.priority,
        color: p.color ?? '#ccff00',
        description: p.description ?? '',
    };
}

type ClientOption = { id: number; name: string };

type ProjectSheetProps = {
    open: boolean;
    mode: 'add' | 'edit';
    project: Project | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: ProjectInput) => Promise<void>;
    defaultClientId?: number;
    clientOptions?: ClientOption[];
};

export function ProjectSheet({
    open,
    mode,
    project,
    onOpenChange,
    onSubmit,
    defaultClientId,
    clientOptions: clientOptionsProp,
}: ProjectSheetProps) {
    const [form, setForm] = useState<ProjectInput>(emptyForm);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [clients, setClients] = useState<ClientOption[]>(clientOptionsProp ?? []);
    const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([]);
    const [jiraIssues, setJiraIssues] = useState<JiraIssue[]>([]);
    const [saving, setSaving] = useState(false);
    const [hydrating, setHydrating] = useState(false);

    useEffect(() => {
        if (clientOptionsProp) {
            setClients(clientOptionsProp);
            return;
        }
        if (!open) return;
        let cancelled = false;
        void listClientOptions()
            .then((rows) => {
                if (!cancelled) setClients(rows);
            })
            .catch((err) => {
                if (!cancelled) toastError(err);
            });
        return () => {
            cancelled = true;
        };
    }, [open, clientOptionsProp]);

    useEffect(() => {
        if (!open || mode !== 'add') return;
        const controller = new AbortController();
        void listJiraProjects(controller.signal)
            .then(setJiraProjects)
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                toastError(err);
            });
        return () => controller.abort();
    }, [open, mode]);

    // Asignar: load issues for selected space (empty q = recientes del espacio)
    useEffect(() => {
        if (!open || mode !== 'add' || form.jiraMode !== 'link' || !form.jiraProjectKey) {
            setJiraIssues([]);
            return;
        }
        const controller = new AbortController();
        void searchJiraIssues(form.jiraProjectKey, '', controller.signal)
            .then(setJiraIssues)
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                toastError(err);
            });
        return () => controller.abort();
    }, [open, mode, form.jiraMode, form.jiraProjectKey]);

    useLayoutEffect(() => {
        if (!open) return;

        setFieldErrors({});

        if (mode !== 'edit' || !project) {
            setHydrating(false);
            setForm({
                ...emptyForm,
                clientId: defaultClientId ?? 0,
                jiraMode: 'create',
            });
            return;
        }

        if (project.description !== undefined) {
            setHydrating(false);
            setForm(toForm(project));
            return;
        }

        setHydrating(true);
        setForm(emptyForm);
        let cancelled = false;
        void getProject(project.id)
            .then((full) => {
                if (!cancelled) setForm(toForm(full));
            })
            .catch((err) => {
                if (cancelled) return;
                toastError(err);
                onOpenChange(false);
            })
            .finally(() => {
                if (!cancelled) setHydrating(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, mode, project, defaultClientId]);

    function setField<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
        setFieldErrors((prev) => {
            if (!(key in prev)) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!form.clientId) {
            setFieldErrors({ clientId: 'Selecciona un cliente.' });
            return;
        }
        if (mode === 'add' && !form.jiraProjectKey) {
            setFieldErrors({ jiraProjectKey: 'Selecciona un espacio de Jira.' });
            return;
        }
        if (mode === 'add' && form.jiraMode === 'link' && !form.jiraIssueKey) {
            setFieldErrors({ jiraIssueKey: 'Selecciona un issue de Jira.' });
            return;
        }
        setSaving(true);
        try {
            if (mode === 'add') {
                await onSubmit({
                    clientId: form.clientId,
                    name: form.name.trim(),
                    type: form.type,
                    status: DEFAULT_STATUS,
                    priority: DEFAULT_PRIORITY,
                    color: form.color?.trim() || '#ccff00',
                    description: form.description?.toString().trim() || null,
                    icon: null,
                    startDate: null,
                    endDate: null,
                    jiraProjectKey: form.jiraProjectKey,
                    jiraMode: form.jiraMode ?? 'create',
                    jiraIssueKey: form.jiraMode === 'link' ? form.jiraIssueKey : null,
                });
            } else {
                await onSubmit({
                    clientId: form.clientId,
                    name: form.name.trim(),
                    type: form.type,
                    status: form.status,
                    priority: form.priority,
                    color: form.color?.trim() || '#ccff00',
                    description: form.description?.toString().trim() || null,
                });
            }
            onOpenChange(false);
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
            <SheetContent className="flex w-full flex-col sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>{mode === 'add' ? 'Añadir proyecto' : 'Editar proyecto'}</SheetTitle>
                    <SheetDescription>
                        {mode === 'add' ? 'Crea un proyecto ligado a un cliente.' : 'Actualiza los datos del proyecto.'}
                    </SheetDescription>
                </SheetHeader>

                {hydrating ? (
                    <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4">
                        <FormFieldsSkeleton fields={7} />
                    </div>
                ) : (
                <form
                    id="project-form"
                    noValidate
                    className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
                    onSubmit={(e) => void handleSubmit(e)}
                >
                    <FormField id="project-name" label="Nombre" error={fieldErrors.name}>
                        <Input
                            id="project-name"
                            required
                            maxLength={255}
                            value={form.name}
                            onChange={(e) => setField('name', e.target.value)}
                            className="bg-card"
                            aria-invalid={!!fieldErrors.name}
                        />
                    </FormField>

                    <FormField id="project-client" label="Cliente" error={fieldErrors.clientId}>
                        <EntitySelect
                            id="project-client"
                            value={form.clientId || null}
                            onValueChange={(id) => setField('clientId', id ?? 0)}
                            items={clients}
                            placeholder="Seleccionar…"
                            aria-invalid={!!fieldErrors.clientId}
                        />
                    </FormField>

                    <FormField id="project-type" label="Tipo" error={fieldErrors.type}>
                        <AppSelect
                            id="project-type"
                            items={PROJECT_TYPES.map((type) => ({
                                label: PROJECT_TYPE_LABELS[type],
                                value: type,
                            }))}
                            value={form.type}
                            onValueChange={(value) => setField('type', value as ProjectType)}
                            aria-invalid={!!fieldErrors.type}
                        />
                    </FormField>

                    {mode === 'edit' && project?.jiraLinked && (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="grid gap-1">
                                <span className="text-muted-foreground">Estado</span>
                                <p className="rounded-md border border-border bg-muted px-3 py-2">
                                    {PROJECT_STATUS_LABELS[form.status]}
                                </p>
                            </div>
                            <div className="grid gap-1">
                                <span className="text-muted-foreground">Prioridad</span>
                                <p className="rounded-md border border-border bg-muted px-3 py-2">
                                    {PROJECT_PRIORITY_LABELS[form.priority]}
                                </p>
                            </div>
                        </div>
                    )}

                    <FormField id="project-color" label="Color" error={fieldErrors.color}>
                        <div className="flex items-center gap-2">
                            <input
                                id="project-color"
                                type="color"
                                value={form.color || '#ccff00'}
                                onChange={(e) => setField('color', e.target.value)}
                                className="h-9 w-12 cursor-pointer rounded-md border border-border bg-card"
                                aria-invalid={!!fieldErrors.color}
                            />
                            <Input
                                value={form.color || ''}
                                onChange={(e) => setField('color', e.target.value)}
                                className="bg-card font-mono text-sm"
                                maxLength={7}
                                aria-invalid={!!fieldErrors.color}
                            />
                        </div>
                    </FormField>

                    <FormField id="project-description" label="Descripción" error={fieldErrors.description}>
                        <Textarea
                            id="project-description"
                            value={form.description ?? ''}
                            onChange={(e) => setField('description', e.target.value)}
                            rows={4}
                            className="bg-card"
                            placeholder={mode === 'add' ? 'Opcional' : undefined}
                            aria-invalid={!!fieldErrors.description}
                        />
                    </FormField>

                    {mode === 'add' && (
                        <>
                            <FormField id="project-jira-space" label="Espacio" error={fieldErrors.jiraProjectKey}>
                                <AppSelect
                                    id="project-jira-space"
                                    items={jiraProjects.map((space) => ({
                                        label: `${space.name} (${space.key})`,
                                        value: space.key,
                                    }))}
                                    value={form.jiraProjectKey ?? ''}
                                    onValueChange={(value) => {
                                        setField('jiraProjectKey', value ?? undefined);
                                        setField('jiraIssueKey', null);
                                    }}
                                    placeholder="Seleccionar espacio…"
                                    aria-invalid={!!fieldErrors.jiraProjectKey}
                                />
                            </FormField>

                            <FormField id="project-jira-mode" label="Tarea Jira" error={fieldErrors.jiraMode}>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        type="button"
                                        variant={form.jiraMode === 'create' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => {
                                            setField('jiraMode', 'create');
                                            setField('jiraIssueKey', null);
                                        }}
                                    >
                                        Crear
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={form.jiraMode === 'link' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setField('jiraMode', 'link')}
                                    >
                                        Asignar
                                    </Button>
                                </div>
                            </FormField>

                            {form.jiraMode === 'link' && (
                                <FormField id="project-jira-issue" label="Issue" error={fieldErrors.jiraIssueKey}>
                                    <AppSelect
                                        id="project-jira-issue"
                                        items={jiraIssues.map((issue) => ({
                                            label: `${issue.key} · ${issue.summary}`,
                                            value: issue.key,
                                        }))}
                                        value={form.jiraIssueKey ?? ''}
                                        onValueChange={(value) => setField('jiraIssueKey', value)}
                                        placeholder={
                                            form.jiraProjectKey
                                                ? 'Seleccionar issue…'
                                                : 'Elige un espacio primero'
                                        }
                                        disabled={!form.jiraProjectKey}
                                        aria-invalid={!!fieldErrors.jiraIssueKey}
                                    />
                                </FormField>
                            )}
                        </>
                    )}
                </form>
                )}

                <SheetFooter>
                    <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => onOpenChange(false)}
                        disabled={hydrating || saving}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="project-form"
                        className="cursor-pointer"
                        disabled={hydrating || saving}
                    >
                        {saving ? 'Guardando…' : mode === 'add' ? 'Crear' : 'Guardar'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
