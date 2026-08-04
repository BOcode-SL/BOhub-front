import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, MoreHorizontal, Pencil, Plus, Search, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListPageShell } from '@/components/list-page-shell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteTemplate, getTemplate, listTemplates, type EmailTemplate, type PageMeta } from '@/lib/emails';
import { toastError, toastSuccess } from '@/lib/toast';
import { EmailTabs } from '@/pages/emails/EmailTabs';
import { TemplateFormSheet } from '@/pages/emails/TemplateFormSheet';
import { SendEmailSheet } from '@/pages/emails/SendEmailSheet';

const PER_PAGE = 15;

export function EmailsPage() {
    const [page, setPage] = useState(1);
    const [qInput, setQInput] = useState('');
    const [q, setQ] = useState('');
    const [rows, setRows] = useState<EmailTemplate[]>([]);
    const [meta, setMeta] = useState<PageMeta | null>(null);
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
    const [editing, setEditing] = useState<EmailTemplate | null>(null);

    const [sendOpen, setSendOpen] = useState(false);
    const [sendTemplate, setSendTemplate] = useState<EmailTemplate | null>(null);

    const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => {
            setQ(qInput.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [qInput]);

    useEffect(() => {
        const ac = new AbortController();
        setLoading(true);
        void listTemplates({
            page,
            perPage: PER_PAGE,
            q: q || undefined,
            signal: ac.signal,
        })
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
    }, [page, q, tick]);

    async function openEdit(row: EmailTemplate) {
        try {
            const full = await getTemplate(row.id);
            setEditing(full);
            setFormMode('edit');
            setFormOpen(true);
        } catch (err) {
            toastError(err);
        }
    }

    async function openSend(row: EmailTemplate) {
        try {
            const full = await getTemplate(row.id);
            setSendTemplate(full);
            setSendOpen(true);
        } catch (err) {
            toastError(err);
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteTemplate(deleteTarget.id);
            setDeleteTarget(null);
            setTick((t) => t + 1);
            toastSuccess('Plantilla eliminada');
        } catch (err) {
            toastError(err);
        } finally {
            setDeleting(false);
        }
    }

    return (
        <>
            <ListPageShell
                title="Plantillas"
                description="Plantillas de email reutilizables con variables."
                icon={FileText}
                above={<EmailTabs />}
                actions={
                    <Button
                        type="button"
                        onClick={() => {
                            setEditing(null);
                            setFormMode('add');
                            setFormOpen(true);
                        }}
                    >
                        <Plus />
                        Nueva plantilla
                    </Button>
                }
                toolbar={
                    <div className="relative min-w-0 py-1">
                        <Search
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                        />
                        <Input
                            value={qInput}
                            onChange={(e) => setQInput(e.target.value)}
                            placeholder="Buscar plantillas…"
                            className="pl-9"
                            aria-label="Buscar plantillas"
                        />
                    </div>
                }
            >
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead className="hidden sm:table-cell">Asunto</TableHead>
                                <TableHead className="hidden md:table-cell">Variables</TableHead>
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
                                              <Skeleton className="h-4 w-32" />
                                          </TableCell>
                                          <TableCell className="hidden sm:table-cell">
                                              <Skeleton className="h-4 w-40" />
                                          </TableCell>
                                          <TableCell className="hidden md:table-cell">
                                              <Skeleton className="h-4 w-24" />
                                          </TableCell>
                                          <TableCell>
                                              <Skeleton className="size-8" />
                                          </TableCell>
                                      </TableRow>
                                  ))
                                : rows.map((row) => (
                                      <TableRow key={row.id}>
                                          <TableCell className="font-medium">{row.name}</TableCell>
                                          <TableCell className="hidden max-w-[240px] truncate text-muted-foreground sm:table-cell">
                                              {row.subject}
                                          </TableCell>
                                          <TableCell className="hidden text-muted-foreground md:table-cell">
                                              {(row.variables ?? []).length ? (row.variables ?? []).join(', ') : '—'}
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
                                                              aria-label={`Acciones ${row.name}`}
                                                          />
                                                      }
                                                  >
                                                      <MoreHorizontal className="size-4" />
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align="end">
                                                      <DropdownMenuItem
                                                          className="cursor-pointer"
                                                          onClick={() => void openSend(row)}
                                                      >
                                                          <Send className="size-4" />
                                                          Enviar
                                                      </DropdownMenuItem>
                                                      <DropdownMenuItem
                                                          className="cursor-pointer"
                                                          onClick={() => void openEdit(row)}
                                                      >
                                                          <Pencil className="size-4" />
                                                          Editar
                                                      </DropdownMenuItem>
                                                      <DropdownMenuItem
                                                          className="cursor-pointer text-destructive"
                                                          onClick={() => setDeleteTarget(row)}
                                                      >
                                                          <Trash2 className="size-4" />
                                                          Eliminar
                                                      </DropdownMenuItem>
                                                  </DropdownMenuContent>
                                              </DropdownMenu>
                                          </TableCell>
                                      </TableRow>
                                  ))}
                            {!loading && rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                                        No hay plantillas
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
                                aria-label="Página anterior"
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
                                aria-label="Página siguiente"
                            >
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </ListPageShell>

            <TemplateFormSheet
                open={formOpen}
                mode={formMode}
                template={editing}
                onOpenChange={setFormOpen}
                onSaved={() => {
                    setFormOpen(false);
                    setTick((t) => t + 1);
                }}
            />

            <SendEmailSheet
                open={sendOpen}
                template={sendTemplate}
                onOpenChange={setSendOpen}
                onSent={() => setSendOpen(false)}
            />

            <Dialog
                open={!!deleteTarget}
                onOpenChange={(o) => {
                    if (!o) setDeleteTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar plantilla</DialogTitle>
                        <DialogDescription>¿Eliminar «{deleteTarget?.name}»? Esta acción no se puede deshacer.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setDeleteTarget(null)}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className="cursor-pointer"
                            disabled={deleting}
                            onClick={() => void confirmDelete()}
                        >
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
