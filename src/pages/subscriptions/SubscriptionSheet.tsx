import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
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
import { useAuth } from '@/auth/AuthContext';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { listProjectOptions } from '@/lib/projects';
import {
    SUBSCRIPTION_BILLING_CYCLES,
    SUBSCRIPTION_BILLING_CYCLE_LABELS,
    SUBSCRIPTION_CATEGORIES,
    SUBSCRIPTION_CATEGORY_LABELS,
    linkSubscriptionExpense,
    type Subscription,
    type SubscriptionBillingCycle,
    type SubscriptionCategory,
    type SubscriptionInput,
} from '@/lib/subscriptions';
import { toastError, toastSuccess } from '@/lib/toast';

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function emptyForm(): SubscriptionInput {
    return {
        name: '',
        resource: '',
        provider: '',
        category: 'domain',
        renewalPrice: null,
        currency: 'EUR',
        billingCycle: 'annual',
        autoRenew: false,
        renewsOn: today(),
        notes: '',
        projectId: null,
        lastPaidAmount: null,
        lastPaidOn: null,
    };
}

function toForm(row: Subscription): SubscriptionInput {
    return {
        name: row.name,
        resource: row.resource ?? '',
        provider: row.provider ?? '',
        category: row.category,
        renewalPrice: row.renewalPrice != null ? Number(row.renewalPrice) : null,
        currency: row.currency || 'EUR',
        billingCycle: row.billingCycle,
        autoRenew: row.autoRenew,
        renewsOn: row.renewsOn,
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
    onLinked?: (row: Subscription) => void;
};

export function SubscriptionSheet({ open, mode, subscription, onOpenChange, onSubmit, onLinked }: Props) {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [form, setForm] = useState<SubscriptionInput>(emptyForm());
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
    const [saving, setSaving] = useState(false);
    const [linking, setLinking] = useState(false);
    const [expenseIdInput, setExpenseIdInput] = useState('');

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
        setExpenseIdInput(subscription?.expenseId ? String(subscription.expenseId) : '');
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
        setSaving(true);
        try {
            await onSubmit({
                name: form.name.trim(),
                resource: form.resource?.trim() || null,
                provider: form.provider?.trim() || null,
                category: form.category,
                renewalPrice: form.renewalPrice,
                currency: form.currency || 'EUR',
                billingCycle: form.billingCycle,
                autoRenew: !!form.autoRenew,
                renewsOn: form.renewsOn,
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

    async function handleCreateExpense() {
        if (!subscription) return;
        setLinking(true);
        try {
            const updated = await linkSubscriptionExpense(subscription.id, { create: true });
            toastSuccess('Gasto creado y vinculado');
            onLinked?.(updated);
        } catch (err) {
            toastError(err);
        } finally {
            setLinking(false);
        }
    }

    async function handleLinkExpense() {
        if (!subscription) return;
        const id = Number(expenseIdInput);
        if (!Number.isFinite(id) || id < 1) {
            toastError(new Error('Indica un ID de gasto válido'));
            return;
        }
        setLinking(true);
        try {
            const updated = await linkSubscriptionExpense(subscription.id, { expenseId: id });
            toastSuccess('Gasto vinculado');
            onLinked?.(updated);
        } catch (err) {
            toastError(err);
        } finally {
            setLinking(false);
        }
    }

    return (
        <FormPanel open={open} onOpenChange={onOpenChange} contentClassName="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
            <FormPanelHeader>
                <FormPanelTitle>{mode === 'add' ? 'Añadir suscripción' : 'Editar suscripción'}</FormPanelTitle>
                <FormPanelDescription>
                    Dominios, hosting y SaaS. Alertas internas 90/60/30 días antes de renovar.
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
                        placeholder=".COM Domain, KVM 1…"
                        className="bg-card"
                        aria-invalid={!!fieldErrors.name}
                    />
                </FormField>

                <FormField id="s-resource" label="Recurso" error={fieldErrors.resource}>
                    <Input
                        id="s-resource"
                        value={form.resource ?? ''}
                        onChange={(e) => setField('resource', e.target.value)}
                        placeholder="dominio.com, srv…, app.bocode.es"
                        className="bg-card"
                    />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                    <FormField id="s-provider" label="Proveedor" error={fieldErrors.provider}>
                        <Input
                            id="s-provider"
                            value={form.provider ?? ''}
                            onChange={(e) => setField('provider', e.target.value)}
                            placeholder="Hostinger"
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
                            value={form.renewalPrice ?? ''}
                            onChange={(e) =>
                                setField('renewalPrice', e.target.value === '' ? null : Number(e.target.value))
                            }
                            className="bg-card"
                        />
                    </FormField>
                    <FormField id="s-cycle" label="Ciclo" error={fieldErrors.billingCycle}>
                        <AppSelect
                            id="s-cycle"
                            items={SUBSCRIPTION_BILLING_CYCLES.map((c) => ({
                                label: SUBSCRIPTION_BILLING_CYCLE_LABELS[c],
                                value: c,
                            }))}
                            value={form.billingCycle}
                            onValueChange={(v) => setField('billingCycle', v as SubscriptionBillingCycle)}
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
                            className="bg-card"
                        />
                    </FormField>
                    <FormField id="s-project" label="Proyecto" error={fieldErrors.projectId}>
                        <EntitySelect
                            id="s-project"
                            value={form.projectId}
                            onValueChange={(id) => setField('projectId', id)}
                            items={projects}
                            placeholder="Opcional"
                            allowClear
                        />
                    </FormField>
                </div>

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
                            value={form.lastPaidAmount ?? ''}
                            onChange={(e) =>
                                setField('lastPaidAmount', e.target.value === '' ? null : Number(e.target.value))
                            }
                            className="bg-card"
                        />
                    </FormField>
                    <FormField id="s-last-on" label="Fecha último pago" error={fieldErrors.lastPaidOn}>
                        <Input
                            id="s-last-on"
                            type="date"
                            value={form.lastPaidOn ?? ''}
                            onChange={(e) => setField('lastPaidOn', e.target.value || null)}
                            className="bg-card"
                        />
                    </FormField>
                </div>

                <FormField id="s-notes" label="Notas" error={fieldErrors.notes}>
                    <Textarea
                        id="s-notes"
                        value={form.notes ?? ''}
                        onChange={(e) => setField('notes', e.target.value)}
                        className="min-h-20 bg-card"
                    />
                </FormField>

                {mode === 'edit' && subscription && (
                    <div className="rounded-md border border-border p-3 space-y-2">
                        <p className="text-sm font-medium">Gasto (Facturación)</p>
                        {subscription.expenseId ? (
                            <p className="text-sm text-muted-foreground">
                                Vinculado:{' '}
                                {isAdmin ? (
                                    <Link
                                        to="/dashboard/billing/expenses"
                                        className="text-primary underline-offset-2 hover:underline"
                                    >
                                        #{subscription.expenseId}
                                        {subscription.expense?.description
                                            ? ` · ${subscription.expense.description}`
                                            : ''}
                                    </Link>
                                ) : (
                                    <span>#{subscription.expenseId}</span>
                                )}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">Sin gasto vinculado.</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            <Input
                                type="number"
                                min={1}
                                placeholder="ID gasto"
                                value={expenseIdInput}
                                onChange={(e) => setExpenseIdInput(e.target.value)}
                                className="h-8 w-28 bg-card"
                            />
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={linking}
                                onClick={() => void handleLinkExpense()}
                            >
                                Vincular
                            </Button>
                            {isAdmin && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={linking}
                                    onClick={() => void handleCreateExpense()}
                                >
                                    Crear gasto
                                </Button>
                            )}
                        </div>
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
