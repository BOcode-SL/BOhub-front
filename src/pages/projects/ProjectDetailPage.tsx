import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Pencil, Plus, RefreshCw, Trash2, Unlink } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError } from '@/lib/api';
import {
    createExpense,
    createPayment,
    formatMoney,
    listExpenses,
    listPayments,
    type Expense,
    type ExpenseInput,
    type Payment,
    type PaymentInput,
} from '@/lib/billing';
import { getJiraChangelog } from '@/lib/jira';
import {
    PROJECT_STATUS_LABELS,
    PROJECT_TYPE_LABELS,
    deleteProject,
    getBillingSummary,
    getHoursSummary,
    getProject,
    getProjectSummary,
    listProjectActivities,
    syncProjectJira,
    updateProject,
    type ProjectActivity,
    type ProjectBillingSummary,
    type ProjectHoursSummary,
    type ProjectSummary,
    type Project,
    type ProjectInput,
} from '@/lib/projects';
import { formatHoursFromSeconds } from '@/lib/time';
import { listHours, listTeamHours, type Hour, type HoursMeta } from '@/lib/timer';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { ExpenseSheet } from '@/pages/billing/ExpenseSheet';
import { PaymentSheet } from '@/pages/billing/PaymentSheet';
import { ProjectSheet } from '@/pages/projects/ProjectSheet';
import { HoursTable } from '@/pages/timer/HoursTable';

type Tab = 'summary' | 'hours' | 'billing' | 'config';
type Activity = { occurredAt: string; message: string; source: 'jira' | 'local' };

function StatCard({ label, value }: { label: string; value: ReactNode }) {
    return (
        <Card className="gap-2 py-4">
            <CardHeader className="px-4">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-xl">{value}</CardTitle>
            </CardHeader>
        </Card>
    );
}

