import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import {
    getSignDocumentBlob,
    getSignMeta,
    postSign,
    postSignDecline,
    postSignView,
    signErrorCurrentEmail,
    type SignMeta,
} from '@/lib/contractSign';
import type { ContractField } from '@/lib/contracts';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { SignPdfViewer, SignaturePad } from '@/pages/sign/SignPdfViewer';

type FieldValue = { pngBase64?: string; value?: string };
type Screen = 'loading' | 'ready' | 'waiting' | 'gone' | 'success' | 'declined';

function todayDdMmYyyy(): string {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}

function fieldFilled(field: ContractField, v: FieldValue | undefined): boolean {
    if (!v) return false;
    if (field.type === 'signature') return Boolean(v.pngBase64);
    return Boolean(v.value?.trim());
}

export function SignContractPage() {
    const { token = '' } = useParams<{ token: string }>();
    const [screen, setScreen] = useState<Screen>('loading');
    const [meta, setMeta] = useState<SignMeta | null>(null);
    const [waitEmail, setWaitEmail] = useState<string | null>(null);
    const [goneMsg, setGoneMsg] = useState('Enlace inválido, usado o caducado.');
    const [docId, setDocId] = useState<number | null>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [values, setValues] = useState<Record<number, FieldValue>>({});
    const [consent, setConsent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [finalStatus, setFinalStatus] = useState<string | null>(null);
    const [activeField, setActiveField] = useState<ContractField | null>(null);
    const [textDraft, setTextDraft] = useState('');
    const [declineOpen, setDeclineOpen] = useState(false);
    const [declineReason, setDeclineReason] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!token) {
            setScreen('gone');
            return;
        }
        const ac = new AbortController();
        let cancelled = false;
        setScreen('loading');
        void getSignMeta(token, ac.signal)
            .then((data) => {
                if (cancelled) return;
                setMeta(data);
                setDocId(data.documents[0]?.id ?? null);
                const initial: Record<number, FieldValue> = {};
                for (const f of data.fields) {
                    if (f.type === 'date') initial[f.id] = { value: todayDdMmYyyy() };
                    else if (f.type === 'name') initial[f.id] = { value: data.signer.name };
                }
                setValues(initial);
                setScreen('ready');
                void postSignView(token).catch(() => {
                    /* fire-and-forget */
                });
            })
            .catch((err) => {
                if (cancelled) return;
                if (err instanceof ApiError && err.status === 409) {
                    setWaitEmail(signErrorCurrentEmail(err));
                    setScreen('waiting');
                    return;
                }
                if (err instanceof ApiError && (err.status === 410 || err.status === 404)) {
                    setGoneMsg(err.message || 'Enlace inválido, usado o caducado.');
                    setScreen('gone');
                    return;
                }
                toastError(err);
                setGoneMsg(err instanceof Error ? err.message : 'No se pudo cargar el sobre.');
                setScreen('gone');
            });
        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [token]);

    useEffect(() => {
        if (!token || !docId || screen !== 'ready') {
            setBlobUrl(null);
            return;
        }
        let objectUrl: string | null = null;
        let cancelled = false;
        void getSignDocumentBlob(token, docId)
            .then((blob) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setBlobUrl(objectUrl);
            })
            .catch((err) => {
                if (!cancelled) toastError(err, 'No se pudo cargar el PDF.');
            });
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [token, docId, screen]);

    const activeDoc = useMemo(
        () => meta?.documents.find((d) => d.id === docId) ?? null,
        [meta, docId],
    );

    const allFilled =
        !!meta && meta.fields.every((f) => fieldFilled(f, values[f.id]));

    function openField(field: ContractField) {
        setActiveField(field);
        if (field.type === 'date') {
            setTextDraft(values[field.id]?.value || todayDdMmYyyy());
        } else if (field.type === 'name') {
            setTextDraft(values[field.id]?.value || meta?.signer.name || '');
        }
    }

    async function submitSign() {
        if (!meta || !token || !consent || !allFilled) return;
        setBusy(true);
        setFieldErrors({});
        try {
            const fields = meta.fields.map((f) => {
                const v = values[f.id] ?? {};
                if (f.type === 'signature') return { fieldId: f.id, pngBase64: v.pngBase64 };
                return { fieldId: f.id, value: v.value };
            });
            const res = await postSign(token, {
                consent: true,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                fields,
            });
            setFinalStatus(res.status);
            setScreen('success');
            toastSuccess('Firma registrada');
        } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
                setWaitEmail(signErrorCurrentEmail(err));
                setScreen('waiting');
            } else if (err instanceof ApiError && err.status === 410) {
                setGoneMsg(err.message);
                setScreen('gone');
            } else if (err instanceof ApiError && err.fieldErrors) {
                setFieldErrors(flattenFieldErrors(err.fieldErrors));
                toastError(err);
            } else {
                toastError(err);
            }
        } finally {
            setBusy(false);
        }
    }

    async function submitDecline() {
        if (!token) return;
        setBusy(true);
        try {
            await postSignDecline(token, declineReason.trim() || undefined);
            setDeclineOpen(false);
            setScreen('declined');
        } catch (err) {
            toastError(err);
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#1a1d1e] text-foreground">
            <header className="border-b border-border px-4 py-4">
                <div className="mx-auto flex max-w-4xl items-center gap-3">
                    <span className="rounded bg-primary px-2 py-0.5 text-xs font-bold tracking-wide text-primary-foreground">
                        BO
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium">BOcode · Firma electrónica</p>
                        {meta ? (
                            <p className="truncate text-xs text-muted-foreground">{meta.title}</p>
                        ) : null}
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-4xl px-4 py-6">
                {screen === 'loading' && (
                    <p className="text-sm text-muted-foreground">Cargando documento…</p>
                )}

                {screen === 'waiting' && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6">
                        <h1 className="text-lg font-medium text-foreground">Aún no es tu turno</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Debe firmar antes otro participante
                            {waitEmail ? (
                                <>
                                    {' '}
                                    (<span className="text-foreground">{waitEmail}</span>)
                                </>
                            ) : null}
                            . Vuelve a abrir este enlace más tarde.
                        </p>
                    </div>
                )}

                {screen === 'gone' && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6">
                        <h1 className="text-lg font-medium text-foreground">Enlace no disponible</h1>
                        <p className="mt-2 text-sm text-muted-foreground">{goneMsg}</p>
                    </div>
                )}

                {screen === 'declined' && (
                    <div className="rounded-xl border border-border bg-card/50 p-6">
                        <h1 className="text-lg font-medium">Firma rechazada</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Has declinado firmar este sobre. Puedes cerrar esta ventana.
                        </p>
                    </div>
                )}

                {screen === 'success' && (
                    <div className="rounded-xl border border-primary/40 bg-primary/10 p-6">
                        <h1 className="text-lg font-medium text-foreground">Documento firmado</h1>
                        {finalStatus === 'signed' ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Sobre completado. Todos los firmantes han firmado.
                            </p>
                        ) : (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Tu firma quedó registrada. Faltan otros firmantes para cerrar el sobre.
                            </p>
                        )}
                    </div>
                )}

                {screen === 'ready' && meta && (
                    <div className="space-y-5">
                        <div>
                            <h1 className="text-xl font-medium text-foreground">{meta.title}</h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Firmante: {meta.signer.name} · {meta.signer.email}
                                {meta.expiresAt ? ` · Caduca ${meta.expiresAt}` : ''}
                            </p>
                        </div>

                        {meta.documents.length > 1 ? (
                            <nav className="flex flex-wrap gap-2" aria-label="Documentos">
                                {meta.documents.map((d) => (
                                    <button
                                        key={d.id}
                                        type="button"
                                        className={cn(
                                            'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors',
                                            docId === d.id
                                                ? 'bg-sidebar-accent font-medium text-primary'
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                        )}
                                        onClick={() => setDocId(d.id)}
                                    >
                                        {d.fileName}
                                    </button>
                                ))}
                            </nav>
                        ) : null}

                        <p className="text-xs text-muted-foreground">
                            Pulsa cada campo marcado para completar tu firma, fecha o nombre.
                        </p>

                        <SignPdfViewer
                            blobUrl={blobUrl}
                            document={activeDoc}
                            fields={meta.fields}
                            values={values}
                            onFieldClick={openField}
                        />

                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                            <input
                                type="checkbox"
                                className="mt-1 size-4 accent-primary"
                                checked={consent}
                                onChange={(e) => setConsent(e.target.checked)}
                                disabled={busy}
                            />
                            <span className="text-muted-foreground">{meta.consentText}</span>
                        </label>
                        {fieldErrors.consent ? (
                            <p className="text-sm text-destructive">{fieldErrors.consent}</p>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                className="cursor-pointer"
                                disabled={!allFilled || !consent || busy}
                                onClick={() => void submitSign()}
                            >
                                {busy ? 'Enviando…' : 'Firmar'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="cursor-pointer"
                                disabled={busy}
                                onClick={() => setDeclineOpen(true)}
                            >
                                Rechazar
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <SignaturePad
                open={activeField?.type === 'signature'}
                onClose={() => setActiveField(null)}
                onConfirm={(dataUrl) => {
                    if (!activeField) return;
                    setValues((prev) => ({ ...prev, [activeField.id]: { pngBase64: dataUrl } }));
                    setActiveField(null);
                }}
            />

            {activeField && activeField.type !== 'signature' ? (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
                    <div
                        role="dialog"
                        aria-modal
                        className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-xl"
                    >
                        <Label htmlFor="sign-field-value" className="text-sm font-medium">
                            {activeField.type === 'date' ? 'Fecha' : 'Nombre'}
                        </Label>
                        <Input
                            id="sign-field-value"
                            className="mt-2 bg-background"
                            value={textDraft}
                            onChange={(e) => setTextDraft(e.target.value)}
                            autoFocus
                        />
                        <div className="mt-3 flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setActiveField(null)}>
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    setValues((prev) => ({
                                        ...prev,
                                        [activeField.id]: { value: textDraft.trim() },
                                    }));
                                    setActiveField(null);
                                }}
                            >
                                Guardar
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}

            {declineOpen ? (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
                    <div role="dialog" aria-modal className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-xl">
                        <p className="text-sm font-medium">¿Rechazar la firma?</p>
                        <p className="mt-1 text-xs text-muted-foreground">Motivo opcional</p>
                        <Input
                            className="mt-2 bg-background"
                            value={declineReason}
                            onChange={(e) => setDeclineReason(e.target.value)}
                            placeholder="Motivo…"
                        />
                        <div className="mt-3 flex justify-end gap-2">
                            <Button type="button" variant="outline" disabled={busy} onClick={() => setDeclineOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={busy}
                                onClick={() => void submitDecline()}
                            >
                                Confirmar rechazo
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </main>
    );
}
