import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AppSelect } from '@/components/app-select';
import { EntitySelect } from '@/components/entity-select';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    FormPanel,
    FormPanelDescription,
    FormPanelFooter,
    FormPanelHeader,
    FormPanelTitle,
} from '@/components/responsive-form-panel';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { listProjectOptions } from '@/lib/projects';
import {
    SUBSCRIPTION_BILLING_CYCLES,
    SUBSCRIPTION_BILLING_CYCLE_LABELS,
    SUBSCRIPTION_CATEGORIES,
    SUBSCRIPTION_CATEGORY_LABELS,
    createSubscriptionRenewal,
    deleteSubscriptionRenewal,
    getSubscription,
    type Subscription,
    type SubscriptionBillingCycle,
    type SubscriptionCategory,
    type SubscriptionInput,
    type SubscriptionRenewal,
} from '@/lib/subscriptions';
import { toastError, toastSuccess } from '@/lib/toast';

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function emptyForm(): SubscriptionInput {
    return {
        name: '',
        provider: '',
        category: 'domain',
        billingCycle: 'annual',
        autoRenew: false,
        expiresOn: today(),
        notes: '',
        projectId: null,
    };
}

function toForm(row: Subscription): SubscriptionInput {
    return {
        name: row.name,
        provider: row.provider ?? '',
        category: row.category,
        billingCycle: row.billingCycle,
        autoRenew: row.autoRenew,
        expiresOn: row.expiresOn || today(),
        notes: row.notes ?? '',
        projectId: row.projectId ?? null,
    };
}

type Props = {
    open: boolean;
    mode: 'add' | 'edit';
    subscription: Subscription | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: SubscriptionInput) => Promise<void>;
};

function formatRenewedOn(ymd: string): string {
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d) return ymd;
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        new Date(Date.UTC(y, m - 1, d)),
    );
}

