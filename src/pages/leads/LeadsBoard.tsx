import { useEffect, useRef, useState, type DragEvent } from 'react';
import { AppSelect } from '@/components/app-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import {
    LEAD_SOURCE_BADGE_CLASS,
    LEAD_SOURCE_LABELS,
    LEAD_STATUS_LABELS,
    LEAD_STATUSES,
    listLeads,
    patchLeadStatus,
    type Lead,
    type LeadSource,
    type LeadStatus,
} from '@/lib/leads';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';

type Col = { data: Lead[]; total: number };

function emptyCols(): Record<LeadStatus, Col> {
    return {
        new: { data: [], total: 0 },
        contacted: { data: [], total: 0 },
        qualified: { data: [], total: 0 },
        meeting: { data: [], total: 0 },
        won: { data: [], total: 0 },
        lost: { data: [], total: 0 },
    };
}

type Props = {
    search: string;
    assignedUserId?: number | 'none';
    reloadKey: number;
    onOpen: (lead: Lead) => void;
};

export function LeadsBoard({ search, assignedUserId, reloadKey, onOpen }: Props) {
    const isMobile = useIsMobile();
    const [cols, setCols] = useState<Record<LeadStatus, Col>>(emptyCols);
    const [loading, setLoading] = useState(true);
    const [lostTarget, setLostTarget] = useState<{ lead: Lead; from: LeadStatus } | null>(null);
    const [lostReason, setLostReason] = useState('');
    const dragFrom = useRef<LeadStatus | null>(null);
    const skipClick = useRef(false);

    useEffect(() => {
        const ac = new AbortController();
        let cancelled = false;
        setLoading(true);
        void Promise.all(
            LEAD_STATUSES.map((status) =>
                listLeads(
                    { search: search || undefined, assignedUserId, status, perPage: 100 },
                    ac.signal,
                ).then((res) => ({ status, res })),
            ),
        )
            .then((rows) => {
                if (cancelled) return;
                const next = emptyCols();
                for (const { status, res } of rows) {
                    next[status] = { data: res.data, total: res.meta.total };
                }
                setCols(next);
            })
            .catch((err) => {
                if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
                toastError(err);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [search, assignedUserId, reloadKey]);

    function move(lead: Lead, from: LeadStatus, to: LeadStatus) {
        setCols((prev) => {
            const card = prev[from].data.find((l) => l.id === lead.id);
            if (!card) return prev;
            return {
                ...prev,
                [from]: { data: prev[from].data.filter((l) => l.id !== lead.id), total: Math.max(0, prev[from].total - 1) },
                [to]: { data: [{ ...card, status: to }, ...prev[to].data], total: prev[to].total + 1 },
            };
        });
    }

    async function commit(lead: Lead, from: LeadStatus, to: LeadStatus, reason?: string) {
        try {
            await patchLeadStatus(lead.id, to, reason ?? null);
            toastSuccess('Etapa actualizada');
        } catch (err) {
            move(lead, to, from);
            toastError(err);
        }
    }

    function requestStatusChange(lead: Lead, from: LeadStatus, to: LeadStatus) {
        if (from === to) return;
        move(lead, from, to);
        if (to === 'lost') {
            setLostTarget({ lead, from });
            setLostReason('');
            return;
        }
        void commit(lead, from, to);
    }

    function onDropColumn(to: LeadStatus, e: DragEvent) {
        e.preventDefault();
        const id = Number(e.dataTransfer.getData('text/plain'));
        const from = dragFrom.current;
        if (!from || from === to || !Number.isFinite(id)) return;
        const lead = cols[from].data.find((l) => l.id === id);
        if (!lead) return;
        requestStatusChange(lead, from, to);
    }

    return (
        <>
            <div className="relative -mx-1 px-1">
                <div className={cn('flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]', loading && 'opacity-60')}>
                    {LEAD_STATUSES.map((status) => {
                        const col = cols[status];
                        const extra = Math.max(0, col.total - col.data.length);
                        return (
                            <div
                                key={status}
                                className="flex w-[min(100%,18rem)] shrink-0 snap-center flex-col rounded-md border bg-muted/20 sm:w-72"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => onDropColumn(status, e)}
                            >
                                <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                                    <p className="text-sm font-medium">{LEAD_STATUS_LABELS[status]}</p>
                                    <span className="text-xs text-muted-foreground">
                                        {col.total}
                                        {extra > 0 ? ` · +${extra} más` : ''}
                                    </span>
                                </div>
                                <div className="flex flex-1 flex-col gap-2 p-2">
                                    {col.data.length === 0 ? (
                                        <p className="px-1 py-6 text-center text-xs text-muted-foreground">Sin leads</p>
                                    ) : (
                                        col.data.map((lead) => (
                                            <button
                                                key={lead.id}
                                                type="button"
                                                draggable={!isMobile}
                                                onDragStart={(e) => {
                                                    skipClick.current = true;
                                                    dragFrom.current = status;
                                                    e.dataTransfer.setData('text/plain', String(lead.id));
                                                    e.dataTransfer.effectAllowed = 'move';
                                                }}
                                                onDragEnd={() => {
                                                    window.setTimeout(() => {
                                                        skipClick.current = false;
                                                    }, 0);
                                                }}
                                                onClick={() => {
                                                    if (skipClick.current) {
                                                        skipClick.current = false;
                                                        return;
                                                    }
                                                    onOpen(lead);
                                                }}
                                                className="cursor-pointer rounded-md border bg-card p-3 text-left text-sm shadow-sm hover:border-primary/40"
                                            >
                                                <p className="truncate font-medium" title={lead.name ?? undefined}>
                                                    {lead.name || '—'}
                                                </p>
                                                <p className="mt-1 truncate text-xs text-muted-foreground" title={lead.phone || lead.email || undefined}>
                                                    {lead.phone || lead.email || '—'}
                                                </p>
                                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                    <Badge variant="outline" className={LEAD_SOURCE_BADGE_CLASS[lead.source as LeadSource] ?? 'border-border'}>
                                                        {LEAD_SOURCE_LABELS[lead.source as LeadSource] ?? lead.source}
                                                    </Badge>
                                                    {lead.assignedUser?.name ? (
                                                        <span className="truncate text-xs text-muted-foreground">{lead.assignedUser.name}</span>
                                                    ) : null}
                                                </div>
                                                {isMobile ? (
                                                    <div
                                                        className="mt-2"
                                                        onClick={(e) => e.stopPropagation()}
                                                        onKeyDown={(e) => e.stopPropagation()}
                                                    >
                                                        <AppSelect
                                                            items={LEAD_STATUSES.map((s) => ({ label: LEAD_STATUS_LABELS[s], value: s }))}
                                                            value={status}
                                                            onValueChange={(v) => {
                                                                if (!v || v === status) return;
                                                                requestStatusChange(lead, status, v as LeadStatus);
                                                            }}
                                                        />
                                                    </div>
                                                ) : null}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {isMobile ? (
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background/90 to-transparent"
                    />
                ) : null}
            </div>
            <p className="text-center text-xs text-muted-foreground md:hidden">Desliza para ver más etapas</p>

            <Dialog
                open={!!lostTarget}
                onOpenChange={(open) => {
                    if (open || !lostTarget) return;
                    move(lostTarget.lead, 'lost', lostTarget.from);
                    setLostTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Motivo de pérdida</DialogTitle>
                    </DialogHeader>
                    <Input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Motivo…" />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (!lostTarget) return;
                                move(lostTarget.lead, 'lost', lostTarget.from);
                                setLostTarget(null);
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            disabled={!lostReason.trim()}
                            onClick={() => {
                                if (!lostTarget || !lostReason.trim()) return;
                                const { lead, from } = lostTarget;
                                setLostTarget(null);
                                void commit(lead, from, 'lost', lostReason.trim());
                            }}
                        >
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
