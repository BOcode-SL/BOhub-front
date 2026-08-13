import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import {
    CONTRACT_FIELD_TYPE_LABELS,
    type ContractDocument,
    type ContractField,
} from '@/lib/contracts';
import { isRenderCancelled, renderPdfPage, useFitWidth, usePdfJsDocument } from '@/lib/pdfJsPreview';
import { toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';

type FieldValue = { pngBase64?: string; value?: string };

type Props = {
    blobUrls: Record<number, string>;
    documents: ContractDocument[];
    fields: ContractField[];
    values: Record<number, FieldValue>;
    onEndVisible?: () => void;
};

export function SignPdfViewer({ blobUrls, documents, fields, values, onEndVisible }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const width = useFitWidth(containerRef);
    const blobsReady = documents.length > 0 && documents.every((d) => blobUrls[d.id]);

    function jumpToDoc(id: number) {
        document.getElementById(`sign-doc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    return (
        <div className="flex flex-col gap-3">
            {documents.length > 1 ? (
                <nav className="flex flex-wrap gap-2" aria-label="Documentos">
                    {documents.map((d) => (
                        <button
                            key={d.id}
                            type="button"
                            className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            onClick={() => jumpToDoc(d.id)}
                        >
                            {d.fileName}
                        </button>
                    ))}
                </nav>
            ) : null}
            <div ref={containerRef} className="min-w-0">
                {documents.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">Cargando documento…</p>
                ) : (
                    <div className="flex flex-col gap-10">
                        {documents.map((doc, i) => (
                            <SignDocumentPages
                                key={doc.id}
                                document={doc}
                                blobUrl={blobUrls[doc.id] ?? null}
                                width={width}
                                fields={fields.filter((f) => f.documentId === doc.id)}
                                values={values}
                                showEndSentinel={blobsReady && i === documents.length - 1}
                                onEndVisible={onEndVisible}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function SignDocumentPages({
    document,
    blobUrl,
    width,
    fields,
    values,
    showEndSentinel,
    onEndVisible,
}: {
    document: ContractDocument;
    blobUrl: string | null;
    width: number;
    fields: ContractField[];
    values: Record<number, FieldValue>;
    showEndSentinel?: boolean;
    onEndVisible?: () => void;
}) {
    const pdf = usePdfJsDocument(blobUrl);
    const pageCount = pdf?.numPages ?? 0;
    const sentinelRef = useRef<HTMLDivElement>(null);
    const pagesReady = !!pdf && pageCount > 0 && width > 0;

    useEffect(() => {
        if (!showEndSentinel || !pagesReady || !onEndVisible) return;
        const el = sentinelRef.current;
        if (!el) return;
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) onEndVisible();
            },
            { threshold: 0 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [showEndSentinel, pagesReady, onEndVisible]);

    return (
        <section id={`sign-doc-${document.id}`} className="scroll-mt-4">
            <h3 className="mb-3 truncate text-xs text-muted-foreground">{document.fileName}</h3>
            {!blobUrl ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Cargando PDF…</p>
            ) : !pdf || width < 1 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Leyendo PDF…</p>
            ) : (
                <div className="flex flex-col gap-6">
                    {/* ponytail: all pages off one proxy. If a 50-page envelope lags, IntersectionObserver. */}
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
                        <SignPdfPage
                            key={`${document.id}-${page}`}
                            pdf={pdf}
                            page={page}
                            width={width}
                            fields={fields.filter((f) => f.page === page)}
                            values={values}
                        />
                    ))}
                    {showEndSentinel ? (
                        <div ref={sentinelRef} className="h-2 w-full" aria-hidden />
                    ) : null}
                </div>
            )}
        </section>
    );
}

function SignPdfPage({
    pdf,
    page,
    width,
    fields,
    values,
}: {
    pdf: PDFDocumentProxy;
    page: number;
    width: number;
    fields: ContractField[];
    values: Record<number, FieldValue>;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cssH, setCssH] = useState(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || width < 1) return;
        let cancelled = false;
        let renderTask: RenderTask | null = null;
        void renderPdfPage(pdf, page, canvas, width)
            .then(async ({ height, task }) => {
                renderTask = task;
                if (cancelled) {
                    task.cancel();
                    return;
                }
                setCssH(height);
                await task.promise;
            })
            .catch((err) => {
                if (cancelled || isRenderCancelled(err)) return;
                toastError(err, `No se pudo renderizar la página ${page}.`);
            });
        return () => {
            cancelled = true;
            renderTask?.cancel();
        };
    }, [pdf, page, width]);

    return (
        <div className="relative mx-auto" style={{ width }}>
            <div
                className="relative overflow-hidden bg-white shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
                style={{ width, height: cssH || 80 }}
            >
                <span className="pointer-events-none absolute top-2 right-2 z-10 rounded bg-[#1a1d1e]/70 px-1.5 py-0.5 text-[10px] text-white">
                    {page}
                </span>
                {cssH < 1 ? (
                    <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                        Pintando página {page}…
                    </p>
                ) : null}
                <canvas ref={canvasRef} className="block bg-white" />
                <div className="absolute inset-0">
                    {fields.map((field) => {
                        const filled = Boolean(values[field.id]?.pngBase64 || values[field.id]?.value);
                        return (
                            <div
                                key={field.id}
                                className={cn(
                                    'absolute box-border overflow-hidden rounded-sm border-2 text-left text-[10px] leading-tight',
                                    filled
                                        ? 'border-primary bg-primary/20 text-primary-foreground'
                                        : 'border-amber-400 bg-amber-400/30 text-[#24292a]',
                                )}
                                style={{
                                    left: `${Number(field.xPct)}%`,
                                    top: `${Number(field.yPct)}%`,
                                    width: `${Number(field.wPct)}%`,
                                    height: `${Number(field.hPct)}%`,
                                }}
                            >
                                {field.type === 'signature' && values[field.id]?.pngBase64 ? (
                                    <img
                                        src={values[field.id].pngBase64}
                                        alt=""
                                        className="h-full w-full object-contain"
                                    />
                                ) : (
                                    <span className="block truncate px-1 py-0.5 font-medium">
                                        {values[field.id]?.value ||
                                            field.label ||
                                            CONTRACT_FIELD_TYPE_LABELS[field.type]}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/** Crop white canvas to ink bbox (+8px CSS pad). Null if no ink. */
function cropInkToDataUrl(canvas: HTMLCanvasElement): string | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const w = canvas.width;
    const h = canvas.height;
    if (w < 1 || h < 1) return null;
    const { data } = ctx.getImageData(0, 0, w, h);
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 16) continue;
        if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) continue;
        const p = i / 4;
        const x = p % w;
        const y = (p / w) | 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    if (maxX < 0) return null;
    const pad = Math.round(8 * (window.devicePixelRatio || 1));
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    const octx = out.getContext('2d');
    if (!octx) return null;
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, cw, ch);
    octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
    return out.toDataURL('image/png');
}

/** Draw signature → PNG data URL. Parent wraps (Sheet). */
export function SignaturePad({ onConfirm }: { onConfirm: (dataUrl: string) => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [hasInk, setHasInk] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const el = canvas;
        const g = ctx;
        let inited = false;
        function paint() {
            if (inited) return;
            const w = el.clientWidth;
            const h = el.clientHeight;
            if (w < 1 || h < 1) return;
            inited = true;
            const dpr = window.devicePixelRatio || 1;
            el.width = Math.floor(w * dpr);
            el.height = Math.floor(h * dpr);
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.fillStyle = '#ffffff';
            g.fillRect(0, 0, w, h);
            g.strokeStyle = '#1a1d1e';
            g.lineWidth = 2;
            g.lineCap = 'round';
            g.lineJoin = 'round';
            setHasInk(false);
        }
        paint();
        const ro = new ResizeObserver(paint);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    function pos(e: ReactPointerEvent<HTMLCanvasElement>) {
        const canvas = canvasRef.current!;
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        canvas.setPointerCapture(e.pointerId);
        drawing.current = true;
        const p = pos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    }

    function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
        if (!drawing.current) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        const p = pos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        setHasInk(true);
    }

    function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
        drawing.current = false;
        try {
            canvasRef.current?.releasePointerCapture(e.pointerId);
        } catch {
            /* ignore */
        }
    }

    function clear() {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        setHasInk(false);
    }

    return (
        <div className="mx-auto w-full max-w-lg">
            <canvas
                ref={canvasRef}
                className="mx-auto h-36 w-full touch-none rounded-md border border-border bg-white sm:h-40"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
            />
            <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button
                    type="button"
                    className="cursor-pointer rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                    onClick={clear}
                >
                    Limpiar
                </button>
                <button
                    type="button"
                    className="cursor-pointer rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    disabled={!hasInk}
                    onClick={() => {
                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        const dataUrl = cropInkToDataUrl(canvas);
                        if (dataUrl) onConfirm(dataUrl);
                    }}
                >
                    Usar firma
                </button>
            </div>
        </div>
    );
}
