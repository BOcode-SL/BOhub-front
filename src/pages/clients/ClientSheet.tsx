import { useLayoutEffect, useState, type FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { FormFieldsSkeleton } from '@/components/form-fields-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { type Client, type ClientInput, getClient } from '@/lib/clients';
import { toastError } from '@/lib/toast';

const emptyForm: ClientInput = {
    name: '',
    taxId: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'España',
    notes: '',
};

function toForm(c: Client): ClientInput {
    return {
        name: c.name,
        taxId: c.taxId ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        address: c.address ?? '',
        city: c.city ?? '',
        postalCode: c.postalCode ?? '',
        country: c.country ?? 'España',
        notes: c.notes ?? '',
    };
}

type ClientSheetProps = {
    open: boolean;
    mode: 'add' | 'edit';
    client: Client | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: ClientInput) => Promise<void>;
};

export function ClientSheet({ open, mode, client, onOpenChange, onSubmit }: ClientSheetProps) {
    const [form, setForm] = useState<ClientInput>(emptyForm);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [hydrating, setHydrating] = useState(false);

    useLayoutEffect(() => {
        if (!open) return;

        setFieldErrors({});

        if (mode !== 'edit' || !client) {
            setHydrating(false);
            setForm(emptyForm);
            return;
        }

        // list omits notes — always hydrate via show()
        setHydrating(true);
        setForm(emptyForm);
        let cancelled = false;
        void getClient(client.id)
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
    }, [open, mode, client]);

    function setField<K extends keyof ClientInput>(key: K, value: ClientInput[K]) {
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
        if (!form.name.trim()) {
            setFieldErrors({ name: 'El nombre es obligatorio.' });
            return;
        }
        setSaving(true);
        try {
            await onSubmit({
                name: form.name.trim(),
                taxId: form.taxId?.toString().trim() || null,
                email: form.email?.toString().trim() || null,
                phone: form.phone?.toString().trim() || null,
                address: form.address?.toString().trim() || null,
                city: form.city?.toString().trim() || null,
                postalCode: form.postalCode?.toString().trim() || null,
                country: form.country?.toString().trim() || 'España',
                notes: form.notes?.toString().trim() || null,
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
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{mode === 'add' ? 'Añadir cliente' : 'Editar cliente'}</SheetTitle>
                    <SheetDescription>Datos fiscales y de contacto del cliente.</SheetDescription>
                </SheetHeader>

                {hydrating ? (
                    <div className="px-4 pb-4">
                        <FormFieldsSkeleton fields={8} />
                    </div>
                ) : (
                <form id="client-form" noValidate onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4 px-4">
                    <FormField id="client-name" label="Nombre *" error={fieldErrors.name}>
                        <Input
                            id="client-name"
                            required
                            maxLength={255}
                            value={form.name}
                            onChange={(e) => setField('name', e.target.value)}
                            placeholder="Nombre o razón social"
                            className="bg-background"
                            aria-invalid={!!fieldErrors.name}
                        />
                    </FormField>
                    <FormField id="client-tax" label="NIF / CIF" error={fieldErrors.taxId}>
                        <Input
                            id="client-tax"
                            maxLength={50}
                            value={form.taxId ?? ''}
                            onChange={(e) => setField('taxId', e.target.value)}
                            placeholder="B12345678"
                            className="bg-background"
                            aria-invalid={!!fieldErrors.taxId}
                        />
                    </FormField>
                    <FormField id="client-email" label="Email" error={fieldErrors.email}>
                        <Input
                            id="client-email"
                            type="email"
                            maxLength={255}
                            value={form.email ?? ''}
                            onChange={(e) => setField('email', e.target.value)}
                            placeholder="contacto@empresa.com"
                            className="bg-background"
                            aria-invalid={!!fieldErrors.email}
                        />
                    </FormField>
                    <FormField id="client-phone" label="Teléfono" error={fieldErrors.phone}>
                        <Input
                            id="client-phone"
                            maxLength={50}
                            value={form.phone ?? ''}
                            onChange={(e) => setField('phone', e.target.value)}
                            placeholder="600 000 000"
                            className="bg-background"
                            aria-invalid={!!fieldErrors.phone}
                        />
                    </FormField>
                    <FormField id="client-address" label="Dirección" error={fieldErrors.address}>
                        <Input
                            id="client-address"
                            maxLength={255}
                            value={form.address ?? ''}
                            onChange={(e) => setField('address', e.target.value)}
                            placeholder="Calle, número, piso…"
                            className="bg-background"
                            aria-invalid={!!fieldErrors.address}
                        />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                        <FormField id="client-city" label="Ciudad" error={fieldErrors.city}>
                            <Input
                                id="client-city"
                                maxLength={120}
                                value={form.city ?? ''}
                                onChange={(e) => setField('city', e.target.value)}
                                placeholder="Madrid"
                                className="bg-background"
                                aria-invalid={!!fieldErrors.city}
                            />
                        </FormField>
                        <FormField id="client-postal" label="C.P." error={fieldErrors.postalCode}>
                            <Input
                                id="client-postal"
                                maxLength={20}
                                value={form.postalCode ?? ''}
                                onChange={(e) => setField('postalCode', e.target.value)}
                                placeholder="28001"
                                className="bg-background"
                                aria-invalid={!!fieldErrors.postalCode}
                            />
                        </FormField>
                    </div>
                    <FormField id="client-country" label="País" error={fieldErrors.country}>
                        <Input
                            id="client-country"
                            maxLength={120}
                            value={form.country ?? ''}
                            onChange={(e) => setField('country', e.target.value)}
                            placeholder="España"
                            className="bg-background"
                            aria-invalid={!!fieldErrors.country}
                        />
                    </FormField>
                    <FormField id="client-notes" label="Notas" error={fieldErrors.notes}>
                        <Textarea
                            id="client-notes"
                            value={form.notes ?? ''}
                            onChange={(e) => setField('notes', e.target.value)}
                            placeholder="Notas internas…"
                            className="bg-background min-h-24"
                            aria-invalid={!!fieldErrors.notes}
                        />
                    </FormField>
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
                        form="client-form"
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
