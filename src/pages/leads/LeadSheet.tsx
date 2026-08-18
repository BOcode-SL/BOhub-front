import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { FormField } from '@/components/form-field';
import { AppSelect } from '@/components/app-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import {
    addLeadNote,
    getLead,
    leadFormAnswers,
    LEAD_SOURCE_BADGE_CLASS,
    LEAD_SOURCE_LABELS,
    LEAD_SOURCES,
    LEAD_STATUS_BADGE_CLASS,
    LEAD_STATUS_LABELS,
    LEAD_STATUSES,
    patchLeadAssign,
    patchLeadStatus,
    type Lead,
    type LeadInput,
    type LeadSource,
    type LeadStatus,
    whatsAppUrl,
} from '@/lib/leads';
import { toastError, toastSuccess } from '@/lib/toast';

type LeadSheetProps = {
    open: boolean;
    mode: 'add' | 'edit';
    lead: Lead | null;
    assignees: { id: number; name: string }[];
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: LeadInput) => Promise<void>;
    onChanged?: () => void;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
            {children}
        </section>
    );
}

export function LeadSheet({ open, mode, lead, assignees, onOpenChange, onSubmit, onChanged }: LeadSheetProps) {
    const [current, setCurrent] = useState<Lead | null>(lead);
    const [form, setForm] = useState<LeadInput>({});
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [lostOpen, setLostOpen] = useState(false);
    const [lostDraft, setLostDraft] = useState('');

    useEffect(() => {
        if (!open) return;
        setFieldErrors({});
        setNote('');
        setLostOpen(false);
        setLostDraft('');
        if (mode === 'add') {
            setCurrent(null);
            setForm({ name: '', email: '', phone: '', source: 'manual', assignedUserId: null, lostReason: '' });
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
    const assigneeItems = [
        { label: 'Sin asignar', value: 'none' },
        ...assignees.map((u) => ({ label: u.name, value: String(u.id) })),
    ];
    const events = useMemo(() => current?.events ?? [], [current]);
    const formAnswers = useMemo(() => leadFormAnswers(current?.payload ?? null), [current]);
    const hasOrigin = Boolean(current?.campaignName || current?.formName || current?.adName || current?.metaLeadId || current?.source);

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

    async function applyStatus(next: LeadStatus, reason?: string | null) {
        if (!current) return;
        try {
            const updated = await patchLeadStatus(current.id, next, reason ?? null);
            setCurrent(updated);
            setForm((prev) => ({ ...prev, lostReason: updated.lostReason ?? '' }));
            toastSuccess('Etapa actualizada');
            onChanged?.();
        } catch (err) {
            toastError(err);
        }
    }

    async function handleStatus(next: string | null) {
        if (!current || !next || next === current.status) return;
        if (next === 'lost') {
            setLostDraft(form.lostReason ?? '');
            setLostOpen(true);
            return;
        }
        await applyStatus(next as LeadStatus, null);
    }

    async function handleAssign(userId: number | null) {
        if (!current) return;
        try {
            const updated = await patchLeadAssign(current.id, userId);
            setCurrent(updated);
            setForm((prev) => ({ ...prev, assignedUserId: userId }));
            toastSuccess('Asignación actualizada');
            onChanged?.();
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
            onChanged?.();
        } catch (err) {
            toastError(err);
        }
    }

    const contactFields = (
        <>
            <FormField id="lead-name" label="Nombre" error={fieldErrors.name}>
                <Input id="lead-name" value={form.name ?? ''} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </FormField>
            <FormField id="lead-phone" label="Teléfono" error={fieldErrors.phone}>
                <Input id="lead-phone" value={form.phone ?? ''} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </FormField>
            <FormField id="lead-email" label="Email" error={fieldErrors.email}>
                <Input id="lead-email" value={form.email ?? ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </FormField>
            {form.phone ? (
                <Button type="button" variant="outline" onClick={() => window.open(whatsAppUrl(form.phone as string), '_blank', 'noopener,noreferrer')}>
                    Abrir WhatsApp
                </Button>
            ) : null}
        </>
    );

    return (
        <>
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className={mode === 'edit' ? 'w-full overflow-y-auto sm:max-w-2xl' : 'w-full overflow-y-auto sm:max-w-xl'}>
                <SheetHeader>
                    <SheetTitle>{mode === 'add' ? 'Añadir lead' : current?.name || 'Lead'}</SheetTitle>
                    <SheetDescription className="flex flex-wrap items-center gap-2">
                        {mode === 'edit' && current ? (
                            <>
                                <Badge variant="outline" className={LEAD_STATUS_BADGE_CLASS[current.status]}>
                                    {LEAD_STATUS_LABELS[current.status]}
                                </Badge>
                                <Badge variant="outline" className={LEAD_SOURCE_BADGE_CLASS[current.source as LeadSource] ?? 'border-border'}>
                                    {LEAD_SOURCE_LABELS[current.source as LeadSource] ?? current.source}
                                </Badge>
                            </>
                        ) : (
                            'Alta manual'
                        )}
                    </SheetDescription>
                </SheetHeader>

                <form id="lead-form" noValidate onSubmit={(e) => void handleSubmit(e)} className="space-y-8 px-4">
                    {mode === 'add' ? (
                        <>
                            {contactFields}
                            <FormField id="lead-source" label="Fuente">
                                <AppSelect
                                    items={LEAD_SOURCES.map((s) => ({ label: LEAD_SOURCE_LABELS[s], value: s }))}
                                    value={form.source ?? 'manual'}
                                    onValueChange={(v) => setForm((p) => ({ ...p, source: (v as LeadSource) || 'manual' }))}
                                />
                            </FormField>
                            <FormField id="lead-assigned" label="Asignado">
                                <AppSelect
                                    items={assigneeItems}
                                    value={form.assignedUserId != null ? String(form.assignedUserId) : 'none'}
                                    onValueChange={(v) => setForm((p) => ({ ...p, assignedUserId: v && v !== 'none' ? Number(v) : null }))}
                                />
                            </FormField>
                        </>
                    ) : current ? (
                        <>
                            <Section title="Contacto">
                                {contactFields}
                                <FormField id="lead-status" label="Etapa">
                                    <AppSelect
                                        items={LEAD_STATUSES.map((s) => ({ label: LEAD_STATUS_LABELS[s], value: s }))}
                                        value={status}
                                        onValueChange={(v) => void handleStatus(v)}
                                    />
                                </FormField>
                                <FormField id="lead-assigned" label="Asignado">
                                    <AppSelect
                                        items={assigneeItems}
                                        value={form.assignedUserId != null ? String(form.assignedUserId) : 'none'}
                                        onValueChange={(v) => void handleAssign(v && v !== 'none' ? Number(v) : null)}
                                    />
                                </FormField>
                                {status === 'lost' && (
                                    <FormField id="lead-lost-reason" label="Motivo (si perdido)" error={fieldErrors.lostReason}>
                                        <Input id="lead-lost-reason" value={form.lostReason ?? ''} onChange={(e) => setForm((p) => ({ ...p, lostReason: e.target.value }))} />
                                    </FormField>
                                )}
                            </Section>

                            <Section title="Formulario">
                                {formAnswers.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sin respuestas de formulario.</p>
                                ) : (
                                    <dl className="space-y-2">
                                        {formAnswers.map((row) => (
                                            <div key={row.label}>
                                                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                                                <dd className="text-sm">{row.value}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}
                            </Section>

                            {hasOrigin && (
                                <Section title="Origen">
                                    <div className="space-y-2 text-sm">
                                        <p>
                                            <span className="text-muted-foreground">Fuente: </span>
                                            <Badge variant="outline" className={LEAD_SOURCE_BADGE_CLASS[current.source as LeadSource] ?? 'border-border'}>
                                                {LEAD_SOURCE_LABELS[current.source as LeadSource] ?? current.source}
                                            </Badge>
                                        </p>
                                        {current.campaignName ? <p><span className="text-muted-foreground">Campaña: </span>{current.campaignName}</p> : null}
                                        {current.formName ? <p><span className="text-muted-foreground">Formulario: </span>{current.formName}</p> : null}
                                        {current.adName ? <p><span className="text-muted-foreground">Anuncio: </span>{current.adName}</p> : null}
                                        {current.metaLeadId ? <p><span className="text-muted-foreground">Meta lead: </span>{current.metaLeadId}</p> : null}
                                    </div>
                                </Section>
                            )}

                            <Section title="Notas">
                                <FormField id="lead-note" label="Nueva nota">
                                    <Textarea id="lead-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />
                                </FormField>
                                <Button type="button" variant="outline" onClick={() => void handleAddNote()} disabled={!note.trim()}>
                                    Añadir nota
                                </Button>
                                <div className="space-y-2 rounded-md border p-3">
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
                            </Section>
                        </>
                    ) : null}
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

        <Dialog open={lostOpen} onOpenChange={setLostOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Motivo de pérdida</DialogTitle>
                </DialogHeader>
                <Input
                    value={lostDraft}
                    onChange={(e) => setLostDraft(e.target.value)}
                    placeholder="Motivo…"
                    autoFocus
                />
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setLostOpen(false)}>
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        disabled={!lostDraft.trim()}
                        onClick={() => {
                            const reason = lostDraft.trim();
                            if (!reason) return;
                            setLostOpen(false);
                            void applyStatus('lost', reason);
                        }}
                    >
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
