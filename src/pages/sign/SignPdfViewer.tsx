import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { getDocument, GlobalWorkerOptions, type RenderTask } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
    CONTRACT_FIELD_TYPE_LABELS,
    type ContractDocument,
    type ContractField,
} from '@/lib/contracts';
import { toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';

GlobalWorkerOptions.workerSrc = workerSrc;

type FieldValue = { pngBase64?: string; value?: string };

type Props = {
    blobUrl: string | null;
    document: ContractDocument | null;
    fields: ContractField[];
    values: Record<number, FieldValue>;
    onFieldClick: (field: ContractField) => void;
};

export function SignPdfViewer({ blobUrl, document, fields, values, onFieldClick }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pageCount, setPageCount] = useState(1);
    const [width, setWidth] = useState(640);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setWidth(Math.max(280, el.clientWidth)));
        ro.observe(el);
        setWidth(Math.max(280, el.clientWidth));
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (!blobUrl) {
            setPageCount(1);
            return;
        }
        const task = getDocument({ url: blobUrl });
        let cancelled = false;
        void task.promise
            .then((pdf) => {
                if (!cancelled) setPageCount(pdf.numPages);
            })
            .catch((err) => {
                if (!cancelled) toastError(err, 'No se pudo leer el PDF.');
            });
        return () => {
            cancelled = true;
            void task.destroy();
        };
    }, [blobUrl]);

    const docFields = document ? fields.filter((f) => f.documentId === document.id) : [];

    return (
        <div ref={containerRef} className="min-w-0 overflow-x-auto rounded-md border border-border bg-muted/20 p-2">
            {!blobUrl || !document ? (
                <p className="p-8 text-center text-sm text-muted-foreground">Cargando documento…</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
                        <SignPdfPage
                            key={`${document.id}-${page}-${blobUrl}`}
                            blobUrl={blobUrl}
                            page={page}
                            width={width - 16}
                            fields={docFields.filter((f) => f.page === page)}
                            values={values}
                            onFieldClick={onFieldClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function SignPdfPage({
    blobUrl,
    page,
    width,
    fields,
    values,
    onFieldClick,
}: {
    blobUrl: string;
    page: number;
    width: number;
    fields: ContractField[];
    values: Record<number, FieldValue>;
    onFieldClick: (field: ContractField) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cssH, setCssH] = useState(400);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const task = getDocument({ url: blobUrl });
        let cancelled = false;
        let renderTask: RenderTask | null = null;
        void task.promise
            .then(async (pdf) => {
                const pdfPage = await pdf.getPage(page);
                if (cancelled) return;
                const unscaled = pdfPage.getViewport({ scale: 1 });
                const scale = width / unscaled.width;
                const viewport = pdfPage.getViewport({ scale });
                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                setCssH(viewport.height);
                renderTask = pdfPage.render({ canvas, viewport });
                await renderTask.promise;
            })
            .catch((err) => {
                if (cancelled) return;
                toastError(err, `No se pudo renderizar la página ${page}.`);
            });
        return () => {
            cancelled = true;
            renderTask?.cancel();
            void task.destroy();
        };
    }, [blobUrl, page, width]);

    return (
        <div className="relative mx-auto" style={{ width }}>
            <p className="mb-1 text-xs text-muted-foreground">Página {page}</p>
            <div className="relative" style={{ width, height: cssH }}>
                <canvas ref={canvasRef} className="block h-full w-full bg-white" />
                <div className="absolute inset-0">
                    {fields.map((field) => {
                        const filled = Boolean(values[field.id]?.pngBase64 || values[field.id]?.value);
                        return (
                            <button
                                key={field.id}
                                type="button"
                                className={cn(
                                    'absolute box-border cursor-pointer overflow-hidden rounded-sm border-2 text-left text-[10px] leading-tight',
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
                                onClick={() => onFieldClick(field)}
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
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/** Draw signature → PNG data URL. */
export function SignaturePad({
    open,
    onClose,
    onConfirm,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: (dataUrl: string) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [hasInk, setHasInk] = useState(false);

    useEffect(() => {
        if (!open) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#1a1d1e';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        setHasInk(false);
    }, [open]);

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

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
            <div
                role="dialog"
                aria-modal
                aria-label="Dibujar firma"
                className="w-full max-w-lg rounded-xl border border-border bg-card p-4 shadow-xl"
            >
                <p className="mb-2 text-sm font-medium text-foreground">Dibuja tu firma</p>
                <canvas
                    ref={canvasRef}
                    className="h-40 w-full touch-none rounded-md border border-border bg-white"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                />
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        className="cursor-pointer rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                        onClick={clear}
                    >
                        Limpiar
                    </button>
                    <button
                        type="button"
                        className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                        onClick={onClose}
                    >
                        Cancelar
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
        </div>
    );
}
