import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
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
import { isRenderCancelled, renderPdfPage, useFitWidth, usePdfJsDocument } from '@/lib/pdfJsPreview';
import { toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';

type EditorField = ContractFieldInput & { key: string };

type DragState = {
    key: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    orig: { xPct: number; yPct: number; wPct: number; hPct: number };
    boxW: number;
    boxH: number;
    moved: boolean;
};

type Props = {
    blobUrls: Record<number, string>;
    documents: ContractDocument[];
    signers: ContractSigner[];
    fields: EditorField[];
    readOnly?: boolean;
    selectedSignerId: number | null;
    onSelectSigner: (id: number) => void;
    onChange: (fields: EditorField[]) => void;
};

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

function defaultSize(type: ContractFieldType): { wPct: number; hPct: number } {
    // ponytail: ~32×6 % on A4 ≈ 3.8:1 — closer to pad + printed “firme aquí”. Admin still resizes.
    if (type === 'signature') return { wPct: 32, hPct: 6 };
    if (type === 'date') return { wPct: 18, hPct: 5 };
    return { wPct: 22, hPct: 5 };
}

function nextSignatureLabel(fields: EditorField[]): string {
    const n = fields.filter((f) => f.type === 'signature').length + 1;
    return `CAMPO DE FIRMA ${n}`;
}

export function ContractFieldEditor({
    blobUrls,
    documents,
    signers,
    fields,
    readOnly,
    selectedSignerId,
    onSelectSigner,
    onChange,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const width = useFitWidth(containerRef);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [placeType, setPlaceType] = useState<ContractFieldType>('signature');
    const dragRef = useRef<DragState | null>(null);
    const skipPageClickRef = useRef(false);
    const fieldsRef = useRef(fields);
    const onChangeRef = useRef(onChange);
    fieldsRef.current = fields;
    onChangeRef.current = onChange;

    useEffect(() => {
        function onMove(e: PointerEvent) {
            const drag = dragRef.current;
            if (!drag) return;
            const dx = ((e.clientX - drag.startX) / drag.boxW) * 100;
            const dy = ((e.clientY - drag.startY) / drag.boxH) * 100;
            if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 3) {
                drag.moved = true;
            }
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
            if (dragRef.current?.moved) skipPageClickRef.current = true;
            dragRef.current = null;
        }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, []);

    function placeField(documentId: number, page: number, xPct: number, yPct: number) {
        if (!selectedSignerId || readOnly) return;
        const size = defaultSize(placeType);
        const next: EditorField = {
            key: `tmp-${Date.now()}`,
            documentId,
            signerId: selectedSignerId,
            type: placeType,
            page,
            xPct: clamp(xPct - size.wPct / 2, 0, 100 - size.wPct),
            yPct: clamp(yPct - size.hPct / 2, 0, 100 - size.hPct),
            wPct: size.wPct,
            hPct: size.hPct,
            label: placeType === 'signature' ? nextSignatureLabel(fieldsRef.current) : placeType === 'date' ? 'Fecha' : 'Nombre',
            position: fieldsRef.current.length + 1,
        };
        onChange([...fieldsRef.current, next]);
        setSelectedKey(next.key);
    }

    function onPageClick(documentId: number, page: number, xPct: number, yPct: number) {
        if (skipPageClickRef.current) {
            skipPageClickRef.current = false;
            return;
        }
        placeField(documentId, page, xPct, yPct);
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
            moved: false,
        };
    }

    function jumpToDoc(id: number) {
        document.getElementById(`contract-doc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    return (
        <div className="flex flex-col gap-3">
            {documents.length > 1 && (
                <nav aria-label="Documentos" className="flex flex-wrap gap-2">
                    {documents.map((d) => (
                        <button
                            key={d.id}
                            type="button"
                            className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                            onClick={() => jumpToDoc(d.id)}
                        >
                            {d.fileName}
                        </button>
                    ))}
                </nav>
            )}

            {!readOnly && (
                <div className="flex flex-col gap-2">
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
                        <Button
                            type="button"
                            size="sm"
                            variant={placeType === 'signature' ? 'default' : 'outline'}
                            disabled={!selectedSignerId}
                            onClick={() => setPlaceType('signature')}
                        >
                            Firma
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={placeType === 'date' ? 'default' : 'outline'}
                            disabled={!selectedSignerId}
                            onClick={() => setPlaceType('date')}
                        >
                            Fecha
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={placeType === 'name' ? 'default' : 'outline'}
                            disabled={!selectedSignerId}
                            onClick={() => setPlaceType('name')}
                        >
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
                    <p className="text-xs text-muted-foreground">
                        Elige firmante y tipo, luego pulsa sobre el recuadro ya impreso en el PDF. Arrastra para
                        ajustar.
                    </p>
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
                {documents.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">Sube un PDF para colocar campos.</p>
                ) : (
                    <div className="flex flex-col gap-8">
                        {documents.map((doc) => (
                            <DocumentPages
                                key={doc.id}
                                document={doc}
                                blobUrl={blobUrls[doc.id] ?? null}
                                width={width > 16 ? width - 16 : 0}
                                fields={fields.filter((f) => f.documentId === doc.id)}
                                signers={signers}
                                selectedKey={selectedKey}
                                readOnly={readOnly}
                                canPlace={!!selectedSignerId && !readOnly}
                                onSelect={setSelectedKey}
                                onPointerDown={startDrag}
                                onPageClick={onPageClick}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function DocumentPages({
    document,
    blobUrl,
    width,
    fields,
    signers,
    selectedKey,
    readOnly,
    canPlace,
    onSelect,
    onPointerDown,
    onPageClick,
}: {
    document: ContractDocument;
    blobUrl: string | null;
    width: number;
    fields: EditorField[];
    signers: ContractSigner[];
    selectedKey: string | null;
    readOnly?: boolean;
    canPlace: boolean;
    onSelect: (key: string) => void;
    onPointerDown: (e: ReactPointerEvent, field: EditorField, mode: 'move' | 'resize', pageEl: HTMLElement) => void;
    onPageClick: (documentId: number, page: number, xPct: number, yPct: number) => void;
}) {
    const pdf = usePdfJsDocument(blobUrl);
    const pageCount = pdf?.numPages ?? 0;

    return (
        <section id={`contract-doc-${document.id}`} className="scroll-mt-4">
            <h3 className="mb-3 truncate text-sm font-medium text-foreground">{document.fileName}</h3>
            {!blobUrl ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Cargando PDF…</p>
            ) : !pdf || width < 1 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Leyendo PDF…</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {/* ponytail: all pages off one proxy. If a 50-page envelope lags, IntersectionObserver. */}
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
                        <PdfPage
                            key={`${document.id}-${page}`}
                            pdf={pdf}
                            page={page}
                            width={width}
                            fields={fields.filter((f) => f.page === page)}
                            signers={signers}
                            selectedKey={selectedKey}
                            readOnly={readOnly}
                            canPlace={canPlace}
                            onSelect={onSelect}
                            onPointerDown={onPointerDown}
                            onPageClick={(p, x, y) => onPageClick(document.id, p, x, y)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

function PdfPage({
    pdf,
    page,
    width,
    fields,
    signers,
    selectedKey,
    readOnly,
    canPlace,
    onSelect,
    onPointerDown,
    onPageClick,
}: {
    pdf: PDFDocumentProxy;
    page: number;
    width: number;
    fields: EditorField[];
    signers: ContractSigner[];
    selectedKey: string | null;
    readOnly?: boolean;
    canPlace: boolean;
    onSelect: (key: string) => void;
    onPointerDown: (e: ReactPointerEvent, field: EditorField, mode: 'move' | 'resize', pageEl: HTMLElement) => void;
    onPageClick: (page: number, xPct: number, yPct: number) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
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
            <div className="relative" style={{ width, height: cssH || 80 }} ref={wrapRef}>
                {cssH < 1 ? (
                    <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                        Pintando página {page}…
                    </p>
                ) : null}
                <canvas ref={canvasRef} className="block bg-white" />
                <div
                    className={cn('absolute inset-0', canPlace ? 'cursor-crosshair' : 'cursor-default')}
                    onClick={(e) => {
                        if (!canPlace || e.target !== e.currentTarget) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (rect.width < 1 || rect.height < 1) return;
                        const xPct = ((e.clientX - rect.left) / rect.width) * 100;
                        const yPct = ((e.clientY - rect.top) / rect.height) * 100;
                        onPageClick(page, xPct, yPct);
                    }}
                >
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
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect(field.key);
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
                                            e.stopPropagation();
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
