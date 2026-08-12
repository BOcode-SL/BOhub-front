import { FileText, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
    html?: string | null;
    subject?: string | null;
    emptyLabel?: string;
    className?: string;
};

/** Left-pane email HTML preview (same sheet layout as DrivePdfPane). */
export function EmailHtmlPane({ html, subject, emptyLabel = 'Escribe HTML para previsualizar', className }: Props) {
    const src = html?.trim() || '';

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
                        <Mail className="size-4 text-primary" />
                    </div>
                    <span className="truncate text-xs font-medium text-muted-foreground">Email</span>
                </div>
            </div>

            {subject?.trim() ? (
                <div className="shrink-0 truncate border-b border-border bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Asunto:</span> {subject.trim()}
                </div>
            ) : null}

            {src ? (
                <iframe title="Vista previa email" srcDoc={src} sandbox="allow-same-origin" className="min-h-0 w-full flex-1 border-0 bg-white" />
            ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
                    <FileText className="size-8 opacity-40" />
                    <p className="text-sm">{emptyLabel}</p>
                </div>
            )}
        </div>
    );
}
