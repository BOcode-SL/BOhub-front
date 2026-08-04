import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { listClientOptions } from '@/lib/clients';
import {
    PROJECT_PRIORITIES,
    PROJECT_PRIORITY_LABELS,
    PROJECT_STATUSES,
    PROJECT_STATUS_LABELS,
    PROJECT_TYPES,
    PROJECT_TYPE_LABELS,
    getProject,
    projectErrorMessage,
    type Project,
    type ProjectInput,
    type ProjectPriority,
    type ProjectStatus,
    type ProjectType,
} from '@/lib/projects';

const selectClass =
    'h-9 w-full cursor-pointer rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

const emptyForm: ProjectInput = {
    clientId: 0,
    name: '',
    type: 'web',
    status: 'todo',
    priority: 'medium',
    color: '#ccff00',
    icon: '',
    description: '',
    startDate: '',
    endDate: '',
};

function toForm(p: Project): ProjectInput {
    return {
        clientId: p.clientId,
        name: p.name,
        type: p.type,
        status: p.status,
        priority: p.priority,
        color: p.color ?? '#ccff00',
        icon: p.icon ?? '',
        description: p.description ?? '',
        startDate: p.startDate ?? '',
        endDate: p.endDate ?? '',
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
    /** When parent already loaded options, skip fetch */
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
    const [error, setError] = useState<string | null>(null);
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
            .catch(() => {
                if (!cancelled) setClients([]);
            });
        return () => {
            cancelled = true;
        };
    }, [open, clientOptionsProp]);

    useEffect(() => {
        if (!open) return;
        setError(null);

        if (mode !== 'edit' || !project) {
            setForm({
                ...emptyForm,
                clientId: defaultClientId ?? 0,
            });
            return;
        }

        setForm(toForm(project));

        // list rows omit description/icon — hydrate only when missing
        if (project.description !== undefined) return;

        let cancelled = false;
        void getProject(project.id)
            .then((full) => {
                if (!cancelled) setForm(toForm(full));
            })
            .catch((err) => {
                if (!cancelled) setError(projectErrorMessage(err));
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
        setError(null);
        if (!form.clientId) {
            setError('Selecciona un cliente.');
            return;
        }
        setSaving(true);
        try {
            await onSubmit({
                clientId: form.clientId,
                name: form.name.trim(),
                type: form.type,
                status: form.status,
                priority: form.priority,
                color: form.color?.trim() || '#ccff00',
                icon: form.icon?.toString().trim() || null,
                description: form.description?.toString().trim() || null,
                startDate: form.startDate?.toString().trim() || null,
                endDate: form.endDate?.toString().trim() || null,
            });
            onOpenChange(false);
        } catch (err) {
            setError(projectErrorMessage(err));
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
                    {error && (
                        <p
                            role="alert"
                            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground"
                        >
                            {error}
                        </p>
                    )}

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
                        <select
                            id="project-client"
                            value={form.clientId || ''}
                            onChange={(e) => setField('clientId', Number(e.target.value))}
                            required
                            className={selectClass}
                        >
                            <option value="">Seleccionar…</option>
                            {clients.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="project-type">Tipo</Label>
                            <select
                                id="project-type"
                                value={form.type}
                                onChange={(e) => setField('type', e.target.value as ProjectType)}
                                className={selectClass}
                            >
                                {PROJECT_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                        {PROJECT_TYPE_LABELS[t]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="project-status">Estado</Label>
                            <select
                                id="project-status"
                                value={form.status}
                                onChange={(e) => setField('status', e.target.value as ProjectStatus)}
                                className={selectClass}
                            >
                                {PROJECT_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                        {PROJECT_STATUS_LABELS[s]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="project-priority">Prioridad</Label>
                            <select
                                id="project-priority"
                                value={form.priority}
                                onChange={(e) => setField('priority', e.target.value as ProjectPriority)}
                                className={selectClass}
                            >
                                {PROJECT_PRIORITIES.map((p) => (
                                    <option key={p} value={p}>
                                        {PROJECT_PRIORITY_LABELS[p]}
                                    </option>
                                ))}
                            </select>
                        </div>
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
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="project-icon">Icono (opcional)</Label>
                        <Input
                            id="project-icon"
                            maxLength={80}
                            value={form.icon ?? ''}
                            onChange={(e) => setField('icon', e.target.value)}
                            placeholder="p. ej. folder"
                            className="bg-card"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="project-start">Inicio</Label>
                            <Input
                                id="project-start"
                                type="date"
                                value={form.startDate ?? ''}
                                onChange={(e) => setField('startDate', e.target.value)}
                                className="bg-card"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="project-end">Fin</Label>
                            <Input
                                id="project-end"
                                type="date"
                                value={form.endDate ?? ''}
                                onChange={(e) => setField('endDate', e.target.value)}
                                min={form.startDate || undefined}
                                className="bg-card"
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
