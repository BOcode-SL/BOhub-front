import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { AppSelect } from '@/components/app-select';
import { EntitySelect } from '@/components/entity-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { addLeadNote, getLead, patchLeadAssign, patchLeadStatus, type Lead, type LeadInput, type LeadStatus, whatsAppUrl } from '@/lib/leads';
import { toastError, toastSuccess } from '@/lib/toast';

const STATUS_ITEMS = [
    { label: 'Nuevo', value: 'new' },
    { label: 'Contactado', value: 'contacted' },
    { label: 'Cualificado', value: 'qualified' },
    { label: 'Reunión', value: 'meeting' },
    { label: 'Ganado', value: 'won' },
    { label: 'Perdido', value: 'lost' },
] as const;

type LeadSheetProps = {
    open: boolean;
    mode: 'add' | 'edit';
    lead: Lead | null;
    assignees: { id: number; name: string }[];
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: LeadInput) => Promise<void>;
};

export function LeadSheet({ open, mode, lead, assignees, onOpenChange, onSubmit }: LeadSheetProps) {
    const [current, setCurrent] = useState<Lead | null>(lead);
    const [form, setForm] = useState<LeadInput>({});
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!open) return;
        setFieldErrors({});
        setNote('');
        if (mode === 'add') {
            setCurrent(null);
            setForm({ name: '', email: '', phone: '', assignedUserId: null, lostReason: '' });
            return;
        }
        if (!lead) return;
        void getLead(lead.id)
            .then((full) => {
                setCurrent(full);
                setForm({
                    name: full.name ?? '',
                    email: full.email ?? '',
                    phone: full.phone ?? '',
                    assignedUserId: full.assignedUserId ?? null,
                    lostReason: full.lostReason ?? '',
                });
            })
            .catch((err) => {
                toastError(err);
                onOpenChange(false);
            });
    }, [open, mode, lead, onOpenChange]);

    const status = current?.status ?? 'new';
    const showLostReason = status === 'lost';
    const events = useMemo(() => current?.events ?? [], [current]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            await onSubmit(form);
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

    async function handleStatus(next: string | null) {
        if (!current || !next) return;
        try {
            const updated = await patchLeadStatus(current.id, next as LeadStatus, form.lostReason ?? null);
            setCurrent(updated);
            toastSuccess('Etapa actualizada');
        } catch (err) {
            toastError(err);
        }
    }

    async function handleAssign(userId: number | null) {
        if (!current) return;
        try {
            const updated = await patchLeadAssign(current.id, userId);
            setCurrent(updated);
            setForm((prev) => ({ ...prev, assignedUserId: userId }));
            toastSuccess('Asignación actualizada');
        } catch (err) {
            toastError(err);
        }
    }

    async function handleAddNote() {
        if (!current || !note.trim()) return;
        try {
            const updated = await addLeadNote(current.id, note.trim());
            setCurrent(updated);
            setNote('');
            toastSuccess('Nota añadida');
        } catch (err) {
            toastError(err);
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
                <SheetHeader>
                    <SheetTitle>{mode === 'add' ? 'Añadir lead' : 'Editar lead'}</SheetTitle>
                    <SheetDescription>Bandeja comercial fase 1.</SheetDescription>
                </SheetHeader>

                <form id="lead-form" noValidate onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-4">
                    <FormField id="lead-name" label="Nombre" error={fieldErrors.name}>
                        <Input id="lead-name" value={form.name ?? ''} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                    </FormField>
                    <FormField id="lead-phone" label="Teléfono" error={fieldErrors.phone}>
                        <Input id="lead-phone" value={form.phone ?? ''} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                    </FormField>
                    <FormField id="lead-email" label="Email" error={fieldErrors.email}>
                        <Input id="lead-email" value={form.email ?? ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                    </FormField>

                    {mode === 'edit' && current && (
                        <>
                            <FormField id="lead-status" label="Etapa">
                                <AppSelect items={STATUS_ITEMS.map((x) => ({ label: x.label, value: x.value }))} value={status} onValueChange={(v) => void handleStatus(v)} />
                            </FormField>
                            <FormField id="lead-assigned" label="Asignado">
                                <EntitySelect value={form.assignedUserId ?? null} onValueChange={(id) => void handleAssign(id)} items={assignees} allowClear placeholder="Sin asignar" />
                            </FormField>
                        </>
                    )}

                    {showLostReason && (
                        <FormField id="lead-lost-reason" label="Motivo (si perdido)" error={fieldErrors.lostReason}>
                            <Input id="lead-lost-reason" value={form.lostReason ?? ''} onChange={(e) => setForm((p) => ({ ...p, lostReason: e.target.value }))} />
                        </FormField>
                    )}

                    {form.phone && (
                        <Button type="button" variant="outline" onClick={() => window.open(whatsAppUrl(form.phone as string), '_blank', 'noopener,noreferrer')}>
                            Abrir WhatsApp
                        </Button>
                    )}

                    {mode === 'edit' && current && (
                        <>
                            <FormField id="lead-note" label="Nueva nota">
                                <Textarea id="lead-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />
                            </FormField>
                            <Button type="button" variant="outline" onClick={() => void handleAddNote()} disabled={!note.trim()}>
                                Añadir nota
                            </Button>
                            <div className="space-y-2 rounded-md border p-3">
                                <p className="text-sm font-medium">Timeline</p>
                                {events.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sin eventos aún.</p>
                                ) : (
                                    events.map((event) => (
                                        <div key={event.id} className="text-sm">
                                            <span className="font-medium">{event.type}</span>: {event.body}
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </form>

                <SheetFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="lead-form" disabled={saving}>
                        {saving ? 'Guardando…' : mode === 'add' ? 'Crear' : 'Guardar'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
