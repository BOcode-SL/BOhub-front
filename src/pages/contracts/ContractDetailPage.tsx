import { useCallback, useEffect, useMemo, useState, type FormEvent, lazy, Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Download, FilePen, Plus, Trash2 } from 'lucide-react';
import { EntitySelect } from '@/components/entity-select';
import { FormField } from '@/components/form-field';
import { usePageCrumb } from '@/components/layout/page-crumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BillingFileDropzone } from '@/pages/billing/BillingFileDropzone';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { listClientOptions } from '@/lib/clients';
import {
    CONTRACT_EVENT_LABELS,
    CONTRACT_STATUS_BADGE_CLASS,
    CONTRACT_STATUS_LABELS,
    addSigner,
    cancelContract,
    deleteDocument,
    deleteSigner,
    downloadContractPack,
    fieldToInput,
    getContract,
    getDocumentFileBlob,
    isBocodeSigner,
    isDraft,
    remindContract,
    reorderDocuments,
    replaceFields,
    sendBlockers,
    sendContract,
    updateContract,
    updateSigner,
    uploadContractDocument,
    type Contract,
    type ContractFieldInput,
    type ContractStatus,
} from '@/lib/contracts';
import { listProjects } from '@/lib/projects';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';

const ContractFieldEditor = lazy(() =>
    import('@/pages/contracts/ContractFieldEditor').then((m) => ({ default: m.ContractFieldEditor })),
);

type Step = 'datos' | 'docs' | 'signers' | 'fields' | 'send';
type EditorField = ContractFieldInput & { key: string };

const STEPS: { id: Step; label: string }[] = [
    { id: 'datos', label: 'Datos' },
    { id: 'docs', label: 'Documentos' },
    { id: 'signers', label: 'Firmantes' },
    { id: 'fields', label: 'Campos' },
    { id: 'send', label: 'Enviar' },
];

function toEditorFields(rows: Contract['fields']): EditorField[] {
    return (rows ?? []).map((f) => ({ ...fieldToInput(f), key: `id-${f.id}` }));
}

