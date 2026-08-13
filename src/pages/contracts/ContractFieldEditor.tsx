import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { getDocument, GlobalWorkerOptions, type RenderTask } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from '@/components/ui/button';
import { AppSelect } from '@/components/app-select';
import {
    CONTRACT_FIELD_TYPE_LABELS,
    signerColor,
    type ContractDocument,
    type ContractFieldInput,
    type ContractFieldType,
    type ContractSigner,
} from '@/lib/contracts';
import { toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';

GlobalWorkerOptions.workerSrc = workerSrc;

type EditorField = ContractFieldInput & { key: string };

type DragState = {
    key: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    orig: { xPct: number; yPct: number; wPct: number; hPct: number };
    boxW: number;
    boxH: number;
};

type Props = {
    blobUrl: string | null;
    document: ContractDocument | null;
    documents: ContractDocument[];
    signers: ContractSigner[];
    fields: EditorField[];
    readOnly?: boolean;
    selectedSignerId: number | null;
    onSelectSigner: (id: number) => void;
    onSelectDocument: (id: number) => void;
    onChange: (fields: EditorField[]) => void;
};

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

function defaultSize(type: ContractFieldType): { wPct: number; hPct: number } {
    if (type === 'signature') return { wPct: 28, hPct: 10 };
    if (type === 'date') return { wPct: 18, hPct: 5 };
    return { wPct: 22, hPct: 5 };
}

function nextSignatureLabel(fields: EditorField[]): string {
    const n = fields.filter((f) => f.type === 'signature').length + 1;
    return `CAMPO DE FIRMA ${n}`;
}

export function ContractFieldEditor({
    blobUrl,
    document,
    documents,
    signers,
    fields,
    readOnly,
    selectedSignerId,
    onSelectSigner,
    onSelectDocument,
    onChange,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pageCount, setPageCount] = useState(1);
    const [width, setWidth] = useState(640);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const fieldsRef = useRef(fields);
    const onChangeRef = useRef(onChange);
    fieldsRef.current = fields;
    onChangeRef.current = onChange;

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

    useEffect(() => {
        function onMove(e: PointerEvent) {
            const drag = dragRef.current;
            if (!drag) return;
            const dx = ((e.clientX - drag.startX) / drag.boxW) * 100;
            const dy = ((e.clientY - drag.startY) / drag.boxH) * 100;
            onChangeRef.current(
                fieldsRef.current.map((f) => {
                    if (f.key !== drag.key) return f;
                    if (drag.mode === 'move') {
                        return {
                            ...f,
                            xPct: clamp(drag.orig.xPct + dx, 0, 100 - drag.orig.wPct),
                            yPct: clamp(drag.orig.yPct + dy, 0, 100 - drag.orig.hPct),
                        };
                    }
                    return {
                        ...f,
                        wPct: clamp(drag.orig.wPct + dx, 8, 100 - f.xPct),
                        hPct: clamp(drag.orig.hPct + dy, 4, 100 - f.yPct),
                    };
                }),
            );
        }
        function onUp() {
            dragRef.current = null;
        }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, []);

    function addField(type: ContractFieldType) {
        if (!document || !selectedSignerId || readOnly) return;
        const size = defaultSize(type);
        const offset = fields.filter((f) => f.documentId === document.id).length * 3;
        const next: EditorField = {
            key: `tmp-${Date.now()}`,
            documentId: document.id,
            signerId: selectedSignerId,
            type,
            page: 1,
            xPct: clamp(10 + offset, 0, 70),
            yPct: clamp(72 + (offset % 12), 0, 85),
            wPct: size.wPct,
            hPct: size.hPct,
            label: type === 'signature' ? nextSignatureLabel(fields) : type === 'date' ? 'Fecha' : 'Nombre',
            position: fields.length + 1,
        };
        onChange([...fields, next]);
        setSelectedKey(next.key);
    }

    function startDrag(e: ReactPointerEvent, field: EditorField, mode: 'move' | 'resize', pageEl: HTMLElement) {
        if (readOnly) return;
        e.preventDefault();
        e.stopPropagation();
        setSelectedKey(field.key);
        const rect = pageEl.getBoundingClientRect();
        dragRef.current = {
            key: field.key,
            mode,
            startX: e.clientX,
            startY: e.clientY,
            orig: { xPct: field.xPct, yPct: field.yPct, wPct: field.wPct, hPct: field.hPct },
            boxW: rect.width,
            boxH: rect.height,
        };
    }

    const docFields = fields.filter((f) => document && f.documentId === document.id);

    return (
        <div className="flex flex-col gap-3">
            {documents.length > 1 && (
                <nav aria-label="Documentos" className="flex flex-wrap gap-2">
                    {documents.map((d) => (
                        <button
                            key={d.id}
                            type="button"
                            className={cn(
                                'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                                document?.id === d.id
                                    ? 'bg-sidebar-accent font-medium text-primary'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                            onClick={() => onSelectDocument(d.id)}
                        >
                            {d.fileName}
                        </button>
                    ))}
                </nav>
            )}

            {!readOnly && (
                <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-40 flex-1">
                        <p className="mb-1 text-xs text-muted-foreground">Firmante</p>
                        <AppSelect
                            id="field-signer"
                            items={signers.map((s) => ({ label: `${s.position}. ${s.name}`, value: String(s.id) }))}
                            value={selectedSignerId ? String(selectedSignerId) : null}
                            onValueChange={(v) => {
                                if (v) onSelectSigner(Number(v));
                            }}
                            placeholder="Elegir firmante"
                        />
                    </div>
                    <Button type="button" size="sm" disabled={!selectedSignerId || !document} onClick={() => addField('signature')}>
                        Añadir firma
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={!selectedSignerId || !document} onClick={() => addField('date')}>
                        Fecha
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={!selectedSignerId || !document} onClick={() => addField('name')}>
                        Nombre
                    </Button>
                    {selectedKey && (
                        <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                                onChange(fields.filter((f) => f.key !== selectedKey));
                                setSelectedKey(null);
                            }}
                        >
                            Quitar caja
                        </Button>
                    )}
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {signers.map((s, i) => (
                    <span key={s.id} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="size-2.5 rounded-sm" style={{ backgroundColor: signerColor(i) }} aria-hidden />
                        {s.name}
                    </span>
                ))}
            </div>

            <div ref={containerRef} className="min-w-0 overflow-x-auto rounded-md border bg-muted/20 p-2">
                {!blobUrl || !document ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">Sube un PDF para colocar campos.</p>
                ) : (
                    <div className="flex flex-col gap-4">
                        {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
                            <PdfPage
                                key={`${document.id}-${page}-${blobUrl}`}
                                blobUrl={blobUrl}
                                page={page}
                                width={width - 16}
                                fields={docFields.filter((f) => f.page === page)}
                                signers={signers}
                                selectedKey={selectedKey}
                                readOnly={readOnly}
                                onSelect={setSelectedKey}
                                onPointerDown={startDrag}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function PdfPage({
    blobUrl,
    page,
    width,
    fields,
    signers,
    selectedKey,
    readOnly,
    onSelect,
    onPointerDown,
}: {
    blobUrl: string;
    page: number;
    width: number;
    fields: EditorField[];
    signers: ContractSigner[];
    selectedKey: string | null;
    readOnly?: boolean;
    onSelect: (key: string) => void;
    onPointerDown: (e: ReactPointerEvent, field: EditorField, mode: 'move' | 'resize', pageEl: HTMLElement) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
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
            <div className="relative" style={{ width, height: cssH }} ref={wrapRef}>
                <canvas ref={canvasRef} className="block h-full w-full bg-white" />
                <div className="absolute inset-0">
                    {fields.map((field) => {
                        const idx = signers.findIndex((s) => s.id === field.signerId);
                        const color = signerColor(idx < 0 ? 0 : idx);
                        const selected = selectedKey === field.key;
                        return (
                            <div
                                key={field.key}
                                role="button"
                                tabIndex={0}
                                className={cn(
                                    'absolute box-border overflow-hidden rounded-sm border-2 text-[10px] leading-tight select-none',
                                    selected ? 'z-10 ring-2 ring-primary' : 'z-0',
                                    readOnly ? 'cursor-default' : 'cursor-move',
                                )}
                                style={{
                                    left: `${field.xPct}%`,
                                    top: `${field.yPct}%`,
                                    width: `${field.wPct}%`,
                                    height: `${field.hPct}%`,
                                    borderColor: color,
                                    backgroundColor: `${color}33`,
                                    color: '#24292a',
                                }}
                                onPointerDown={(e) => {
                                    if (wrapRef.current) onPointerDown(e, field, 'move', wrapRef.current);
                                    onSelect(field.key);
                                }}
                            >
                                <span className="block truncate px-1 py-0.5 font-medium">
                                    {field.label || CONTRACT_FIELD_TYPE_LABELS[field.type]}
                                </span>
                                {!readOnly && (
                                    <span
                                        className="absolute right-0 bottom-0 size-3 cursor-se-resize bg-foreground/50"
                                        onPointerDown={(e) => {
                                            if (wrapRef.current) onPointerDown(e, field, 'resize', wrapRef.current);
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
