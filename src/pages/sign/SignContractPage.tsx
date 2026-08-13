import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
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
    const [blobUrls, setBlobUrls] = useState<Record<number, string>>({});
    const [values, setValues] = useState<Record<number, FieldValue>>({});
    const [consent, setConsent] = useState(false);
    const [hasReadToEnd, setHasReadToEnd] = useState(false);
    const [busy, setBusy] = useState(false);
    const [finalStatus, setFinalStatus] = useState<string | null>(null);
    const [declineOpen, setDeclineOpen] = useState(false);
    const [declineReason, setDeclineReason] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const markReadToEnd = useCallback(() => setHasReadToEnd(true), []);

    useEffect(() => {
        if (!token) {
            setScreen('gone');
            return;
        }
        const ac = new AbortController();
        let cancelled = false;
        setScreen('loading');
        setHasReadToEnd(false);
        setConsent(false);
        void getSignMeta(token, ac.signal)
            .then((data) => {
                if (cancelled) return;
                setMeta(data);
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

    const docIdsKey = (meta?.documents ?? []).map((d) => d.id).join(',');

    useEffect(() => {
        if (!token || screen !== 'ready' || !docIdsKey) {
            setBlobUrls({});
            return;
        }
        const docs = meta?.documents ?? [];
        let cancelled = false;
        const created: string[] = [];
        void Promise.all(
            docs.map(async (d) => {
                const blob = await getSignDocumentBlob(token, d.id);
                if (cancelled) return null;
                const url = URL.createObjectURL(blob);
                created.push(url);
                return [d.id, url] as const;
            }),
        )
            .then((pairs) => {
                if (cancelled) {
                    created.forEach((u) => URL.revokeObjectURL(u));
                    return;
                }
                const next: Record<number, string> = {};
                for (const p of pairs) {
                    if (p) next[p[0]] = p[1];
                }
                setBlobUrls(next);
            })
            .catch((err) => {
                if (!cancelled) toastError(err, 'No se pudo cargar el PDF.');
            });
        return () => {
            cancelled = true;
            created.forEach((u) => URL.revokeObjectURL(u));
            setBlobUrls({});
        };
        // ponytail: docIdsKey, not full meta
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, screen, docIdsKey]);

    const allFilled = !!meta && meta.fields.every((f) => fieldFilled(f, values[f.id]));
    const hasSignatureFields = !!meta && meta.fields.some((f) => f.type === 'signature');

    function applySignature(dataUrl: string) {
        if (!meta) return;
        setValues((prev) => {
            const next = { ...prev };
            for (const f of meta.fields) {
                if (f.type === 'signature') next[f.id] = { pngBase64: dataUrl };
            }
            return next;
        });
    }

    async function submitSign() {
        if (!meta || !token || !consent || !allFilled || !hasReadToEnd) return;
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
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">BOcode · Firma electrónica</p>
                        {meta ? (
                            <p className="truncate text-xs text-muted-foreground">{meta.title}</p>
                        ) : null}
                    </div>
                    {screen === 'ready' ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cursor-pointer shrink-0"
                            disabled={busy}
                            onClick={() => setDeclineOpen(true)}
                        >
                            Rechazar
                        </Button>
                    ) : null}
                </div>
            </header>

            <div
                className={
                    screen === 'ready'
                        ? hasReadToEnd
                            ? 'mx-auto max-w-4xl px-4 py-6 pb-[min(90vh,28rem)]'
                            : 'mx-auto max-w-4xl px-4 py-6 pb-24'
                        : 'mx-auto max-w-4xl px-4 py-6'
                }
            >
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

                        <p className="text-xs text-muted-foreground">
                            Recorre el sobre hasta el final. Una sola firma se aplica a todos los campos.
                        </p>

                        <SignPdfViewer
                            blobUrls={blobUrls}
                            documents={meta.documents}
                            fields={meta.fields}
                            values={values}
                            onEndVisible={markReadToEnd}
                        />
                    </div>
                )}
            </div>

            {screen === 'ready' && meta ? (
                <Sheet open modal={false} disablePointerDismissal onOpenChange={() => {}}>
                    <SheetContent
                        side="bottom"
                        showOverlay={false}
                        showCloseButton={false}
                        initialFocus={false}
                        className="max-h-[min(85vh,32rem)] gap-0 overflow-y-auto sm:max-w-none"
                    >
                        <SheetHeader>
                            <SheetTitle className="text-sm font-medium">
                                Desplázate hasta el final del documento para firmar.
                            </SheetTitle>
                            {hasReadToEnd ? (
                                <SheetDescription>
                                    Esta firma se usará en todos los campos
                                </SheetDescription>
                            ) : null}
                        </SheetHeader>
                        {hasReadToEnd ? (
                            <>
                                {hasSignatureFields ? (
                                    <div className="px-4">
                                        <SignaturePad onConfirm={applySignature} />
                                    </div>
                                ) : null}
                                <div className="space-y-2 px-4">
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
                                </div>
                                <SheetFooter className="flex-row flex-wrap justify-end gap-2">
                                    <Button
                                        type="button"
                                        className="cursor-pointer"
                                        disabled={!allFilled || !consent || busy}
                                        onClick={() => void submitSign()}
                                    >
                                        {busy ? 'Enviando…' : 'Firmar'}
                                    </Button>
                                </SheetFooter>
                            </>
                        ) : null}
                    </SheetContent>
                </Sheet>
            ) : null}

            {declineOpen ? (
                <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/60 p-4 sm:items-center">
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
