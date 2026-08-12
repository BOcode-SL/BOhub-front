import { useRef, useState, type DragEvent } from 'react';
import { FileUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const BILLING_FILE_ACCEPT =
    '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';

type Props = {
    id: string;
    fileName?: string | null;
    disabled?: boolean;
    invalid?: boolean;
    accept?: string;
    /** Shown under the CTA when empty. */
    emptyHint?: string;
    onFile: (file: File | null) => void;
    className?: string;
};

/** Single-file dashed dropzone (PDF/imagen). Same idea as SendEmailSheet attachments. */
export function BillingFileDropzone({
    id,
    fileName,
    disabled,
    invalid,
    accept = BILLING_FILE_ACCEPT,
    emptyHint = 'PDF, JPG, PNG o WebP · máx. 10 MB',
    onFile,
    className,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const dragDepth = useRef(0);

    function pick(list: FileList | null) {
        const next = list?.[0] ?? null;
        onFile(next);
        if (inputRef.current) inputRef.current.value = '';
    }

    function onDragEnter(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        dragDepth.current += 1;
        setDragging(true);
    }

    function onDragLeave(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
    }

    function onDragOver(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        dragDepth.current = 0;
        setDragging(false);
        if (disabled) return;
        pick(e.dataTransfer.files);
    }

    return (
        <div className={cn('space-y-2', className)}>
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled || undefined}
                aria-invalid={invalid || undefined}
                onKeyDown={(e) => {
                    if (disabled) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        inputRef.current?.click();
                    }
                }}
                onClick={() => {
                    if (!disabled) inputRef.current?.click();
                }}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDragOver={onDragOver}
                onDrop={onDrop}
                className={cn(
                    'rounded-md border border-dashed px-3 py-6 text-center text-sm transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                    disabled
                        ? 'cursor-not-allowed opacity-60'
                        : 'cursor-pointer hover:border-primary/50 hover:bg-muted/30',
                    dragging && !disabled
                        ? 'border-primary bg-primary/5 text-foreground'
                        : invalid
                          ? 'border-destructive/60 text-muted-foreground'
                          : 'border-border text-muted-foreground',
                )}
            >
                <FileUp className="mx-auto mb-2 size-5 opacity-70" />
                {dragging && !disabled ? (
                    <p className="font-medium text-foreground">Suelta el archivo aquí</p>
                ) : (
                    <>
                        <p>
                            Arrastra el archivo o{' '}
                            <span className="font-medium text-primary underline-offset-2 hover:underline">
                                selecciónalo
                            </span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
                    </>
                )}
                <input
                    ref={inputRef}
                    id={id}
                    type="file"
                    accept={accept}
                    disabled={disabled}
                    className="sr-only"
                    onChange={(e) => pick(e.target.files)}
                />
            </div>
            {fileName ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs">
                    <span className="min-w-0 truncate font-medium text-foreground">{fileName}</span>
                    {!disabled ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-7 shrink-0 cursor-pointer"
                            aria-label="Quitar archivo"
                            onClick={(e) => {
                                e.stopPropagation();
                                onFile(null);
                            }}
                        >
                            <X className="size-3.5" />
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
