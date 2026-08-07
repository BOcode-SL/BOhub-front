import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Inbox, MoreHorizontal, Pencil, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ListPageShell } from '@/components/list-page-shell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
    cancelMessage,
    getMessage,
    listMessages,
    STATUS_LABELS,
    updateScheduledMessage,
    type EmailMessage,
    type EmailMessageStatus,
    type PageMeta,
} from '@/lib/emails';
import { toastError, toastSuccess } from '@/lib/toast';
import { EmailTabs } from '@/pages/emails/EmailTabs';
import { EmailHtmlPane } from '@/pages/emails/EmailHtmlPane';

const PER_PAGE = 15;
type Tab = 'sent' | 'scheduled' | 'all';

function formatDt(iso?: string | null) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('es-ES', {
            dateStyle: 'short',
            timeStyle: 'short',
        });
    } catch {
        return iso;
    }
}

function statusClass(s: EmailMessageStatus) {
    switch (s) {
        case 'sent':
            return 'text-emerald-600';
        case 'failed':
            return 'text-destructive';
        case 'scheduled':
            return 'text-amber-600';
        case 'cancelled':
            return 'text-muted-foreground';
        default:
            return 'text-foreground';
    }
}

export function EmailMessagesPage() {
    const [tab, setTab] = useState<Tab>('sent');
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<EmailMessage[]>([]);
    const [meta, setMeta] = useState<PageMeta | null>(null);
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);

    const [preview, setPreview] = useState<EmailMessage | null>(null);
    const [editMsg, setEditMsg] = useState<EmailMessage | null>(null);
    const [editTo, setEditTo] = useState('');
    const [editCc, setEditCc] = useState('');
    const [editSubject, setEditSubject] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editTime, setEditTime] = useState('');
    const [saving, setSaving] = useState(false);
    const [cancelTarget, setCancelTarget] = useState<EmailMessage | null>(null);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        // ponytail: tab+page batched via changeTab → 1 request
        const ac = new AbortController();
        setLoading(true);
        void listMessages({ page, perPage: PER_PAGE, tab, signal: ac.signal })
            .then((res) => {
                setRows(res.data);
                setMeta(res.meta);
            })
            .catch((err) => {
                toastError(err);
                setRows([]);
            })
            .finally(() => {
                if (!ac.signal.aborted) setLoading(false);
            });
        return () => ac.abort();
    }, [page, tab, tick]);

    function changeTab(next: Tab) {
        setTab(next);
        setPage(1);
    }

    async function openPreview(row: EmailMessage) {
        try {
            setPreview(await getMessage(row.id));
        } catch (err) {
            toastError(err);
        }
    }

    function openEdit(row: EmailMessage) {
        setEditMsg(row);
        setEditTo(row.to);
        setEditCc(row.cc ?? '');
        setEditSubject(row.subject);
        if (row.scheduledAt) {
            const d = new Date(row.scheduledAt);
            setEditDate(d.toISOString().slice(0, 10));
            setEditTime(d.toTimeString().slice(0, 5));
        } else {
            setEditDate('');
            setEditTime('');
        }
    }

    async function saveEdit() {
        if (!editMsg) return;
        const to = editTo.trim();
        const subject = editSubject.trim();
        if (!to || !subject || !editDate || !editTime) {
            toastError('Para, asunto, fecha y hora son obligatorios.');
            return;
        }
        setSaving(true);
        try {
            const dt = new Date(`${editDate}T${editTime}`);
            if (Number.isNaN(dt.getTime()) || dt <= new Date()) {
                toastError('La fecha programada debe ser futura');
                setSaving(false);
                return;
            }
            await updateScheduledMessage(editMsg.id, {
                to,
                cc: editCc.trim() || null,
                subject,
                scheduledAt: dt.toISOString(),
            });
            setEditMsg(null);
            setTick((t) => t + 1);
            toastSuccess('Programación actualizada');
        } catch (err) {
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    async function confirmCancel() {
        if (!cancelTarget) return;
        setCancelling(true);
        try {
            await cancelMessage(cancelTarget.id);
            setCancelTarget(null);
            setTick((t) => t + 1);
            toastSuccess('Programación cancelada');
        } catch (err) {
            toastError(err);
        } finally {
            setCancelling(false);
        }
    }

    const chips: { id: Tab; label: string }[] = [
        { id: 'sent', label: 'Enviados' },
        { id: 'scheduled', label: 'Programados' },
        { id: 'all', label: 'Todos' },
    ];

    return (
        <>
            <ListPageShell
                title="Mensajes"
                description="Historial de envíos y mensajes programados."
                icon={Inbox}
                above={<EmailTabs />}
                toolbar={
                    <div className="flex flex-wrap gap-2 py-1">
                        {chips.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => changeTab(c.id)}
                                className={cn(
                                    'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors duration-200',
                                    'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                                    tab === c.id
                                        ? 'bg-sidebar-accent font-medium text-primary'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                )}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                }
            >
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Estado</TableHead>
                                <TableHead>Para</TableHead>
                                <TableHead className="hidden sm:table-cell">Asunto</TableHead>
                                <TableHead className="hidden md:table-cell">Fecha</TableHead>
                                <TableHead className="w-12">
                                    <span className="sr-only">Acciones</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading
                                ? Array.from({ length: 5 }).map((_, i) => (
                                      <TableRow key={i}>
                                          <TableCell>
                                              <Skeleton className="h-4 w-20" />
                                          </TableCell>
                                          <TableCell>
                                              <Skeleton className="h-4 w-36" />
                                          </TableCell>
                                          <TableCell className="hidden sm:table-cell">
                                              <Skeleton className="h-4 w-40" />
                                          </TableCell>
                                          <TableCell className="hidden md:table-cell">
                                              <Skeleton className="h-4 w-28" />
                                          </TableCell>
                                          <TableCell>
                                              <Skeleton className="size-8" />
                                          </TableCell>
                                      </TableRow>
                                  ))
                                : rows.map((row) => (
                                      <TableRow key={row.id}>
                                          <TableCell>
                                              <span className={cn('text-sm font-medium', statusClass(row.status))}>
                                                  {STATUS_LABELS[row.status]}
                                              </span>
                                          </TableCell>
                                          <TableCell
                                              className="max-w-[160px] truncate"
                                              title={row.to}
                                          >
                                              {row.to}
                                          </TableCell>
                                          <TableCell
                                              className="hidden max-w-[220px] truncate text-muted-foreground sm:table-cell"
                                              title={row.subject}
                                          >
                                              {row.subject}
                                          </TableCell>
                                          <TableCell className="hidden text-muted-foreground md:table-cell">
                                              {row.status === 'scheduled'
                                                  ? formatDt(row.scheduledAt)
                                                  : formatDt(row.sentAt ?? row.createdAt)}
                                          </TableCell>
                                          <TableCell>
                                              <DropdownMenu>
                                                  <DropdownMenuTrigger
                                                      render={
                                                          <Button
                                                              type="button"
                                                              variant="ghost"
                                                              size="icon-sm"
                                                              className="cursor-pointer"
                                                              aria-label="Acciones mensaje"
                                                          />
                                                      }
                                                  >
                                                      <MoreHorizontal className="size-4" />
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align="end">
                                                      <DropdownMenuItem
                                                          className="cursor-pointer"
                                                          onClick={() => void openPreview(row)}
                                                      >
                                                          <Eye className="size-4" />
                                                          Ver
                                                      </DropdownMenuItem>
                                                      {row.status === 'scheduled' && (
                                                          <>
                                                              <DropdownMenuItem
                                                                  className="cursor-pointer"
                                                                  onClick={() => openEdit(row)}
                                                              >
                                                                  <Pencil className="size-4" />
                                                                  Editar
                                                              </DropdownMenuItem>
                                                              <DropdownMenuItem
                                                                  className="cursor-pointer text-destructive"
                                                                  onClick={() => setCancelTarget(row)}
                                                              >
                                                                  <XCircle className="size-4" />
                                                                  Cancelar
                                                              </DropdownMenuItem>
                                                          </>
                                                      )}
                                                  </DropdownMenuContent>
                                              </DropdownMenu>
                                          </TableCell>
                                      </TableRow>
                                  ))}
                            {!loading && rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                                        No hay mensajes
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                        <span>
                            {meta.from ?? 0}–{meta.to ?? 0} de {meta.total}
                        </span>
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="cursor-pointer"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                <ChevronLeft className="size-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="cursor-pointer"
                                disabled={page >= meta.last_page}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </ListPageShell>

            <Sheet
                open={!!preview}
                onOpenChange={(o) => {
                    if (!o) setPreview(null);
                }}
            >
                <SheetContent
                    className={cn(
                        'flex w-full flex-col gap-0 p-0',
                        'data-[side=right]:w-[95vw] data-[side=right]:sm:max-w-[1200px]',
                    )}
                >
                    <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
                        <div className="flex min-h-[240px] min-w-0 flex-1 flex-col overflow-hidden border-b border-border p-4 md:min-h-0 md:border-r md:border-b-0 md:p-6">
                            <EmailHtmlPane
                                html={preview?.htmlBody}
                                subject={preview?.subject}
                                emptyLabel="Sin contenido"
                                className="h-full shadow-lg"
                            />
                        </div>
                        <div className="flex w-full min-h-0 min-w-0 flex-col overflow-hidden md:w-[380px] md:shrink-0 lg:w-[420px]">
                            <SheetHeader>
                                <SheetTitle>{preview?.subject ?? 'Mensaje'}</SheetTitle>
                                <SheetDescription>
                                    {preview
                                        ? `Para: ${preview.to}${preview.cc ? ` · CC: ${preview.cc}` : ''} · ${STATUS_LABELS[preview.status]}`
                                        : ''}
                                </SheetDescription>
                            </SheetHeader>
                            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
                                {preview?.attachments?.length ? (
                                    <p className="text-xs text-muted-foreground">
                                        Adjuntos: {preview.attachments.map((a) => a.filename).join(', ')}
                                    </p>
                                ) : null}
                                {preview?.errorMessage ? (
                                    <p className="text-sm text-destructive">{preview.errorMessage}</p>
                                ) : null}
                                <div className="grid gap-1 text-sm">
                                    <p>
                                        <span className="text-muted-foreground">Estado:</span>{' '}
                                        {preview ? STATUS_LABELS[preview.status] : '—'}
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">Fecha:</span>{' '}
                                        {preview?.status === 'scheduled'
                                            ? formatDt(preview.scheduledAt)
                                            : formatDt(preview?.sentAt ?? preview?.createdAt)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <Sheet
                open={!!editMsg}
                onOpenChange={(o) => {
                    if (!o) setEditMsg(null);
                }}
            >
                <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle>Editar programado</SheetTitle>
                        <SheetDescription>Solo destinatario, asunto y fecha (sin body/adjuntos).</SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-to">Para *</Label>
                            <Input
                                id="edit-to"
                                type="email"
                                required
                                maxLength={255}
                                value={editTo}
                                onChange={(e) => setEditTo(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-cc">CC</Label>
                            <Input
                                id="edit-cc"
                                type="email"
                                maxLength={255}
                                value={editCc}
                                onChange={(e) => setEditCc(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-subject">Asunto *</Label>
                            <Input
                                id="edit-subject"
                                required
                                maxLength={200}
                                value={editSubject}
                                onChange={(e) => setEditSubject(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-date">Fecha *</Label>
                                <Input
                                    id="edit-date"
                                    type="date"
                                    required
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-time">Hora *</Label>
                                <Input
                                    id="edit-time"
                                    type="time"
                                    required
                                    value={editTime}
                                    onChange={(e) => setEditTime(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <SheetFooter>
                        <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setEditMsg(null)}>
                            Cerrar
                        </Button>
                        <Button type="button" className="cursor-pointer" disabled={saving} onClick={() => void saveEdit()}>
                            Guardar
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Dialog
                open={!!cancelTarget}
                onOpenChange={(o) => {
                    if (!o) setCancelTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancelar envío</DialogTitle>
                        <DialogDescription>
                            Se cancelará el mensaje a {cancelTarget?.to} y se borrarán los adjuntos del disco.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setCancelTarget(null)}>
                            Volver
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className="cursor-pointer"
                            disabled={cancelling}
                            onClick={() => void confirmCancel()}
                        >
                            Cancelar envío
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
