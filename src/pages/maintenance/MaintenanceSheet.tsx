import { useEffect, useState, type FormEvent } from 'react';
import { AppSelect } from '@/components/app-select';
import { EntitySelect } from '@/components/entity-select';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import {
    MAINTENANCE_PERIODS,
    MAINTENANCE_PERIOD_LABELS,
    suggestEndsOn,
    type MaintenanceInput,
    type MaintenancePeriod,
    type MaintenancePeriodKind,
} from '@/lib/maintenance';
import { toastError } from '@/lib/toast';
import { getClient } from '@/lib/clients';
import { getProject, listProjectOptions } from '@/lib/projects';

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function emptyForm(): MaintenanceInput {
    const startsOn = today();
    return {
        projectId: 0,
        period: 'annual',
        startsOn,
        endsOn: suggestEndsOn(startsOn, 'annual'),
        notes: '',
    };
}

function toForm(m: MaintenancePeriod): MaintenanceInput {
    return {
        projectId: m.projectId,
        period: m.period,
        startsOn: m.startsOn,
        endsOn: m.endsOn,
        notes: m.notes ?? '',
    };
}

type ProjectOpt = { id: number; name: string };

type Props = {
    open: boolean;
    mode: 'add' | 'edit';
    period: MaintenancePeriod | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: MaintenanceInput) => Promise<void>;
};

export function MaintenanceSheet({ open, mode, period, onOpenChange, onSubmit }: Props) {
    const [form, setForm] = useState<MaintenanceInput>(emptyForm());
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [projects, setProjects] = useState<ProjectOpt[]>([]);
    const [clientLabel, setClientLabel] = useState('Elige un proyecto');
    const [endsTouched, setEndsTouched] = useState(false);
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

    // ponytail: options cache has no client; getProject → getClient for email/phone
    useEffect(() => {
        if (!open || !form.projectId) {
            setClientLabel(form.projectId ? '—' : 'Elige un proyecto');
            return;
        }
        if (period?.projectId === form.projectId && period.client) {
            const c = period.client;
            setClientLabel([c.name, c.email, c.phone].filter(Boolean).join(' · ') || c.name);
            return;
        }
        let cancelled = false;
        void getProject(form.projectId)
            .then((p) => getClient(p.clientId))
            .then((c) => {
                if (!cancelled) {
                    setClientLabel([c.name, c.email, c.phone].filter(Boolean).join(' · ') || c.name);
                }
            })
            .catch(() => {
                if (!cancelled) setClientLabel('—');
            });
        return () => {
            cancelled = true;
        };
    }, [open, form.projectId, period]);

    useEffect(() => {
        if (!open) return;
        setFieldErrors({});
        setEndsTouched(false);
        if (mode !== 'edit' || !period) {
            setForm(emptyForm());
            return;
        }
        setForm(toForm(period));
        setEndsTouched(true);
    }, [open, mode, period]);

    function clearFieldError(key: string) {
        setFieldErrors((prev) => {
            if (!(key in prev)) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }

    function setField<K extends keyof MaintenanceInput>(key: K, value: MaintenanceInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
        clearFieldError(key);
    }

    function setPeriodOrStart(patch: Partial<Pick<MaintenanceInput, 'period' | 'startsOn'>>) {
        setForm((f) => {
            const next = { ...f, ...patch };
            if (!endsTouched) {
                next.endsOn = suggestEndsOn(next.startsOn, next.period);
            }
            return next;
        });
        for (const key of Object.keys(patch)) {
            clearFieldError(key);
        }
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!form.projectId) {
            setFieldErrors({ projectId: 'Selecciona un proyecto.' });
            return;
        }
        setSaving(true);
        try {
            await onSubmit({
                projectId: form.projectId,
                period: form.period,
                startsOn: form.startsOn,
                endsOn: form.endsOn,
                notes: form.notes?.trim() || null,
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
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>{mode === 'add' ? 'Añadir mantenimiento' : 'Editar mantenimiento'}</SheetTitle>
                    <SheetDescription>
                        {mode === 'add'
                            ? 'Mensual o anual. Al vencer sin cancelar se autorenueva y avisa a soporte.'
                            : 'Cambiar fechas o notas. Cancelar el periodo desde la lista (no se renovará).'}
                    </SheetDescription>
                </SheetHeader>

                <form
                    id="maintenance-form"
                    noValidate
                    className="flex flex-1 flex-col gap-4 px-4 pb-4"
                    onSubmit={(e) => void handleSubmit(e)}
                >
                    <FormField id="m-project" label="Proyecto" error={fieldErrors.projectId}>
                        <EntitySelect
                            id="m-project"
                            value={form.projectId || null}
                            onValueChange={(id) => setField('projectId', id ?? 0)}
                            items={projects}
                            placeholder="Seleccionar…"
                            disabled={mode === 'edit'}
                            aria-invalid={!!fieldErrors.projectId}
                        />
                    </FormField>

                    <FormField id="m-client" label="Cliente">
                        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                            {clientLabel}
                        </p>
                    </FormField>

                    <FormField id="m-period" label="Periodo" error={fieldErrors.period}>
                        <AppSelect
                            id="m-period"
                            items={MAINTENANCE_PERIODS.map((period) => ({
                                label: MAINTENANCE_PERIOD_LABELS[period],
                                value: period,
                            }))}
                            value={form.period}
                            onValueChange={(value) =>
                                setPeriodOrStart({
                                    period: value as MaintenancePeriodKind,
                                })
                            }
                            className="w-full"
                            aria-invalid={!!fieldErrors.period}
                        />
                    </FormField>

                    <div className="grid grid-cols-2 gap-3">
                        <FormField id="m-start" label="Inicio" error={fieldErrors.startsOn}>
                            <Input
                                id="m-start"
                                type="date"
                                required
                                value={form.startsOn}
                                onChange={(e) => setPeriodOrStart({ startsOn: e.target.value })}
                                className="bg-card"
                                aria-invalid={!!fieldErrors.startsOn}
                            />
                        </FormField>
                        <FormField id="m-end" label="Fin" error={fieldErrors.endsOn}>
                            <Input
                                id="m-end"
                                type="date"
                                required
                                value={form.endsOn}
                                onChange={(e) => {
                                    setEndsTouched(true);
                                    setField('endsOn', e.target.value);
                                }}
                                min={form.startsOn || undefined}
                                className="bg-card"
                                aria-invalid={!!fieldErrors.endsOn}
                            />
                        </FormField>
                    </div>

                    <FormField id="m-notes" label="Notas" error={fieldErrors.notes}>
                        <Textarea
                            id="m-notes"
                            value={form.notes ?? ''}
                            onChange={(e) => setField('notes', e.target.value)}
                            className="min-h-24 bg-card"
                            aria-invalid={!!fieldErrors.notes}
                        />
                    </FormField>
                </form>

                <SheetFooter className="border-t border-border px-4 py-3">
                    <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="maintenance-form" className="cursor-pointer" disabled={saving}>
                        {saving ? 'Guardando…' : 'Guardar'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
