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
            <div ref={containerRef} className="min-w-0 overflow-x-auto rounded-md border border-border bg-muted/20 p-2">
                {documents.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">Cargando documento…</p>
                ) : (
                    <div className="flex flex-col gap-8">
                        {documents.map((doc, i) => (
                            <SignDocumentPages
                                key={doc.id}
                                document={doc}
                                blobUrl={blobUrls[doc.id] ?? null}
                                width={width > 16 ? width - 16 : 0}
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
            <h3 className="mb-3 truncate text-sm font-medium text-foreground">{document.fileName}</h3>
            {!blobUrl ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Cargando PDF…</p>
            ) : !pdf || width < 1 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Leyendo PDF…</p>
            ) : (
                <div className="flex flex-col gap-4">
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
            <p className="mb-1 text-xs text-muted-foreground">Página {page}</p>
            <div className="relative" style={{ width, height: cssH || 80 }}>
                {cssH < 1 ? (
                    <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                        Pintando página {page}…
                    </p>
                ) : null}
                <canvas ref={canvasRef} className="block h-full w-full bg-white" />
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
        <div>
            <canvas
                ref={canvasRef}
                className="h-32 w-full touch-none rounded-md border border-border bg-white sm:h-40"
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
                        const dataUrl = canvasRef.current?.toDataURL('image/png');
                        if (dataUrl) onConfirm(dataUrl);
                    }}
                >
                    Usar firma
                </button>
            </div>
        </div>
    );
}
