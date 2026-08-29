import { useEffect, useState } from 'react';
import { AlertCircle, Bug, CheckCircle2, ExternalLink, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getGlitchTipIssues, type GlitchTipIssue } from '@/lib/glitchtip';

type Props = {
    limit?: number;
};

function formatRelativeTime(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 30) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function RecentErrors({ limit = 3 }: Props) {
    const [issues, setIssues] = useState<GlitchTipIssue[]>([]);
    const [baseUrl, setBaseUrl] = useState('https://glitchtip.bocode.es');
    const [configured, setConfigured] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const ac = new AbortController();
        let cancelled = false;

        async function fetchIssues() {
            setIsLoading(true);
            try {
                const res = await getGlitchTipIssues(limit, ac.signal);
                if (cancelled) return;
                setIssues(res.data || []);
                setConfigured(res.configured);
                if (res.baseUrl) setBaseUrl(res.baseUrl);
            } catch {
                if (cancelled) return;
                setIssues([]);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        void fetchIssues();

        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [limit]);

    const glitchTipLink = baseUrl || 'https://glitchtip.bocode.es';

    if (isLoading) {
        return (
            <Card className="w-full min-w-0 max-w-full">
                <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Últimos Errores</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                        Incidencias registradas en GlitchTip
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-[240px] flex-col">
                    <div className="flex flex-1 flex-col gap-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                            >
                                <div className="flex flex-1 items-center gap-3">
                                    <Skeleton className="size-8 rounded-md" />
                                    <div className="flex-1 space-y-1">
                                        <Skeleton className="h-4 w-40" />
                                        <Skeleton className="h-3 w-28" />
                                    </div>
                                </div>
                                <Skeleton className="h-4 w-12" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full min-w-0 max-w-full">
            <CardHeader>
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <CardTitle className="truncate text-base sm:text-lg">Últimos Errores</CardTitle>
                            {issues.length > 0 && (
                                <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-semibold">
                                    {issues.length}
                                </Badge>
                            )}
                        </div>
                        <CardDescription className="truncate text-xs sm:text-sm">
                            Incidencias registradas en GlitchTip
                        </CardDescription>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 cursor-pointer text-xs sm:text-sm"
                        onClick={() => window.open(glitchTipLink, '_blank', 'noopener,noreferrer')}
                    >
                        Abrir GlitchTip
                        <ExternalLink className="size-3 sm:size-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex min-h-[240px] flex-col">
                {!configured ? (
                    <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-muted-foreground">
                        <ShieldAlert className="mb-2 size-10 text-muted-foreground/60" />
                        <p className="text-sm font-medium text-foreground">GlitchTip no configurado</p>
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                            Añade tu token de GlitchTip en la configuración del servidor para sincronizar errores.
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-3 cursor-pointer text-xs"
                            onClick={() => window.open(glitchTipLink, '_blank', 'noopener,noreferrer')}
                        >
                            Ir a GlitchTip
                            <ExternalLink className="size-3" />
                        </Button>
                    </div>
                ) : issues.length > 0 ? (
                    <div className="flex flex-1 flex-col gap-2 sm:gap-3">
                        {issues.slice(0, limit).map((issue) => {
                            const isFatal = issue.level === 'fatal';
                            const isWarning = issue.level === 'warning';

                            return (
                                <button
                                    key={issue.id}
                                    type="button"
                                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-border p-2 text-left transition-colors duration-200 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none sm:p-3"
                                    onClick={() =>
                                        window.open(issue.permalink || glitchTipLink, '_blank', 'noopener,noreferrer')
                                    }
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                        <div
                                            className={`flex size-7 shrink-0 items-center justify-center rounded-md sm:size-8 ${
                                                isFatal
                                                    ? 'bg-destructive/15 text-destructive'
                                                    : isWarning
                                                      ? 'bg-amber-500/15 text-amber-400'
                                                      : 'bg-rose-500/15 text-rose-400'
                                            }`}
                                        >
                                            {isFatal ? (
                                                <AlertCircle className="size-3.5 sm:size-4" />
                                            ) : (
                                                <Bug className="size-3.5 sm:size-4" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-medium text-foreground sm:text-base">
                                                {issue.title}
                                            </div>
                                            <div className="truncate text-xs text-muted-foreground sm:text-sm">
                                                {issue.project?.name ? `${issue.project.name} · ` : ''}
                                                {issue.culprit || issue.shortId || 'Sin detalles de ruta'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-xs font-medium text-foreground sm:text-sm">
                                            {issue.count > 1 ? `${issue.count} ev.` : '1 ev.'}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground sm:text-xs">
                                            {formatRelativeTime(issue.lastSeen)}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-muted-foreground">
                        <CheckCircle2 className="mb-2 size-10 text-emerald-500/80" />
                        <p className="text-sm font-medium text-foreground">Todo en orden</p>
                        <p className="mt-1 text-xs text-muted-foreground">No hay errores registrados recientemente</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
