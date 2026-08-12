import { AlertCircle, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
    blobUrl: string | null;
    fileName?: string | null;
    emptyLabel?: string;
    loading?: boolean;
    className?: string;
};

function isImageName(name: string | null | undefined): boolean {
    if (!name) return false;
    return /\.(jpe?g|png|webp)$/i.test(name);
}

/** Preview pane for billing files (R2/local blob URL). No Drive. */
export function BillingFilePane({
    blobUrl,
    fileName,
    emptyLabel = 'Adjunta el archivo para verlo en BOhub',
    loading = false,
    className,
}: Props) {
    const src = blobUrl?.trim() || '';
    const image = isImageName(fileName) || (src.startsWith('blob:') && !!fileName && isImageName(fileName));

    return (
        <div
            className={cn(
                'relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/10',
                className,
            )}
        >
            <div className="z-10 flex shrink-0 items-center justify-between border-b border-border bg-background p-3">
                <div className="flex min-w-0 items-center gap-2">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/10">
                        <FileText className="size-4 text-primary" />
                    </div>
                    <span className="truncate text-xs font-medium text-muted-foreground">
                        {fileName?.trim() || 'Vista previa'}
                    </span>
                </div>
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-muted/5">
                {loading ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="size-8 animate-spin text-primary" />
                        <p className="text-xs">Cargando…</p>
                    </div>
                ) : src ? (
                    image ? (
                        <img src={src} alt={fileName ?? 'Justificante'} className="max-h-full max-w-full object-contain" />
                    ) : (
                        <iframe title="Vista previa documento" src={src} className="h-full w-full border-0 bg-white" />
                    )
                ) : (
                    <div className="flex flex-col items-center gap-3 p-8 text-center">
                        <AlertCircle className="size-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
