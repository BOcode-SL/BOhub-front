import { useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { drivePreviewUrl } from '@/lib/billing';

type Props = {
    url?: string | null;
    className?: string;
};

/** Port of ProjectHub InvoicePreview — Drive /view → /preview + iframe. */
export function DrivePdfPane({ url, className }: Props) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const trimmed = url?.trim() || '';
    const preview = drivePreviewUrl(trimmed);

    useEffect(() => {
        setLoading(true);
        setError(false);
    }, [trimmed]);

    if (!trimmed || !preview) {
        return null;
    }

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
                    <span className="truncate text-xs font-medium text-muted-foreground">Vista previa del documento</span>
                </div>
                <a
                    href={trimmed}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'gap-1.5')}
                >
                    Abrir <ExternalLink className="size-3" />
                </a>
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-muted/5">
                {loading && !error && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                        <Loader2 className="size-8 animate-spin text-primary" />
                    </div>
                )}

                {error ? (
                    <div className="flex flex-col items-center gap-3 p-8 text-center">
                        <AlertCircle className="size-10 text-destructive/50" />
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">No se pudo cargar la vista previa</p>
                            <p className="text-xs text-muted-foreground">
                                El archivo podría tener restricciones o el formato no es compatible.
                            </p>
                        </div>
                        <a
                            href={trimmed}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-2')}
                        >
                            Ver en ventana externa
                        </a>
                    </div>
                ) : (
                    <iframe
                        title="Vista previa PDF"
                        src={preview}
                        className="h-full w-full border-0"
                        onLoad={() => setLoading(false)}
                        onError={() => {
                            setLoading(false);
                            setError(true);
                        }}
                    />
                )}
            </div>
        </div>
    );
}
