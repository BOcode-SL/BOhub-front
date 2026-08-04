import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;

        if (mode !== 'edit' || !client) {
            setForm(emptyForm);
            return;
        }

        // seed from list row; hydrate notes via show() (list omits notes)
        setForm(toForm(client));

        let cancelled = false;
        void getClient(client.id)
            .then((full) => {
                if (!cancelled) setForm(toForm(full));
            })
            .catch((err) => {
                if (!cancelled) toastError(err);
            });

        return () => {
            cancelled = true;
        };
    }, [open, mode, client]);

    function setField<K extends keyof ClientInput>(key: K, value: ClientInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
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

                <form id="client-form" onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4 px-4">
                    <div className="space-y-2">
                        <Label htmlFor="client-name">Nombre *</Label>
                        <Input
                            id="client-name"
                            required
                            maxLength={255}
                            value={form.name}
                            onChange={(e) => setField('name', e.target.value)}
                            placeholder="Nombre o razón social"
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="client-tax">NIF / CIF</Label>
                        <Input
                            id="client-tax"
                            maxLength={50}
                            value={form.taxId ?? ''}
                            onChange={(e) => setField('taxId', e.target.value)}
                            placeholder="B12345678"
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="client-email">Email</Label>
                        <Input
                            id="client-email"
                            type="email"
                            maxLength={255}
                            value={form.email ?? ''}
                            onChange={(e) => setField('email', e.target.value)}
                            placeholder="contacto@empresa.com"
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="client-phone">Teléfono</Label>
                        <Input
                            id="client-phone"
                            maxLength={50}
                            value={form.phone ?? ''}
                            onChange={(e) => setField('phone', e.target.value)}
                            placeholder="600 000 000"
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="client-address">Dirección</Label>
                        <Input
                            id="client-address"
                            maxLength={255}
                            value={form.address ?? ''}
                            onChange={(e) => setField('address', e.target.value)}
                            placeholder="Calle, número, piso…"
                            className="bg-background"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="client-city">Ciudad</Label>
                            <Input
                                id="client-city"
                                maxLength={120}
                                value={form.city ?? ''}
                                onChange={(e) => setField('city', e.target.value)}
                                placeholder="Madrid"
                                className="bg-background"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="client-postal">C.P.</Label>
                            <Input
                                id="client-postal"
                                maxLength={20}
                                value={form.postalCode ?? ''}
                                onChange={(e) => setField('postalCode', e.target.value)}
                                placeholder="28001"
                                className="bg-background"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="client-country">País</Label>
                        <Input
                            id="client-country"
                            maxLength={120}
                            value={form.country ?? ''}
                            onChange={(e) => setField('country', e.target.value)}
                            placeholder="España"
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="client-notes">Notas</Label>
                        <Textarea
                            id="client-notes"
                            value={form.notes ?? ''}
                            onChange={(e) => setField('notes', e.target.value)}
                            placeholder="Notas internas…"
                            className="bg-background min-h-24"
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
                    <Button type="submit" form="client-form" className="cursor-pointer" disabled={saving}>
                        {saving ? 'Guardando…' : mode === 'add' ? 'Crear' : 'Guardar'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