function formatWhen(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

export function ContractDetailPage() {
    const { id } = useParams();
    const contractId = Number(id);
    const [contract, setContract] = useState<Contract | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [step, setStep] = useState<Step>('datos');
    const [saving, setSaving] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
    const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
    const [title, setTitle] = useState('');
    const [clientId, setClientId] = useState<number | null>(null);
    const [projectId, setProjectId] = useState<number | null>(null);
    const [expiresAt, setExpiresAt] = useState('');
    const [signerName, setSignerName] = useState('');
    const [signerEmail, setSignerEmail] = useState('');
    const [editorFields, setEditorFields] = useState<EditorField[]>([]);
    const [fieldsDirty, setFieldsDirty] = useState(false);
    const [docId, setDocId] = useState<number | null>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [selectedSignerId, setSelectedSignerId] = useState<number | null>(null);
    const [confirm, setConfirm] = useState<'send' | 'cancel' | null>(null);

    const draft = contract ? isDraft(contract.status) : false;
    usePageCrumb(contract?.title);

    const reload = useCallback(async (signal?: AbortSignal) => {
        const c = await getContract(contractId, signal);
        setContract(c);
        setTitle(c.title);
        setClientId(c.clientId);
        setProjectId(c.projectId);
        setExpiresAt(c.expiresAt ?? '');
        setEditorFields(toEditorFields(c.fields));
        setFieldsDirty(false);
        const firstDoc = c.documents?.[0]?.id ?? null;
        setDocId((prev) => prev && c.documents?.some((d) => d.id === prev) ? prev : firstDoc);
        const firstSigner = c.signers?.[0]?.id ?? null;
        setSelectedSignerId((prev) => prev && c.signers?.some((s) => s.id === prev) ? prev : firstSigner);
        return c;
    }, [contractId]);

    useEffect(() => {
        if (!Number.isFinite(contractId) || contractId < 1) {
            setLoadFailed(true);
            return;
        }
        const ac = new AbortController();
        void reload(ac.signal).catch((err) => {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            toastError(err);
            setLoadFailed(true);
        });
        return () => ac.abort();
    }, [contractId, reload]);

    useEffect(() => {
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
    }, []);

    useEffect(() => {
        if (!clientId) {
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
    }, [clientId]);

    useEffect(() => {
        if (!contract || !docId) {
            setBlobUrl(null);
            return;
        }
        let url: string | null = null;
        let cancelled = false;
        void getDocumentFileBlob(contract.id, docId)
            .then((blob) => {
                if (cancelled) return;
                url = URL.createObjectURL(blob);
                setBlobUrl(url);
            })
            .catch((err) => {
                if (!cancelled) toastError(err);
            });
        return () => {
            cancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, [contract, docId]);

    function onEditorChange(next: EditorField[]) {
        setEditorFields(next);
        setFieldsDirty(true);
    }

    async function saveDatos(e: FormEvent) {
        e.preventDefault();
        if (!contract || !draft) return;
        setFieldErrors({});
        if (!title.trim() || !clientId) {
            setFieldErrors({
                ...(title.trim() ? {} : { title: 'Obligatorio.' }),
                ...(clientId ? {} : { clientId: 'Obligatorio.' }),
            });
            return;
        }
        setSaving(true);
        try {
            const updated = await updateContract(contract.id, {
                title: title.trim(),
                clientId,
                projectId,
                expiresAt: expiresAt || null,
            });
            setContract(updated);
            toastSuccess('Datos guardados');
        } catch (err) {
            if (err instanceof ApiError) setFieldErrors(flattenFieldErrors(err.fieldErrors ?? {}));
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    async function onFiles(files: File[]) {
        if (!contract || !draft) return;
        const pdfs = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
        if (!pdfs.length) return;
        setSaving(true);
        try {
            for (const file of pdfs) {
                await uploadContractDocument(contract.id, file);
            }
            toastSuccess(pdfs.length === 1 ? 'PDF subido' : `${pdfs.length} PDFs subidos`);
            await reload();
        } catch (err) {
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    async function moveDoc(index: number, dir: -1 | 1) {
        if (!contract?.documents) return;
        const ids = contract.documents.map((d) => d.id);
        const j = index + dir;
        if (j < 0 || j >= ids.length) return;
        const swapped = [...ids];
        const tmp = swapped[index];
        swapped[index] = swapped[j];
        swapped[j] = tmp;
        setSaving(true);
        try {
            await reorderDocuments(contract.id, swapped);
            await reload();
        } catch (err) {
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    async function handleAddSigner(e: FormEvent) {
        e.preventDefault();
        if (!contract || !draft) return;
        setSaving(true);
        try {
            await addSigner(contract.id, { name: signerName.trim(), email: signerEmail.trim() });
            setSignerName('');
            setSignerEmail('');
            toastSuccess('Firmante añadido');
            await reload();
        } catch (err) {
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    async function moveSigner(index: number, dir: -1 | 1) {
        const signers = contract?.signers ?? [];
        const other = signers[index + dir];
        const current = signers[index];
        if (!contract || !current || !other) return;
        setSaving(true);
        try {
            await updateSigner(contract.id, current.id, { position: other.position });
            await updateSigner(contract.id, other.id, { position: current.position });
            await reload();
        } catch (err) {
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    async function saveFields(): Promise<boolean> {
        if (!contract || !draft) return true;
        setSaving(true);
        try {
            const saved = await replaceFields(
                contract.id,
                editorFields.map((f, i) => ({
                    documentId: f.documentId,
                    signerId: f.signerId,
                    type: f.type,
                    page: f.page,
                    xPct: f.xPct,
                    yPct: f.yPct,
                    wPct: f.wPct,
                    hPct: f.hPct,
                    label: f.label,
                    position: i + 1,
                })),
            );
            setEditorFields(saved.map((f) => ({ ...fieldToInput(f), key: `id-${f.id}` })));
            setFieldsDirty(false);
            const fresh = await getContract(contract.id);
            setContract(fresh);
            toastSuccess('Campos guardados');
            return true;
        } catch (err) {
            toastError(err);
            return false;
        } finally {
            setSaving(false);
        }
    }

    async function handleSend() {
        if (!contract) return;
        if (fieldsDirty) {
            const ok = await saveFields();
            if (!ok) return;
        }
        const blockers = sendBlockers(contract, editorFields);
        if (blockers.length) {
            toastError(blockers[0]);
            return;
        }
        setSaving(true);
        try {
            const updated = await sendContract(contract.id);
            setContract(updated);
            setConfirm(null);
            toastSuccess('Sobre enviado');
        } catch (err) {
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    async function handleRemind() {
        if (!contract) return;
        setSaving(true);
        try {
            await remindContract(contract.id);
            toastSuccess('Recordatorio enviado');
            await reload();
        } catch (err) {
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    async function handleCancel() {
        if (!contract) return;
        setSaving(true);
        try {
            const updated = await cancelContract(contract.id);
            setContract(updated);
            setConfirm(null);
            toastSuccess('Sobre cancelado');
        } catch (err) {
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    async function handleDownload() {
        if (!contract) return;
        try {
            await downloadContractPack(contract.id);
        } catch (err) {
            toastError(err);
        }
    }

    const blockers = useMemo(
        () => (contract ? sendBlockers(contract, editorFields) : []),
        [contract, editorFields],
    );
    const currentDoc = contract?.documents?.find((d) => d.id === docId) ?? contract?.documents?.[0] ?? null;

    if (loadFailed && !contract) {
        return (
            <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">No se pudo cargar el contrato.</p>
                <Button variant="outline" className="w-fit" nativeButton={false} render={<Link to="/dashboard/contracts" />}>
                    <ArrowLeft />
                    Volver a contratos
                </Button>
            </div>
        );
    }

    if (!contract) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    const status = contract.status as ContractStatus;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link to="/dashboard/contracts" />}>
                    <ArrowLeft />
                    Contratos
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    <FilePen className="size-5 text-foreground" aria-hidden />
                    <h1 className="text-lg font-semibold">{contract.title}</h1>
                    <Badge variant="outline" className={CONTRACT_STATUS_BADGE_CLASS[status]}>
                        {CONTRACT_STATUS_LABELS[status]}
                    </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    {contract.client?.name ?? '—'}
                    {contract.expiresAt ? ` · Caduca ${contract.expiresAt}` : ''}
                </p>
            </div>

            {!draft && (
                <div className="flex flex-wrap gap-2">
                    {(status === 'sent' || status === 'partially_signed') && (
                        <Button type="button" variant="outline" disabled={saving} onClick={() => void handleRemind()}>
                            Recordatorio
                        </Button>
                    )}
                    {status !== 'signed' && (
                        <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirm('cancel')}>
                            Cancelar sobre
                        </Button>
                    )}
                    {status === 'signed' && (
                        <Button type="button" disabled={saving} onClick={() => void handleDownload()}>
                            <Download />
                            Descargar pack
                        </Button>
                    )}
                </div>
            )}

            <nav aria-label="Pasos del contrato" className="flex flex-wrap gap-2 border-b border-border pb-3">
                {STEPS.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        className={cn(
                            'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                            step === s.id
                                ? 'bg-sidebar-accent font-medium text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                        onClick={() => setStep(s.id)}
                    >
                        {s.label}
                    </button>
                ))}
            </nav>

            {step === 'datos' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Datos del sobre</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form noValidate className="grid max-w-lg gap-4" onSubmit={(e) => void saveDatos(e)}>
                            <FormField id="d-title" label="Título" error={fieldErrors.title}>
                                <Input
                                    id="d-title"
                                    value={title}
                                    disabled={!draft}
                                    onChange={(e) => {
                                        setTitle(e.target.value);
                                        setFieldErrors((p) => ({ ...p, title: '' }));
                                    }}
                                    aria-invalid={Boolean(fieldErrors.title)}
                                />
                            </FormField>
                            <FormField id="d-client" label="Cliente" error={fieldErrors.clientId}>
                                <EntitySelect
                                    id="d-client"
                                    items={clients}
                                    value={clientId}
                                    disabled={!draft}
                                    onValueChange={(v) => {
                                        setClientId(v);
                                        setProjectId(null);
                                        setFieldErrors((p) => ({ ...p, clientId: '' }));
                                    }}
                                    aria-invalid={Boolean(fieldErrors.clientId)}
                                />
                            </FormField>
                            <FormField id="d-project" label="Proyecto" error={fieldErrors.projectId}>
                                <EntitySelect
                                    id="d-project"
                                    items={projects}
                                    value={projectId}
                                    allowClear
                                    disabled={!draft || !clientId}
                                    placeholder="Sin proyecto"
                                    onValueChange={setProjectId}
                                />
                            </FormField>
                            <FormField id="d-expires" label="Caducidad">
                                <Input
                                    id="d-expires"
                                    type="date"
                                    value={expiresAt}
                                    disabled={!draft}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                />
                            </FormField>
                            {draft && (
                                <Button type="submit" className="w-fit" disabled={saving}>
                                    {saving ? 'Guardando…' : 'Guardar'}
                                </Button>
                            )}
                        </form>
                    </CardContent>
                </Card>
            )}

            {step === 'docs' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">PDFs del sobre</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {draft && (
                            <BillingFileDropzone
                                id="contract-pdfs"
                                accept=".pdf,application/pdf"
                                multiple
                                disabled={saving}
                                emptyHint="PDF · uno o varios · se suben al soltar"
                                onFiles={(files) => void onFiles(files)}
                            />
                        )}
                        {(contract.documents ?? []).length === 0 && !draft && (
                            <p className="text-sm text-muted-foreground">Aún no hay documentos.</p>
                        )}
                        <ul className="flex flex-col gap-2">
                            {(contract.documents ?? []).map((doc, i) => (
                                <li key={doc.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                                    <span className="min-w-0 flex-1 truncate">{doc.fileName}</span>
                                    <span className="text-xs text-muted-foreground">{doc.pageCount ?? '—'} pág.</span>
                                    {draft && (
                                        <>
                                            <Button type="button" size="icon-xs" variant="ghost" disabled={i === 0 || saving} onClick={() => void moveDoc(i, -1)}>
                                                <ChevronUp />
                                            </Button>
                                            <Button
                                                type="button"
                                                size="icon-xs"
                                                variant="ghost"
                                                disabled={i === (contract.documents?.length ?? 0) - 1 || saving}
                                                onClick={() => void moveDoc(i, 1)}
                                            >
                                                <ChevronDown />
                                            </Button>
                                            <Button
                                                type="button"
                                                size="icon-xs"
                                                variant="ghost"
                                                disabled={saving}
                                                onClick={() => {
                                                    void deleteDocument(contract.id, doc.id)
                                                        .then(() => reload())
                                                        .catch(toastError);
                                                }}
                                            >
                                                <Trash2 />
                                            </Button>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {step === 'signers' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Firmantes (orden de firma)</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {draft && (
                            <p className="text-sm text-muted-foreground">
                                BOcode (BOCODE DEVELOPERS SL · hola@bocode.es) va siempre. Añade al cliente u otros
                                firmantes.
                            </p>
                        )}
                        {draft && (
                            <form noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => void handleAddSigner(e)}>
                                <FormField id="s-name" label="Nombre" className="flex-1">
                                    <Input id="s-name" value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
                                </FormField>
                                <FormField id="s-email" label="Email" className="flex-1">
                                    <Input id="s-email" type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} required />
                                </FormField>
                                <Button type="submit" disabled={saving || !signerName.trim() || !signerEmail.trim()}>
                                    <Plus />
                                    Añadir
                                </Button>
                            </form>
                        )}
                        <ul className="flex flex-col gap-2">
                            {(contract.signers ?? []).map((s, i) => (
                                <li key={s.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                                    <span className="w-6 text-muted-foreground">{s.position}</span>
                                    <span className="min-w-0 flex-1 truncate">
                                        {s.name} · {s.email}
                                    </span>
                                    {isBocodeSigner(s) ? <Badge variant="outline">BOcode</Badge> : null}
                                    <Badge variant="outline">{s.status === 'signed' ? 'Firmado' : s.status === 'declined' ? 'Declinó' : 'Pendiente'}</Badge>
                                    {draft && (
                                        <>
                                            <Button type="button" size="icon-xs" variant="ghost" disabled={i === 0 || saving} onClick={() => void moveSigner(i, -1)}>
                                                <ChevronUp />
                                            </Button>
                                            <Button
                                                type="button"
                                                size="icon-xs"
                                                variant="ghost"
                                                disabled={i === (contract.signers?.length ?? 0) - 1 || saving}
                                                onClick={() => void moveSigner(i, 1)}
                                            >
                                                <ChevronDown />
                                            </Button>
                                            {!isBocodeSigner(s) ? (
                                                <Button
                                                    type="button"
                                                    size="icon-xs"
                                                    variant="ghost"
                                                    disabled={saving}
                                                    onClick={() => {
                                                        void deleteSigner(contract.id, s.id)
                                                            .then(() => reload())
                                                            .catch(toastError);
                                                    }}
                                                >
                                                    <Trash2 />
                                                </Button>
                                            ) : null}
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {step === 'fields' && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2">
                        <CardTitle className="text-base">Campos de firma</CardTitle>
                        {draft && (
                            <Button type="button" size="sm" disabled={saving || !fieldsDirty} onClick={() => void saveFields()}>
                                Guardar campos
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                            <ContractFieldEditor
                            blobUrl={blobUrl}
                            document={currentDoc}
                            documents={contract.documents ?? []}
                            signers={contract.signers ?? []}
                            fields={editorFields}
                            readOnly={!draft}
                            selectedSignerId={selectedSignerId}
                            onSelectSigner={setSelectedSignerId}
                            onSelectDocument={setDocId}
                            onChange={onEditorChange}
                            />
                        </Suspense>
                    </CardContent>
                </Card>
            )}

            {step === 'send' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Enviar sobre</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {draft ? (
                            <>
                                {blockers.length > 0 ? (
                                    <ul className="list-disc pl-5 text-sm text-muted-foreground">
                                        {blockers.map((b) => (
                                            <li key={b}>{b}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Se enviará un email al primer firmante. El resto firma en orden.
                                    </p>
                                )}
                                <Button type="button" className="w-fit" disabled={saving || blockers.length > 0} onClick={() => setConfirm('send')}>
                                    Enviar a firmar
                                </Button>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">Este sobre ya no está en borrador.</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {(contract.events ?? []).length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Eventos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ol className="flex flex-col gap-2 text-sm">
                            {(contract.events ?? []).map((ev) => (
                                <li key={ev.id} className="flex flex-wrap gap-2 border-b border-border/60 py-1 last:border-0">
                                    <span className="text-muted-foreground">{formatWhen(ev.createdAt)}</span>
                                    <span>{CONTRACT_EVENT_LABELS[ev.type] ?? ev.type}</span>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
            )}

            <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{confirm === 'send' ? 'Enviar sobre' : 'Cancelar sobre'}</DialogTitle>
                        <DialogDescription>
                            {confirm === 'send'
                                ? 'Se enviará el enlace de firma al primer firmante. No podrás editar documentos ni campos.'
                                : 'Los enlaces de firma dejarán de valer.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setConfirm(null)} disabled={saving}>
                            Volver
                        </Button>
                        {confirm === 'send' ? (
                            <Button type="button" disabled={saving} onClick={() => void handleSend()}>
                                {saving ? 'Enviando…' : 'Enviar'}
                            </Button>
                        ) : (
                            <Button type="button" variant="destructive" disabled={saving} onClick={() => void handleCancel()}>
                                {saving ? 'Cancelando…' : 'Cancelar sobre'}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
