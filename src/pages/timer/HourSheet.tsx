import { useEffect, useState, type FormEvent } from 'react';
import { EntitySelect } from '@/components/entity-select';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    FormPanel,
    FormPanelDescription,
    FormPanelFooter,
    FormPanelHeader,
    FormPanelTitle,
} from '@/components/responsive-form-panel';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { listProjectOptions } from '@/lib/projects';
import { toastError } from '@/lib/toast';
import { type Hour, type HourInput } from '@/lib/timer';

type FormState = {
    projectId: number | '';
    hours: string;
    minutes: string;
    seconds: string;
    workedOn: string;
    description: string;
};

function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
}

function defaultAddForm(): FormState {
    return {
        projectId: '',
        hours: '0',
        minutes: '30',
        seconds: '0',
        workedOn: todayIsoDate(),
        description: '',
    };
}

function fromHour(h: Hour): FormState {
    const total = h.durationSeconds;
    return {
        projectId: h.projectId,
        hours: String(Math.floor(total / 3600)),
        minutes: String(Math.floor((total % 3600) / 60)),
        seconds: String(total % 60),
        workedOn: h.workedOn,
        description: h.description ?? '',
    };
}

type Props = {
    open: boolean;
    hour: Hour | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: Partial<HourInput>) => Promise<void>;
};

export function HourSheet({ open, hour, onOpenChange, onSubmit }: Props) {
    const isAdd = !hour;
    const [form, setForm] = useState<FormState>(defaultAddForm());
    const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        const ac = new AbortController();
        void listProjectOptions(ac.signal)
            .then((rows) => {
                if (!ac.signal.aborted) setProjects(rows);
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                toastError(err);
            });
        return () => ac.abort();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        setFieldErrors({});
        setForm(hour ? fromHour(hour) : defaultAddForm());
    }, [open, hour]);

    function clearFieldError(key: string) {
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
        if (key === 'hours' || key === 'minutes' || key === 'seconds') clearFieldError('duration');
        else clearFieldError(key);
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const nextErrors: Record<string, string> = {};
        if (!form.projectId) nextErrors.projectId = 'Selecciona un proyecto.';
        const duration =
            (Number(form.hours) || 0) * 3600 + (Number(form.minutes) || 0) * 60 + (Number(form.seconds) || 0);
        if (duration < 1) nextErrors.duration = 'La duración debe ser mayor que 0.';
        if (!form.workedOn) nextErrors.workedOn = 'La fecha es obligatoria.';
        if (Object.keys(nextErrors).length) {
            setFieldErrors(nextErrors);
            return;
        }
        setSaving(true);
        try {
            await onSubmit({
                projectId: Number(form.projectId),
                hours: Number(form.hours) || 0,
                minutes: Number(form.minutes) || 0,
                seconds: Number(form.seconds) || 0,
                workedOn: form.workedOn,
                description: form.description.trim() || null,
            });
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
        <FormPanel open={open} onOpenChange={onOpenChange} contentClassName="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
                <FormPanelHeader>
                    <FormPanelTitle>{isAdd ? 'Añadir horas' : 'Editar horas'}</FormPanelTitle>
                    <FormPanelDescription>
                        {isAdd ? 'Alta manual de tiempo.' : (hour?.project?.name ?? 'Entrada de tiempo')}
                    </FormPanelDescription>
                </FormPanelHeader>

                <form
                    id="hour-form"
                    noValidate
                    className="flex flex-1 flex-col gap-4 px-4 pb-4"
                    onSubmit={(e) => void handleSubmit(e)}
                >
                    <FormField id="hour-project" label="Proyecto" error={fieldErrors.projectId}>
                        <EntitySelect
                            id="hour-project"
                            items={projects}
                            value={form.projectId || null}
                            onValueChange={(value) => setField('projectId', value ?? '')}
                            placeholder="Seleccionar…"
                            aria-invalid={!!fieldErrors.projectId}
                        />
                    </FormField>
                    <FormField id="hour-duration" label="Duración" error={fieldErrors.duration}>
                        <div className={isAdd ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'}>
                            <Input
                                id="hour-hours"
                                type="number"
                                min={0}
                                max={24}
                                value={form.hours}
                                onChange={(e) => setField('hours', e.target.value)}
                                className="bg-card"
                                aria-label="Horas"
                                aria-invalid={!!fieldErrors.duration}
                            />
                            <Input
                                id="hour-minutes"
                                type="number"
                                min={0}
                                max={59}
                                value={form.minutes}
                                onChange={(e) => setField('minutes', e.target.value)}
                                className="bg-card"
                                aria-label="Minutos"
                                aria-invalid={!!fieldErrors.duration}
                            />
                            {isAdd ? (
                                <Input
                                    id="hour-seconds"
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={form.seconds}
                                    onChange={(e) => setField('seconds', e.target.value)}
                                    className="bg-card"
                                    aria-label="Segundos"
                                    aria-invalid={!!fieldErrors.duration}
                                />
                            ) : null}
                        </div>
                    </FormField>
                    <FormField id="hour-date" label="Fecha" error={fieldErrors.workedOn}>
                        <Input
                            id="hour-date"
                            type="date"
                            value={form.workedOn}
                            onChange={(e) => setField('workedOn', e.target.value)}
                            className="bg-card"
                            aria-invalid={!!fieldErrors.workedOn}
                        />
                    </FormField>
                    <FormField id="hour-desc" label="Descripción" error={fieldErrors.description}>
                        <Input
                            id="hour-desc"
                            value={form.description}
                            onChange={(e) => setField('description', e.target.value)}
                            className="bg-card"
                            aria-invalid={!!fieldErrors.description}
                        />
                    </FormField>
                </form>

                <FormPanelFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="hour-form" disabled={saving}>
                        {saving ? 'Guardando…' : 'Guardar'}
                    </Button>
                </FormPanelFooter>
        </FormPanel>
    );
}
