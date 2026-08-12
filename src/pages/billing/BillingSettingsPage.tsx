import { Building2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { ListPageShell } from '@/components/list-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import {
    getInvoiceSettings,
    previewNextInvoiceNumber,
    updateInvoiceSettings,
    type InvoiceSettingsInput,
} from '@/lib/billing';
import { toastError, toastSuccess } from '@/lib/toast';
import { BillingTabs } from '@/pages/billing/BillingTabs';

const empty: InvoiceSettingsInput = {
    name: '',
    taxId: '',
    address: '',
    postalCode: '',
    city: '',
    province: '',
    country: 'España',
    email: '',
    website: '',
    roleLabel: '',
    iban: '',
    bankName: '',
    numberPrefix: '{year}-',
    nextSequence: 1,
};

function formFromSettings(s: InvoiceSettingsInput & { province?: string | null; website?: string | null; roleLabel?: string | null; bankName?: string | null }): InvoiceSettingsInput {
    return {
        name: s.name,
        taxId: s.taxId,
        address: s.address,
        postalCode: s.postalCode,
        city: s.city,
        province: s.province ?? '',
        country: s.country,
        email: s.email,
        website: s.website ?? '',
        roleLabel: s.roleLabel ?? '',
        iban: s.iban,
        bankName: s.bankName ?? '',
        numberPrefix: s.numberPrefix || '{year}-',
        nextSequence: s.nextSequence >= 1 ? s.nextSequence : 1,
    };
}

