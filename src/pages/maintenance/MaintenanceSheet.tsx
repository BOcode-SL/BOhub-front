import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
    MAINTENANCE_PERIODS,
    MAINTENANCE_PERIOD_LABELS,
    getMaintenance,
    maintenanceErrorMessage,
    suggestEndsOn,
    type MaintenanceInput,
    type MaintenancePeriod,
    type MaintenancePeriodKind,
} from '@/lib/maintenance';
import { getClient } from '@/lib/clients';
import { getProject, listProjectOptions } from '@/lib/projects';

const selectClass =
    'h-9 w-full cursor-pointer rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

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
    const [projects, setProjects] = useState<ProjectOpt[]>([]);
    const [clientLabel, setClientLabel] = useState('Elige un proyecto');
    const [endsTouched, setEndsTouched] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        void listProjectOptions().then((rows) => {
            if (!cancelled) setProjects(rows);
        });
        return () => {
            cancelled = true;
        };
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
        setError(null);
        setEndsTouched(false);
        if (mode !== 'edit' || !period) {
            setForm(emptyForm());
            return;
        }
        setForm(toForm(period));
        setEndsTouched(true); // edit: don't auto-overwrite existing ends
        if (period.notes !== undefined) return;
        let cancelled = false;
        void getMaintenance(period.id).then((full) => {
            if (!cancelled) setForm(toForm(full));
        });
        return () => {
            cancelled = true;
        };
    }, [open, mode, period]);

    function setPeriodOrStart(patch: Partial<Pick<MaintenanceInput, 'period' | 'startsOn'>>) {
        setForm((f) => {
            const next = { ...f, ...patch };
            if (!endsTouched) {
                next.endsOn = suggestEndsOn(next.startsOn, next.period);
            }
            return next;
        });
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!form.projectId) {
            setError('Selecciona un proyecto.');
            return;
        }
        setSaving(true);
        setError(null);
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
            setError(maintenanceErrorMessage(err));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>{mode === 'add' ? 'Añadir mantenimiento' : 'Editar mantenimiento'}</SheetTitle>
                    <SheetDescription>Mensual o anual. Contacto = datos del cliente. Renovar = nuevo periodo.</SheetDescription>
                </SheetHeader>

                <form
                    id="maintenance-form"
                    className="flex flex-1 flex-col gap-4 px-4 pb-4"
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
                        <Label htmlFor="m-project">Proyecto</Label>
                        <select
                            id="m-project"
                            required
                            value={form.projectId || ''}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    projectId: e.target.value ? Number(e.target.value) : 0,
                                }))
                            }
                            className={selectClass}
                            disabled={mode === 'edit'}
                        >
                            <option value="">Seleccionar…</option>
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid gap-2">
                        <Label>Cliente</Label>
                        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                            {clientLabel}
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="m-period">Periodo</Label>
                        <select
                            id="m-period"
                            value={form.period}
                            onChange={(e) =>
                                setPeriodOrStart({
                                    period: e.target.value as MaintenancePeriodKind,
                                })
                            }
                            className={selectClass}
                        >
                            {MAINTENANCE_PERIODS.map((p) => (
                                <option key={p} value={p}>
                                    {MAINTENANCE_PERIOD_LABELS[p]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="m-start">Inicio</Label>
                            <Input
                                id="m-start"
                                type="date"
                                required
                                value={form.startsOn}
                                onChange={(e) => setPeriodOrStart({ startsOn: e.target.value })}
                                className="bg-card"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="m-end">Fin</Label>
                            <Input
                                id="m-end"
                                type="date"
                                required
                                value={form.endsOn}
                                onChange={(e) => {
                                    setEndsTouched(true);
                                    setForm((f) => ({ ...f, endsOn: e.target.value }));
                                }}
                                min={form.startsOn || undefined}
                                className="bg-card"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="m-notes">Notas</Label>
                        <Textarea
                            id="m-notes"
                            value={form.notes ?? ''}
                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                            className="min-h-24 bg-card"
                        />
                    </div>
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
