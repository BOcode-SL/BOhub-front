import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Inbox, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { ListPageShell } from '@/components/list-page-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ToolbarSelect } from '@/components/toolbar-field';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LeadSheet } from '@/pages/leads/LeadSheet';
import { createLead, deleteLead, listLeadAssignees, listLeads, updateLead, type Lead, type LeadStatus } from '@/lib/leads';
import { toastError, toastSuccess } from '@/lib/toast';
import { useAuth } from '@/auth/AuthContext';

const STATUS_ITEMS: { label: string; value: string }[] = [
    { label: 'Todas', value: 'all' },
    { label: 'Nueva', value: 'new' },
    { label: 'Contactada', value: 'contacted' },
    { label: 'Cualificada', value: 'qualified' },
    { label: 'Reunión', value: 'meeting' },
    { label: 'Ganada', value: 'won' },
    { label: 'Perdida', value: 'lost' },
];

export function LeadsPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [searchParams, setSearchParams] = useSearchParams();
    const [rows, setRows] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add');
    const [editing, setEditing] = useState<Lead | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
    const [assignees, setAssignees] = useState<{ id: number; name: string }[]>([]);
    const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');

    const urlSearch = searchParams.get('search') ?? '';
    const urlStatus = searchParams.get('status') ?? 'all';
    const urlAssigned = searchParams.get('assigned_user_id') ?? 'all';

    useEffect(() => setSearchInput(urlSearch), [urlSearch]);

    useEffect(() => {
        const t = setTimeout(() => {
            const next = searchInput.trim();
            if (next === urlSearch) return;
            setSearchParams((prev) => {
                const p = new URLSearchParams(prev);
                if (next) p.set('search', next);
                else p.delete('search');
                return p;
            }, { replace: true });
        }, 300);
        return () => clearTimeout(t);
    }, [searchInput, urlSearch, setSearchParams]);

    async function reload() {
        setLoading(true);
        try {
            const [list, users] = await Promise.all([
                listLeads({
                    search: urlSearch || undefined,
                    status: urlStatus !== 'all' ? (urlStatus as LeadStatus) : undefined,
                    assignedUserId: urlAssigned !== 'all' ? Number(urlAssigned) : undefined,
                }),
                listLeadAssignees(),
            ]);
            setRows(list.data);
            setAssignees(users.data.map((u) => ({ id: u.id, name: u.name })));
        } catch (err) {
            toastError(err);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void reload();
    }, [urlSearch, urlStatus, urlAssigned]);

    return (
        <>
            <ListPageShell
                title="Leads"
                description="Bandeja de oportunidades"
                icon={Inbox}
                actions={<Button onClick={() => { setSheetMode('add'); setEditing(null); setSheetOpen(true); }}><Plus />Añadir lead</Button>}
                toolbar={
                    <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-end">
                        <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="pl-9" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Buscar por nombre, email o teléfono…" />
                        </div>
                        <ToolbarSelect id="leads-status" label="Etapa" items={STATUS_ITEMS} value={urlStatus} onValueChange={(value) => setSearchParams((prev) => { const p = new URLSearchParams(prev); if (!value || value === 'all') p.delete('status'); else p.set('status', value); return p; })} />
                        <ToolbarSelect id="leads-assigned" label="Asignado" items={[{ label: 'Todos', value: 'all' }, ...assignees.map((u) => ({ label: u.name, value: String(u.id) }))]} value={urlAssigned} onValueChange={(value) => setSearchParams((prev) => { const p = new URLSearchParams(prev); if (!value || value === 'all') p.delete('assigned_user_id'); else p.set('assigned_user_id', value); return p; })} />
                    </div>
                }
            >
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Teléfono</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Etapa</TableHead>
                                <TableHead>Asignado</TableHead>
                                <TableHead>Fuente</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!loading && rows.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Sin leads todavía.</TableCell></TableRow>
                            ) : rows.map((lead) => (
                                <TableRow key={lead.id} className={loading ? 'opacity-60' : undefined}>
                                    <TableCell className="font-medium">{lead.name || '—'}</TableCell>
                                    <TableCell>{lead.phone || '—'}</TableCell>
                                    <TableCell>{lead.email || '—'}</TableCell>
                                    <TableCell>{lead.status}</TableCell>
                                    <TableCell>{lead.assignedUser?.name || '—'}</TableCell>
                                    <TableCell>{lead.source}</TableCell>
                                    <TableCell>{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('es-ES') : '—'}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}><MoreHorizontal /></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => { setSheetMode('edit'); setEditing(lead); setSheetOpen(true); }}><Pencil />Editar</DropdownMenuItem>
                                                {isAdmin && <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(lead)}><Trash2 />Eliminar</DropdownMenuItem>}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </ListPageShell>

            <LeadSheet
                open={sheetOpen}
                mode={sheetMode}
                lead={editing}
                assignees={assignees}
                onOpenChange={setSheetOpen}
                onSubmit={async (data) => {
                    if (sheetMode === 'edit' && editing) {
                        await updateLead(editing.id, data);
                        toastSuccess('Lead actualizado');
                    } else {
                        await createLead(data);
                        toastSuccess('Lead creado');
                    }
                    await reload();
                }}
            />

            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Eliminar lead</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">Esta acción elimina el lead (soft delete).</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={async () => {
                            if (!deleteTarget) return;
                            try {
                                await deleteLead(deleteTarget.id);
                                setDeleteTarget(null);
                                toastSuccess('Lead eliminado');
                                await reload();
                            } catch (err) {
                                toastError(err);
                            }
                        }}>Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
