import { useEffect, useState, type FormEvent } from 'react';
import { EntitySelect } from '@/components/entity-select';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    FormPanel,
    FormPanelDescription,
    FormPanelFooter,
    FormPanelHeader,
    FormPanelTitle,
} from '@/components/responsive-form-panel';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { listClientOptions } from '@/lib/clients';
import { type ContractInput } from '@/lib/contracts';
import { listProjects } from '@/lib/projects';
import { toastError } from '@/lib/toast';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: ContractInput) => Promise<void>;
};

export function ContractNewSheet({ open, onOpenChange, onSubmit }: Props) {
    const [title, setTitle] = useState('');
    const [clientId, setClientId] = useState<number | null>(null);
    const [projectId, setProjectId] = useState<number | null>(null);
    const [expiresAt, setExpiresAt] = useState('');
    const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
    const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setTitle('');
        setClientId(null);
        setProjectId(null);
        setExpiresAt('');
        setFieldErrors({});
        const ac = new AbortController();
        void listClientOptions(ac.signal)
            .then((rows) => {
                if (!ac.signal.aborted) setClients(rows);
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                toastError(err);
            });
        return () => ac.abort();
    }, [open]);

    useEffect(() => {
        if (!open || !clientId) {
            setProjects([]);
            return;
        }
        const ac = new AbortController();
        void listProjects({ clientId, perPage: 50, sort: 'name' }, ac.signal)
            .then((res) => {
                if (!ac.signal.aborted) setProjects(res.data.map((p) => ({ id: p.id, name: p.name })));
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                toastError(err);
            });
        return () => ac.abort();
    }, [open, clientId]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setFieldErrors({});
        if (!title.trim()) {
            setFieldErrors({ title: 'El título es obligatorio.' });
            return;
        }
        if (!clientId) {
            setFieldErrors({ clientId: 'El cliente es obligatorio.' });
            return;
        }
        setSaving(true);
        try {
            await onSubmit({
                title: title.trim(),
                clientId,
                projectId,
                expiresAt: expiresAt || null,
            });
        } catch (err) {
            if (err instanceof ApiError) {
                setFieldErrors(flattenFieldErrors(err.fieldErrors ?? {}));
            }
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    return (
        <FormPanel open={open} onOpenChange={onOpenChange} contentClassName="flex flex-col sm:max-w-md">
                <FormPanelHeader>
                    <FormPanelTitle>Nuevo contrato</FormPanelTitle>
                    <FormPanelDescription>Crea un borrador y coloca PDFs y firmas en el detalle.</FormPanelDescription>
                </FormPanelHeader>
                <form noValidate className="flex min-h-0 flex-1 flex-col gap-4 px-4" onSubmit={(e) => void handleSubmit(e)}>
                    <FormField id="c-title" label="Título" error={fieldErrors.title}>
                        <Input
                            id="c-title"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                setFieldErrors((p) => ({ ...p, title: '' }));
                            }}
                            aria-invalid={Boolean(fieldErrors.title)}
                        />
                    </FormField>
                    <FormField id="c-client" label="Cliente" error={fieldErrors.clientId}>
                        <EntitySelect
                            id="c-client"
                            items={clients}
                            value={clientId}
                            onValueChange={(id) => {
                                setClientId(id);
                                setProjectId(null);
                                setFieldErrors((p) => ({ ...p, clientId: '' }));
                            }}
                            placeholder="Seleccionar cliente…"
                            aria-invalid={Boolean(fieldErrors.clientId)}
                        />
                    </FormField>
                    <FormField id="c-project" label="Proyecto (opcional)" error={fieldErrors.projectId}>
                        <EntitySelect
                            id="c-project"
                            items={projects}
                            value={projectId}
                            onValueChange={setProjectId}
                            allowClear
                            placeholder="Sin proyecto"
                            disabled={!clientId}
                            aria-invalid={Boolean(fieldErrors.projectId)}
                        />
                    </FormField>
                    <FormField id="c-expires" label="Caducidad (opcional)" error={fieldErrors.expiresAt}>
                        <Input
                            id="c-expires"
                            type="date"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                            aria-invalid={Boolean(fieldErrors.expiresAt)}
                        />
                    </FormField>
                    <FormPanelFooter className="mt-auto px-0">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? 'Creando…' : 'Crear borrador'}
                        </Button>
                    </FormPanelFooter>
                </form>
        </FormPanel>
    );
}
