import { useEffect, useState, type RefObject } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { toastError } from '@/lib/toast';

GlobalWorkerOptions.workerSrc = workerSrc;

/** One pdfjs parse per blobUrl. Destroy the proxy on blob change / unmount. */
export function usePdfJsDocument(blobUrl: string | null): PDFDocumentProxy | null {
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);

    useEffect(() => {
        if (!blobUrl) {
            setPdf(null);
            return;
        }
        let cancelled = false;
        const loadingTask = getDocument({ url: blobUrl });
        void loadingTask.promise
            .then((proxy) => {
                if (cancelled) {
                    void loadingTask.destroy();
                    return;
                }
                setPdf(proxy);
            })
            .catch((err) => {
                if (!cancelled) toastError(err, 'No se pudo leer el PDF.');
            });
        return () => {
            cancelled = true;
            setPdf(null);
            void loadingTask.destroy();
        };
    }, [blobUrl]);

    return pdf;
}

export async function renderPdfPage(
    pdf: PDFDocumentProxy,
    pageNumber: number,
    canvas: HTMLCanvasElement,
    cssWidth: number,
): Promise<{ height: number; task: RenderTask }> {
    const pdfPage = await pdf.getPage(pageNumber);
    const unscaled = pdfPage.getViewport({ scale: 1 });
    // ponytail: cap 2 — a 50-page envelope at 3× DPR would thrash
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = (cssWidth / unscaled.width) * dpr;
    const viewport = pdfPage.getViewport({ scale });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const cssHeight = viewport.height / dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const task = pdfPage.render({ canvas, viewport });
    return { height: cssHeight, task };
}

export function isRenderCancelled(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const name = 'name' in err ? String(err.name) : '';
    const msg = 'message' in err ? String(err.message) : '';
    return name === 'RenderingCancelledException' || msg.toLowerCase().includes('cancelled');
}

/** Fit-width; 0 until first measure so we don't paint at a dummy 640 then redo. */
export function useFitWidth(ref: RefObject<HTMLElement | null>, min = 280): number {
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const apply = () => {
            const next = Math.max(min, el.clientWidth);
            setWidth((w) => (Math.abs(next - w) < 2 ? w : next));
        };
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(el);
        return () => ro.disconnect();
    }, [ref, min]);
    return width;
}
