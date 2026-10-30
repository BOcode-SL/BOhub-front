import { useEffect, useState, type FormEvent } from 'react';
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
    NO_SPINNER_INPUT_CLASS,
    SUBSCRIPTION_BILLING_CYCLES,
    SUBSCRIPTION_BILLING_CYCLE_LABELS,
    SUBSCRIPTION_CATEGORIES,
    SUBSCRIPTION_CATEGORY_LABELS,
    type Subscription,
    type SubscriptionBillingCycle,
    type SubscriptionCategory,
    type SubscriptionInput,
} from '@/lib/subscriptions';
import { toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function emptyForm(): SubscriptionInput {
    const d = today();
    return {
        name: '',
        provider: '',
        category: 'domain',
        renewalPrice: null,
        currency: 'EUR',
        billingCycle: 'annual',
        autoRenew: false,
        renewsOn: d,
        expiresOn: d,
        notes: '',
        projectId: null,
        lastPaidAmount: null,
        lastPaidOn: null,
    };
}

function toForm(row: Subscription): SubscriptionInput {
    return {
        name: row.name,
        provider: row.provider ?? '',
        category: row.category,
        renewalPrice: row.renewalPrice != null ? Number(row.renewalPrice) : null,
        currency: row.currency || 'EUR',
        billingCycle: row.billingCycle,
        autoRenew: row.autoRenew,
        renewsOn: row.renewsOn,
        expiresOn: row.expiresOn || row.renewsOn,
        notes: row.notes ?? '',
        projectId: row.projectId ?? null,
        lastPaidAmount: row.lastPaidAmount != null ? Number(row.lastPaidAmount) : null,
        lastPaidOn: row.lastPaidOn ?? null,
    };
}

type Props = {
    open: boolean;
    mode: 'add' | 'edit';
    subscription: Subscription | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: SubscriptionInput) => Promise<void>;
};

export function SubscriptionSheet({ open, mode, subscription, onOpenChange, onSubmit }: Props) {
    const [form, setForm] = useState<SubscriptionInput>(emptyForm());
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
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
        if (mode !== 'edit' || !subscription) {
            setForm(emptyForm());
            return;
        }
        setForm(toForm(subscription));
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
        if (form.expiresOn && form.renewsOn && form.expiresOn < form.renewsOn) {
            setFieldErrors({ expiresOn: 'Caduca el debe ser ≥ Renueva el.' });
            return;
        }
        setSaving(true);
        try {
            await onSubmit({
                name: form.name.trim(),
                provider: form.provider?.trim() || null,
                category: form.category,
                renewalPrice: form.renewalPrice,
                currency: form.currency || 'EUR',
                billingCycle: form.billingCycle,
                autoRenew: !!form.autoRenew,
                renewsOn: form.renewsOn,
                expiresOn: form.expiresOn,
                notes: form.notes?.trim() || null,
                projectId: form.projectId || null,
                lastPaidAmount: form.lastPaidAmount,
                lastPaidOn: form.lastPaidOn || null,
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
        <FormPanel open={open} onOpenChange={onOpenChange} contentClassName="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
            <FormPanelHeader>
                <FormPanelTitle>{mode === 'add' ? 'Añadir suscripción' : 'Editar suscripción'}</FormPanelTitle>
                <FormPanelDescription>
                    Dominios, hosting, VPS, SaaS e IA. Alertas 90/60/30 días antes de renovar.
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

                <div className="grid grid-cols-2 gap-3">
                    <FormField id="s-price" label="Precio renovación" error={fieldErrors.renewalPrice}>
                        <Input
                            id="s-price"
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            value={form.renewalPrice ?? ''}
                            onChange={(e) =>
                                setField('renewalPrice', e.target.value === '' ? null : Number(e.target.value))
                            }
                            placeholder="0,00"
                            className={cn('bg-card', NO_SPINNER_INPUT_CLASS)}
                        />
                    </FormField>
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
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <FormField id="s-renews" label="Renueva el" error={fieldErrors.renewsOn}>
                        <Input
                            id="s-renews"
                            type="date"
                            required
                            value={form.renewsOn}
                            onChange={(e) => setField('renewsOn', e.target.value)}
                            placeholder="AAAA-MM-DD"
                            className="bg-card"
                        />
                    </FormField>
                    <FormField id="s-expires" label="Caduca el" error={fieldErrors.expiresOn}>
                        <Input
                            id="s-expires"
                            type="date"
                            required
                            value={form.expiresOn}
                            onChange={(e) => setField('expiresOn', e.target.value)}
                            min={form.renewsOn || undefined}
                            placeholder="AAAA-MM-DD"
                            className="bg-card"
                            aria-invalid={!!fieldErrors.expiresOn}
                        />
                    </FormField>
                </div>

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

                <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={!!form.autoRenew}
                        onChange={(e) => setField('autoRenew', e.target.checked)}
                    />
                    Auto-renovación
                </label>

                <div className="grid grid-cols-2 gap-3">
                    <FormField id="s-last-amt" label="Último pago (€)" error={fieldErrors.lastPaidAmount}>
                        <Input
                            id="s-last-amt"
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            value={form.lastPaidAmount ?? ''}
                            onChange={(e) =>
                                setField('lastPaidAmount', e.target.value === '' ? null : Number(e.target.value))
                            }
                            placeholder="0,00"
                            className={cn('bg-card', NO_SPINNER_INPUT_CLASS)}
                        />
                    </FormField>
                    <FormField id="s-last-on" label="Fecha último pago" error={fieldErrors.lastPaidOn}>
                        <Input
                            id="s-last-on"
                            type="date"
                            value={form.lastPaidOn ?? ''}
                            onChange={(e) => setField('lastPaidOn', e.target.value || null)}
                            placeholder="AAAA-MM-DD"
                            className="bg-card"
                        />
                    </FormField>
                </div>

                <FormField id="s-notes" label="Notas" error={fieldErrors.notes}>
                    <Textarea
                        id="s-notes"
                        value={form.notes ?? ''}
                        onChange={(e) => setField('notes', e.target.value)}
                        placeholder="Notas internas…"
                        className="min-h-20 bg-card"
                    />
                </FormField>
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