export function BillingSettingsPage() {
    const [form, setForm] = useState<InvoiceSettingsInput>(empty);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const nextPreview = useMemo(
        () => previewNextInvoiceNumber(form.numberPrefix || '{year}-', Number(form.nextSequence) || 1),
        [form.numberPrefix, form.nextSequence],
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const s = await getInvoiceSettings();
                if (cancelled) return;
                setForm(formFromSettings(s));
            } catch (err) {
                if (!cancelled) toastError(err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    function clearFieldError(key: string) {
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    function setField<K extends keyof InvoiceSettingsInput>(key: K, value: InvoiceSettingsInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
        clearFieldError(String(key));
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        setFieldErrors({});
        try {
            const saved = await updateInvoiceSettings({
                name: form.name.trim(),
                taxId: form.taxId.trim(),
                address: form.address.trim(),
                postalCode: form.postalCode.trim(),
                city: form.city.trim(),
                province: form.province?.toString().trim() || null,
                country: form.country.trim(),
                email: form.email.trim(),
                website: form.website?.toString().trim() || null,
                roleLabel: form.roleLabel?.toString().trim() || null,
                iban: form.iban.trim(),
                bankName: form.bankName?.toString().trim() || null,
                numberPrefix: form.numberPrefix.trim() || '{year}-',
                nextSequence: Math.max(1, Math.floor(Number(form.nextSequence) || 1)),
            });
            setForm(formFromSettings(saved));
            toastSuccess('Configuración de factura guardada');
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
        <ListPageShell
            title="Configuración"
            description="Datos del emisor, IBAN y numeración de facturas."
            icon={Building2}
            above={<BillingTabs />}
        >
            {loading ? (
                <div className="grid gap-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            ) : (
                <form className="grid max-w-2xl gap-6" noValidate onSubmit={(e) => void onSubmit(e)}>
                    <div className="grid gap-4">
                        <p className="text-sm font-medium text-foreground">Emisor</p>
                        <FormField id="inv-name" label="Razón social" error={fieldErrors.name}>
                            <Input
                                id="inv-name"
                                required
                                value={form.name}
                                onChange={(e) => setField('name', e.target.value)}
                                aria-invalid={!!fieldErrors.name}
                            />
                        </FormField>
                        <FormField id="inv-tax" label="NIF / CIF" error={fieldErrors.taxId}>
                            <Input
                                id="inv-tax"
                                required
                                value={form.taxId}
                                onChange={(e) => setField('taxId', e.target.value)}
                                aria-invalid={!!fieldErrors.taxId}
                            />
                        </FormField>
                        <FormField id="inv-address" label="Dirección" error={fieldErrors.address}>
                            <Input
                                id="inv-address"
                                required
                                value={form.address}
                                onChange={(e) => setField('address', e.target.value)}
                                aria-invalid={!!fieldErrors.address}
                            />
                        </FormField>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <FormField id="inv-cp" label="CP" error={fieldErrors.postalCode}>
                                <Input
                                    id="inv-cp"
                                    required
                                    value={form.postalCode}
                                    onChange={(e) => setField('postalCode', e.target.value)}
                                    aria-invalid={!!fieldErrors.postalCode}
                                />
                            </FormField>
                            <FormField id="inv-city" label="Ciudad" error={fieldErrors.city}>
                                <Input
                                    id="inv-city"
                                    required
                                    value={form.city}
                                    onChange={(e) => setField('city', e.target.value)}
                                    aria-invalid={!!fieldErrors.city}
                                />
                            </FormField>
                            <FormField id="inv-province" label="Provincia" error={fieldErrors.province}>
                                <Input
                                    id="inv-province"
                                    value={form.province ?? ''}
                                    onChange={(e) => setField('province', e.target.value)}
                                    aria-invalid={!!fieldErrors.province}
                                />
                            </FormField>
                        </div>
                        <FormField id="inv-country" label="País" error={fieldErrors.country}>
                            <Input
                                id="inv-country"
                                required
                                value={form.country}
                                onChange={(e) => setField('country', e.target.value)}
                                aria-invalid={!!fieldErrors.country}
                            />
                        </FormField>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField id="inv-email" label="Email" error={fieldErrors.email}>
                                <Input
                                    id="inv-email"
                                    type="email"
                                    required
                                    value={form.email}
                                    onChange={(e) => setField('email', e.target.value)}
                                    aria-invalid={!!fieldErrors.email}
                                />
                            </FormField>
                            <FormField id="inv-web" label="Website" error={fieldErrors.website}>
                                <Input
                                    id="inv-web"
                                    value={form.website ?? ''}
                                    onChange={(e) => setField('website', e.target.value)}
                                    aria-invalid={!!fieldErrors.website}
                                />
                            </FormField>
                        </div>
                        <FormField id="inv-role" label="Etiqueta rol" error={fieldErrors.roleLabel}>
                            <Input
                                id="inv-role"
                                placeholder="DESARROLLADOR"
                                value={form.roleLabel ?? ''}
                                onChange={(e) => setField('roleLabel', e.target.value)}
                                aria-invalid={!!fieldErrors.roleLabel}
                            />
                        </FormField>
                    </div>

                    <div className="grid gap-4">
                        <p className="text-sm font-medium text-foreground">Banco</p>
                        <FormField id="inv-iban" label="IBAN" error={fieldErrors.iban}>
                            <Input
                                id="inv-iban"
                                required
                                value={form.iban}
                                onChange={(e) => setField('iban', e.target.value)}
                                aria-invalid={!!fieldErrors.iban}
                            />
                        </FormField>
                        <FormField id="inv-bank" label="Nombre del banco" error={fieldErrors.bankName}>
                            <Input
                                id="inv-bank"
                                value={form.bankName ?? ''}
                                onChange={(e) => setField('bankName', e.target.value)}
                                aria-invalid={!!fieldErrors.bankName}
                            />
                        </FormField>
                    </div>

                    <div className="grid gap-4">
                        <p className="text-sm font-medium text-foreground">Numeración</p>
                        <p className="text-xs text-muted-foreground">
                            Usa <code className="rounded bg-muted px-1">{'{year}'}</code> para el año. Ejemplo: prefijo{' '}
                            <code className="rounded bg-muted px-1">{'{year}-'}</code> y siguiente 11 → {new Date().getFullYear()}
                            -11. En año nuevo, si quieres reiniciar la serie, pon siguiente a 1.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField id="inv-prefix" label="Prefijo / patrón" error={fieldErrors.numberPrefix}>
                                <Input
                                    id="inv-prefix"
                                    required
                                    placeholder="{year}-"
                                    value={form.numberPrefix}
                                    onChange={(e) => setField('numberPrefix', e.target.value)}
                                    aria-invalid={!!fieldErrors.numberPrefix}
                                />
                            </FormField>
                            <FormField id="inv-next" label="Siguiente número" error={fieldErrors.nextSequence}>
                                <Input
                                    id="inv-next"
                                    type="number"
                                    min={1}
                                    step={1}
                                    required
                                    value={form.nextSequence}
                                    onChange={(e) => setField('nextSequence', Number(e.target.value) || 1)}
                                    aria-invalid={!!fieldErrors.nextSequence}
                                />
                            </FormField>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Próxima factura: <span className="font-medium text-foreground">{nextPreview}</span>
                        </p>
                    </div>

                    <div>
                        <Button type="submit" disabled={saving} className="cursor-pointer">
                            {saving ? 'Guardando…' : 'Guardar'}
                        </Button>
                    </div>
                </form>
            )}
        </ListPageShell>
    );
}