export function ProjectDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const projectId = Number(id);

    const [project, setProject] = useState<Project | null>(null);
    const [summary, setSummary] = useState<ProjectSummary | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [tab, setTab] = useState<Tab>('summary');
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [jiraIssueKey, setJiraIssueKey] = useState('');

    const [hoursSummary, setHoursSummary] = useState<ProjectHoursSummary | null>(null);
    const [hours, setHours] = useState<Hour[]>([]);
    const [hoursMeta, setHoursMeta] = useState<HoursMeta | null>(null);
    const [hoursPage, setHoursPage] = useState(1);
    const [hoursLoading, setHoursLoading] = useState(false);

    const [billingSummary, setBillingSummary] = useState<ProjectBillingSummary | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [billingLoading, setBillingLoading] = useState(false);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [expenseOpen, setExpenseOpen] = useState(false);

    const loadCore = useCallback(async () => {
        if (!Number.isFinite(projectId) || projectId < 1) {
            toastError('Proyecto no válido');
            setLoadFailed(true);
            setLoading(false);
            return;
        }
        setLoading(true);
        setLoadFailed(false);
        try {
            try {
                await syncProjectJira(projectId);
            } catch (err) {
                if (!(err instanceof ApiError && err.status === 422)) toastError(err);
            }
            const [nextProject, nextSummary, local] = await Promise.all([
                getProject(projectId),
                getProjectSummary(projectId),
                listProjectActivities(projectId, { perPage: 20 }),
            ]);
            const jira = nextSummary.jiraIssueKey
                ? await getJiraChangelog(nextSummary.jiraIssueKey).catch((err) => {
                      toastError(err);
                      return [];
                  })
                : [];
            const merged: Activity[] = [
                ...local.data.map((item: ProjectActivity) => ({
                    occurredAt: item.occurredAt,
                    message: item.message,
                    source: 'local' as const,
                })),
                ...jira.map((entry) => ({
                    occurredAt: entry.created,
                    message: entry.items
                        .map((item) => `${item.field}: ${item.fromString || '—'} → ${item.toString || '—'}`)
                        .join(' · '),
                    source: 'jira' as const,
                })),
            ]
                .filter((item) => item.message)
                .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
                .slice(0, 15);
            setProject(nextProject);
            setSummary(nextSummary);
            setJiraIssueKey(nextSummary.jiraIssueKey ?? '');
            setActivities(merged);
        } catch (err) {
            toastError(err);
            setProject(null);
            setLoadFailed(true);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        void loadCore();
    }, [loadCore]);

    useEffect(() => {
        if (tab !== 'hours') return;
        const controller = new AbortController();
        setHoursLoading(true);
        const rows = isAdmin
            ? listTeamHours({ projectId, page: hoursPage, perPage: 20 }, controller.signal)
            : listHours({ projectId, page: hoursPage, perPage: 20 }, controller.signal);
        const summaryPromise = isAdmin
            ? getHoursSummary(projectId, controller.signal)
            : Promise.resolve(null);
        void Promise.all([summaryPromise, rows])
            .then(([nextSummary, result]) => {
                setHoursSummary(nextSummary);
                setHours(result.data);
                setHoursMeta(result.meta);
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                toastError(err);
            })
            .finally(() => setHoursLoading(false));
        return () => controller.abort();
    }, [tab, projectId, hoursPage, isAdmin]);

    const loadBilling = useCallback(async () => {
        if (!isAdmin) return;
        setBillingLoading(true);
        try {
            const [nextSummary, nextPayments, nextExpenses] = await Promise.all([
                getBillingSummary(projectId),
                listPayments({ projectId, perPage: 50 }),
                listExpenses({ projectId, perPage: 50 }),
            ]);
            setBillingSummary(nextSummary);
            setPayments(nextPayments.data);
            setExpenses(nextExpenses.data);
        } catch (err) {
            toastError(err);
        } finally {
            setBillingLoading(false);
        }
    }, [isAdmin, projectId]);

    useEffect(() => {
        if (tab === 'billing') void loadBilling();
    }, [tab, loadBilling]);

    async function handleSave(data: ProjectInput) {
        await updateProject(projectId, data);
        toastSuccess('Proyecto actualizado');
        await loadCore();
    }

    async function handleDelete() {
        setDeleting(true);
        try {
            await deleteProject(projectId);
            toastSuccess('Proyecto eliminado');
            navigate('/dashboard/projects');
        } catch (err) {
            toastError(err);
            setDeleting(false);
        }
    }

    async function handleJiraLink(unlink = false) {
        if (!unlink && !jiraIssueKey.trim()) {
            toastError('Introduce una clave de issue.');
            return;
        }
        try {
            await updateProject(projectId, unlink ? { unlinkJira: true } : { jiraIssueKey: jiraIssueKey.trim() });
            toastSuccess(unlink ? 'Jira desvinculado' : 'Issue de Jira actualizado');
            await loadCore();
        } catch (err) {
            toastError(err);
        }
    }

    async function handleCreatePayment(data: PaymentInput) {
        await createPayment(data);
        toastSuccess('Ingreso creado');
        await loadBilling();
    }

    async function handleCreateExpense(data: ExpenseInput) {
        await createExpense(data);
        toastSuccess('Gasto creado');
        await loadBilling();
    }

    const daysRemaining = useMemo(() => {
        if (summary?.daysRemaining == null) return '—';
        if (summary.daysRemaining < 0) return `${Math.abs(summary.daysRemaining)}d de retraso`;
        if (summary.daysRemaining === 0) return 'Hoy';
        return `${summary.daysRemaining} días`;
    }, [summary?.daysRemaining]);

    if (loading) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (loadFailed && !project) {
        return (
            <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">No se pudo cargar el proyecto.</p>
                <Button variant="outline" className="w-fit cursor-pointer" render={<Link to="/dashboard/projects" />}>
                    <ArrowLeft />
                    Volver a proyectos
                </Button>
            </div>
        );
    }

    if (!project) return null;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mb-2 -ml-2 cursor-pointer"
                        render={<Link to="/dashboard/projects" />}
                    >
                        <ArrowLeft />
                        Proyectos
                    </Button>
                    <div className="flex items-center gap-3">
                        <span
                            className="inline-block size-3 shrink-0 rounded-full border border-border"
                            style={{ backgroundColor: project.color || 'var(--primary)' }}
                            aria-hidden
                        />
                        <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{project.name}</h1>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Overview del proyecto</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setSheetOpen(true)}>
                        <Pencil />
                        Editar
                    </Button>
                    <Button type="button" variant="destructive" className="cursor-pointer" onClick={() => setDeleteOpen(true)}>
                        <Trash2 />
                        Eliminar
                    </Button>
                </div>
            </div>

            <nav aria-label="Secciones del proyecto" className="flex flex-wrap gap-2 border-b border-border pb-3">
                {[
                    ['summary', 'Resumen'],
                    ...(isAdmin
                        ? ([
                              ['hours', 'Horas'],
                              ['billing', 'Pagos'],
                          ] as const)
                        : []),
                    ['config', 'Configuración'],
                ].map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        className={cn(
                            'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                            tab === value
                                ? 'bg-sidebar-accent font-medium text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                        onClick={() => setTab(value as Tab)}
                    >
                        {label}
                    </button>
                ))}
            </nav>

            {tab === 'summary' && (
                <div className="grid gap-6">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <StatCard label="Proyecto" value={project.name} />
                        <StatCard label="Cliente" value={project.client?.name ?? '—'} />
                        <StatCard label="Estado" value={PROJECT_STATUS_LABELS[project.status]} />
                        <StatCard label="Tipo" value={PROJECT_TYPE_LABELS[project.type]} />
                        <StatCard label="Días restantes" value={daysRemaining} />
                    </div>

                    {(summary?.jiraProjectUrl || summary?.jiraIssueUrl) && (
                        <Card className="gap-3 py-4">
                            <CardHeader className="px-4">
                                <CardTitle>Jira</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-3 px-4">
                                {summary.jiraProjectUrl && (
                                    <Button
                                        variant="outline"
                                        render={<a href={summary.jiraProjectUrl} target="_blank" rel="noreferrer" />}
                                    >
                                        {summary.jiraProjectKey} <ExternalLink />
                                    </Button>
                                )}
                                {summary.jiraIssueUrl && (
                                    <Button
                                        variant="outline"
                                        render={<a href={summary.jiraIssueUrl} target="_blank" rel="noreferrer" />}
                                    >
                                        {summary.jiraIssueKey} <ExternalLink />
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <Card className="gap-3 py-4">
                        <CardHeader className="px-4">
                            <CardTitle>Actividad reciente</CardTitle>
                            <CardDescription>Últimos cambios locales y de Jira.</CardDescription>
                        </CardHeader>
                        <CardContent className="px-4">
                            {activities.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Aún no hay actividad.</p>
                            ) : (
                                <ol className="divide-y divide-border">
                                    {activities.map((activity, index) => (
                                        <li key={`${activity.occurredAt}-${index}`} className="flex gap-4 py-3 text-sm">
                                            <time className="w-36 shrink-0 text-muted-foreground">
                                                {new Date(activity.occurredAt).toLocaleString('es-ES')}
                                            </time>
                                            <p className="min-w-0 flex-1 text-foreground">{activity.message}</p>
                                            {activity.source === 'jira' && (
                                                <span className="shrink-0 text-xs font-medium text-primary">• Jira</span>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {tab === 'hours' && (
                <div className="grid gap-4">
                    {isAdmin && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <StatCard
                                label="Horas totales"
                                value={formatHoursFromSeconds(hoursSummary?.totalSeconds ?? 0)}
                            />
                            <StatCard
                                label="Precio por hora"
                                value={
                                    hoursSummary?.pricePerHour == null
                                        ? '—'
                                        : formatMoney(hoursSummary.pricePerHour)
                                }
                            />
                        </div>
                    )}
                    <HoursTable
                        hours={hours}
                        meta={hoursMeta}
                        loading={hoursLoading}
                        showUser={isAdmin}
                        showActions={false}
                        hideProject
                        page={hoursPage}
                        onPageChange={setHoursPage}
                    />
                </div>
            )}

            {tab === 'billing' && isAdmin && (
                <div className="grid gap-6">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard label="Facturado" value={formatMoney(billingSummary?.paymentsTotal ?? 0)} />
                        <StatCard label="Cobro neto" value={formatMoney(billingSummary?.paymentsNet ?? 0)} />
                        <StatCard label="Gastos" value={formatMoney(billingSummary?.expensesTotal ?? 0)} />
                        <StatCard label="Beneficio neto" value={formatMoney(billingSummary?.netBenefit ?? 0)} />
                    </div>

                    <Card className="gap-3 py-4">
                        <CardHeader className="px-4">
                            <div className="flex items-center justify-between gap-3">
                                <CardTitle>Ingresos</CardTitle>
                                <Button size="sm" onClick={() => setPaymentOpen(true)}>
                                    <Plus /> Añadir
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="px-4">
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Referencia</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {!billingLoading && payments.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                                                    Sin ingresos.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {payments.map((payment) => (
                                            <TableRow key={payment.id}>
                                                <TableCell>{payment.invoiceDate || '—'}</TableCell>
                                                <TableCell>{payment.reference || payment.invoiceNumber || '—'}</TableCell>
                                                <TableCell>{payment.status}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatMoney(payment.totalAmount)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="gap-3 py-4">
                        <CardHeader className="px-4">
                            <div className="flex items-center justify-between gap-3">
                                <CardTitle>Gastos</CardTitle>
                                <Button size="sm" onClick={() => setExpenseOpen(true)}>
                                    <Plus /> Añadir
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="px-4">
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Descripción</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {!billingLoading && expenses.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                                                    Sin gastos.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {expenses.map((expense) => (
                                            <TableRow key={expense.id}>
                                                <TableCell>{expense.expenseDate || '—'}</TableCell>
                                                <TableCell>{expense.description}</TableCell>
                                                <TableCell>{expense.status}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatMoney(expense.totalAmount)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {tab === 'config' && (
                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="gap-3 py-4">
                        <CardHeader className="px-4">
                            <CardTitle>Datos del proyecto</CardTitle>
                            <CardDescription>Cliente, tipo y datos locales. Estado/fin vienen de Jira.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 px-4 text-sm">
                            <p>
                                <span className="text-muted-foreground">Cliente:</span> {project.client?.name ?? '—'}
                            </p>
                            <p>
                                <span className="text-muted-foreground">Estado:</span> {PROJECT_STATUS_LABELS[project.status]}
                                {project.jiraLinked ? ' · desde Jira' : ''}
                            </p>
                            <p>
                                <span className="text-muted-foreground">Fin:</span> {project.endDate || '—'}
                                {project.jiraLinked ? ' · desde Jira' : ''}
                            </p>
                            <Button variant="outline" className="mt-2 w-fit" onClick={() => setSheetOpen(true)}>
                                <Pencil /> Editar datos
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="gap-3 py-4">
                        <CardHeader className="px-4">
                            <CardTitle>Jira</CardTitle>
                            <CardDescription>
                                {summary?.jiraProjectKey ? `Espacio ${summary.jiraProjectKey}` : 'Sin espacio asociado'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 px-4">
                            <Input
                                value={jiraIssueKey}
                                onChange={(e) => setJiraIssueKey(e.target.value)}
                                placeholder="Clave del issue, p. ej. BO-123"
                                disabled={!isAdmin}
                            />
                            {isAdmin && (
                                <div className="flex flex-wrap gap-2">
                                    <Button onClick={() => void handleJiraLink(false)}>Guardar issue</Button>
                                    {summary?.jiraLinked && (
                                        <Button variant="outline" onClick={() => void handleJiraLink(true)}>
                                            <Unlink /> Desvincular
                                        </Button>
                                    )}
                                    <Button variant="outline" onClick={() => void loadCore()}>
                                        <RefreshCw /> Sincronizar
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            <ProjectSheet open={sheetOpen} mode="edit" project={project} onOpenChange={setSheetOpen} onSubmit={handleSave} />
            <PaymentSheet
                open={paymentOpen}
                mode="add"
                payment={null}
                lockedProjectId={projectId}
                onOpenChange={setPaymentOpen}
                onSubmit={handleCreatePayment}
            />
            <ExpenseSheet
                open={expenseOpen}
                mode="add"
                expense={null}
                lockedProjectId={projectId}
                onOpenChange={setExpenseOpen}
                onSubmit={handleCreateExpense}
            />

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar proyecto</DialogTitle>
                        <DialogDescription>¿Eliminar «{project.name}»? Soft delete.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => setDeleteOpen(false)}
                            disabled={deleting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className="cursor-pointer"
                            onClick={() => void handleDelete()}
                            disabled={deleting}
                        >
                            {deleting ? 'Eliminando…' : 'Eliminar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