export function SubscriptionSheet({ open, mode, subscription, onOpenChange, onSubmit }: Props) {
    const [form, setForm] = useState<SubscriptionInput>(emptyForm());
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
    const [saving, setSaving] = useState(false);
    const [renewals, setRenewals] = useState<SubscriptionRenewal[]>([]);
    const [renewalsLoading, setRenewalsLoading] = useState(false);
    const [newRenewedOn, setNewRenewedOn] = useState(today());
    const [addingRenewal, setAddingRenewal] = useState(false);
    const [deletingRenewalId, setDeletingRenewalId] = useState<number | null>(null);

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
        setRenewals([]);
        if (mode !== 'edit' || !subscription) {
            setForm(emptyForm());
            setNewRenewedOn(today());
            return;
        }
        setForm(toForm(subscription));
        setNewRenewedOn(today());

        const ac = new AbortController();
        setRenewalsLoading(true);
        void getSubscription(subscription.id, ac.signal)
            .then((detail) => {
                if (ac.signal.aborted) return;
                setForm(toForm(detail));
                setRenewals(detail.renewals ?? []);
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                toastError(err);
            })
            .finally(() => {
                if (!ac.signal.aborted) setRenewalsLoading(false);
            });
        return () => ac.abort();
    }, [open, mode, subscription]);

    function clearFieldError(key: string) {
        setFieldErrors((prev) => {
            if (!(key in prev)) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }

    function setField<K extends keyof SubscriptionInput>(key: K, value: SubscriptionInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
        clearFieldError(key);
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!form.name.trim()) {
            setFieldErrors({ name: 'Nombre obligatorio.' });
            return;
        }
        if (!form.expiresOn) {
            setFieldErrors({ expiresOn: 'Indica la fecha de caducidad.' });
            return;
        }
        setSaving(true);
        try {
            await onSubmit({
                name: form.name.trim(),
                provider: form.provider?.trim() || null,
                category: form.category,
                billingCycle: form.billingCycle,
                autoRenew: !!form.autoRenew,
                expiresOn: form.expiresOn,
                notes: form.notes?.trim() || null,
                projectId: form.projectId || null,
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

    async function handleAddRenewal() {
        if (!subscription || mode !== 'edit') return;
        if (!newRenewedOn) {
            toastError(new Error('Indica la fecha de renovación.'));
            return;
        }
        setAddingRenewal(true);
        try {
            const row = await createSubscriptionRenewal(subscription.id, {
                renewedOn: newRenewedOn,
            });
            setRenewals((prev) =>
                [...prev.filter((r) => r.id !== row.id), row].sort((a, b) =>
                    b.renewedOn.localeCompare(a.renewedOn),
                ),
            );
            toastSuccess('Renovación añadida');
        } catch (err) {
            toastError(err);
        } finally {
            setAddingRenewal(false);
        }
    }

    async function handleDeleteRenewal(id: number) {
        if (!subscription || mode !== 'edit') return;
        setDeletingRenewalId(id);
        try {
            await deleteSubscriptionRenewal(subscription.id, id);
            setRenewals((prev) => prev.filter((r) => r.id !== id));
            toastSuccess('Renovación eliminada');
        } catch (err) {
            toastError(err);
        } finally {
            setDeletingRenewalId(null);
        }
    }

    return (
        <FormPanel open={open} onOpenChange={onOpenChange} contentClassName="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
            <FormPanelHeader>
                <FormPanelTitle>{mode === 'add' ? 'Añadir suscripción' : 'Editar suscripción'}</FormPanelTitle>
                <FormPanelDescription>
                    Dominios, hosting, VPS, SaaS e IA. Alertas 90/60/30 días antes de caducar.
                    {form.autoRenew
                        ? ' Con auto-renovación, al caducar se registra el historial y se alarga la caducidad según el periodo.'
                        : ''}
                </FormPanelDescription>
            </FormPanelHeader>

            <form
                id="subscription-form"
                noValidate
                className="flex flex-1 flex-col gap-4 px-4 pb-4"
                onSubmit={(e) => void handleSubmit(e)}
            >
                <FormField id="s-name" label="Suscripción" error={fieldErrors.name}>
                    <Input
                        id="s-name"
                        required
                        value={form.name}
                        onChange={(e) => setField('name', e.target.value)}
                        placeholder="Ej. .COM Domain profit-lost.com"
                        className="bg-card"
                        aria-invalid={!!fieldErrors.name}
                    />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                    <FormField id="s-provider" label="Proveedor" error={fieldErrors.provider}>
                        <Input
                            id="s-provider"
                            value={form.provider ?? ''}
                            onChange={(e) => setField('provider', e.target.value)}
                            placeholder="Ej. Hostinger"
                            className="bg-card"
                        />
                    </FormField>
                    <FormField id="s-category" label="Categoría" error={fieldErrors.category}>
                        <AppSelect
                            id="s-category"
                            items={SUBSCRIPTION_CATEGORIES.map((c) => ({
                                label: SUBSCRIPTION_CATEGORY_LABELS[c],
                                value: c,
                            }))}
                            value={form.category}
                            onValueChange={(v) => setField('category', v as SubscriptionCategory)}
                            placeholder="Categoría"
                            className="w-full"
                        />
                    </FormField>
                </div>

                <FormField id="s-cycle" label="Periodo" error={fieldErrors.billingCycle}>
                    <AppSelect
                        id="s-cycle"
                        items={SUBSCRIPTION_BILLING_CYCLES.map((c) => ({
                            label: SUBSCRIPTION_BILLING_CYCLE_LABELS[c],
                            value: c,
                        }))}
                        value={form.billingCycle}
                        onValueChange={(v) => setField('billingCycle', v as SubscriptionBillingCycle)}
                        placeholder="Periodo"
                        className="w-full"
                    />
                </FormField>

                <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={!!form.autoRenew}
                        onChange={(e) => setField('autoRenew', e.target.checked)}
                    />
                    Auto-renovación
                </label>

                <FormField id="s-expires" label="Caduca el" error={fieldErrors.expiresOn}>
                    <Input
                        id="s-expires"
                        type="date"
                        required
                        value={form.expiresOn}
                        onChange={(e) => setField('expiresOn', e.target.value)}
                        placeholder="AAAA-MM-DD"
                        className="bg-card"
                        aria-invalid={!!fieldErrors.expiresOn}
                    />
                </FormField>

                <FormField id="s-project" label="Proyecto" error={fieldErrors.projectId}>
                    <EntitySelect
                        id="s-project"
                        value={form.projectId ?? null}
                        onValueChange={(id) => setField('projectId', id)}
                        items={projects}
                        placeholder="Seleccionar proyecto…"
                        allowClear
                    />
                </FormField>

                <FormField id="s-notes" label="Notas" error={fieldErrors.notes}>
                    <Textarea
                        id="s-notes"
                        value={form.notes ?? ''}
                        onChange={(e) => setField('notes', e.target.value)}
                        placeholder="Notas internas…"
                        className="min-h-20 bg-card"
                    />
                </FormField>

                {mode === 'edit' && subscription && (
                    <div className="space-y-3 border-t border-border pt-4">
                        <div className="flex items-baseline justify-between gap-2">
                            <h3 className="text-sm font-medium">Renovaciones</h3>
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {renewalsLoading ? '…' : `${renewals.length}`}
                            </span>
                        </div>

                        <div className="flex gap-2">
                            <Input
                                type="date"
                                value={newRenewedOn}
                                onChange={(e) => setNewRenewedOn(e.target.value)}
                                aria-label="Fecha renovación"
                                className="min-w-0 flex-1 bg-card"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="cursor-pointer shrink-0"
                                disabled={addingRenewal || renewalsLoading}
                                onClick={() => void handleAddRenewal()}
                                aria-label="Añadir renovación"
                            >
                                <Plus className="size-4" />
                            </Button>
                        </div>

                        {renewalsLoading ? (
                            <p className="text-sm text-muted-foreground">Cargando renovaciones…</p>
                        ) : renewals.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Sin renovaciones registradas todavía.
                            </p>
                        ) : (
                            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border">
                                {renewals.map((r) => (
                                    <li
                                        key={r.id}
                                        className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 last:border-b-0"
                                    >
                                        <p className="truncate text-sm">{formatRenewedOn(r.renewedOn)}</p>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            className="cursor-pointer text-muted-foreground hover:text-destructive"
                                            disabled={deletingRenewalId === r.id}
                                            onClick={() => void handleDeleteRenewal(r.id)}
                                            aria-label="Eliminar renovación"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </form>

            <FormPanelFooter className="border-t border-border px-4 py-3">
                <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
                    Cancelar
                </Button>
                <Button type="submit" form="subscription-form" className="cursor-pointer" disabled={saving}>
                    {saving ? 'Guardando…' : 'Guardar'}
                </Button>
            </FormPanelFooter>
        </FormPanel>
    );
}
