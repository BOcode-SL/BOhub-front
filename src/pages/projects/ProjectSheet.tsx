import { useEffect, useState, type FormEvent } from 'react';
import { AppSelect } from '@/components/app-select';
import { EntitySelect } from '@/components/entity-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
    const [clients, setClients] = useState<ClientOption[]>(clientOptionsProp ?? []);
    const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([]);
    const [jiraIssues, setJiraIssues] = useState<JiraIssue[]>([]);
    const [saving, setSaving] = useState(false);

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

    useEffect(() => {
        if (!open) return;

        if (mode !== 'edit' || !project) {
            setForm({
                ...emptyForm,
                clientId: defaultClientId ?? 0,
                jiraMode: 'create',
            });
            return;
        }

        setForm(toForm(project));

        if (project.description !== undefined) return;

        let cancelled = false;
        void getProject(project.id)
            .then((full) => {
                if (!cancelled) setForm(toForm(full));
            })
            .catch((err) => {
                if (!cancelled) toastError(err);
            });

        return () => {
            cancelled = true;
        };
    }, [open, mode, project, defaultClientId]);

    function setField<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!form.clientId) {
            toastError('Selecciona un cliente.');
            return;
        }
        if (mode === 'add' && !form.jiraProjectKey) {
            toastError('Selecciona un espacio de Jira.');
            return;
        }
        if (mode === 'add' && form.jiraMode === 'link' && !form.jiraIssueKey) {
            toastError('Selecciona un issue de Jira.');
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

                <form
                    id="project-form"
                    className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
                    onSubmit={(e) => void handleSubmit(e)}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="project-name">Nombre</Label>
                        <Input
                            id="project-name"
                            required
                            maxLength={255}
                            value={form.name}
                            onChange={(e) => setField('name', e.target.value)}
                            className="bg-card"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="project-client">Cliente</Label>
                        <EntitySelect
                            id="project-client"
                            value={form.clientId || null}
                            onValueChange={(id) => setField('clientId', id ?? 0)}
                            items={clients}
                            placeholder="Seleccionar…"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="project-type">Tipo</Label>
                        <AppSelect
                            id="project-type"
                            items={PROJECT_TYPES.map((type) => ({
                                label: PROJECT_TYPE_LABELS[type],
                                value: type,
                            }))}
                            value={form.type}
                            onValueChange={(value) => setField('type', value as ProjectType)}
                        />
                    </div>

                    {mode === 'edit' && project?.jiraLinked && (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="grid gap-1">
                                <span className="text-muted-foreground">Estado</span>
                                <p className="rounded-md border border-border bg-muted px-3 py-2">
                                    {PROJECT_STATUS_LABELS[form.status]} · Jira
                                </p>
                            </div>
                            <div className="grid gap-1">
                                <span className="text-muted-foreground">Prioridad</span>
                                <p className="rounded-md border border-border bg-muted px-3 py-2">
                                    {PROJECT_PRIORITY_LABELS[form.priority]} · Jira
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="project-color">Color</Label>
                        <div className="flex items-center gap-2">
                            <input
                                id="project-color"
                                type="color"
                                value={form.color || '#ccff00'}
                                onChange={(e) => setField('color', e.target.value)}
                                className="h-9 w-12 cursor-pointer rounded-md border border-border bg-card"
                            />
                            <Input
                                value={form.color || ''}
                                onChange={(e) => setField('color', e.target.value)}
                                className="bg-card font-mono text-sm"
                                maxLength={7}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="project-description">Descripción</Label>
                        <Textarea
                            id="project-description"
                            value={form.description ?? ''}
                            onChange={(e) => setField('description', e.target.value)}
                            rows={4}
                            className="bg-card"
                            placeholder={mode === 'add' ? 'Opcional' : undefined}
                        />
                    </div>

                    {mode === 'add' && (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="project-jira-space">Espacio</Label>
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
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label>Tarea Jira</Label>
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
                            </div>

                            {form.jiraMode === 'link' && (
                                <div className="grid gap-2">
                                    <Label htmlFor="project-jira-issue">Issue</Label>
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
                                    />
                                </div>
                            )}
                        </>
                    )}
                </form>

                <SheetFooter>
                    <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancelar
                    </Button>
                    <Button type="submit" form="project-form" className="cursor-pointer" disabled={saving}>
                        {saving ? 'Guardando…' : mode === 'add' ? 'Crear' : 'Guardar'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
