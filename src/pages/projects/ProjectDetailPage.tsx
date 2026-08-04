import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Plus, RefreshCw, Trash2, Unlink } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AppSelect } from '@/components/app-select';
import { EntitySelect } from '@/components/entity-select';
import { usePageCrumb } from '@/components/layout/page-crumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError } from '@/lib/api';
import { listClientOptions } from '@/lib/clients';
import {
    LEDGER_STATUS_LABELS,
    createExpense,
    createPayment,
    formatMoney,
    listExpenses,
    listPayments,
    updateExpense,
    updatePayment,
    type Expense,
    type ExpenseInput,
    type Payment,
    type PaymentInput,
} from '@/lib/billing';
import { getJiraChangelog, listJiraProjects, searchJiraIssues, type JiraIssue, type JiraProject } from '@/lib/jira';
import {
    PROJECT_PRIORITY_BADGE_CLASS,
    PROJECT_PRIORITY_LABELS,
    PROJECT_STATUS_BADGE_CLASS,
    PROJECT_STATUS_LABELS,
    PROJECT_TYPES,
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
    type ProjectType,
} from '@/lib/projects';
import { formatHoursFromSeconds } from '@/lib/time';
import { listHours, listTeamHours, type Hour, type HoursMeta } from '@/lib/timer';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { ExpenseSheet } from '@/pages/billing/ExpenseSheet';
import { PaymentSheet } from '@/pages/billing/PaymentSheet';
import { HoursTable } from '@/pages/timer/HoursTable';

type Tab = 'summary' | 'hours' | 'billing' | 'config';

/** Bare query keys: ?hours · ?payments · ?settings (Resumen = sin query). */
const TAB_SEARCH: Record<Exclude<Tab, 'summary'>, string> = {
    hours: 'hours',
    billing: 'payments',
    config: 'settings',
};

function tabFromSearch(params: URLSearchParams, isAdmin: boolean): Tab {
    if (params.has('settings')) return 'config';
    if (isAdmin && params.has('hours')) return 'hours';
    if (isAdmin && (params.has('payments') || params.has('billing'))) return 'billing';
    return 'summary';
}

function searchForTab(tab: Tab): string {
    return tab === 'summary' ? '' : TAB_SEARCH[tab];
}
type Activity = {
    occurredAt: string;
    message: string;
    source: 'jira' | 'local';
    userName?: string | null;
};

type ConfigForm = {
    clientId: number;
    name: string;
    type: ProjectType;
    color: string;
    description: string;
};

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

function toConfigForm(p: Project): ConfigForm {
    return {
        clientId: p.clientId,
        name: p.name,
        type: p.type,
        color: p.color ?? '#ccff00',
        description: p.description ?? '',
    };
}

export function ProjectDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const projectId = Number(id);
    const tab = tabFromSearch(searchParams, isAdmin);

    const setTab = useCallback(
        (next: Tab) => {
            const search = searchForTab(next);
            if ((location.search.replace(/^\?/, '') || '') === search) return;
            navigate({ pathname: location.pathname, search }, { replace: true });
        },
        [navigate, location.pathname, location.search],
    );

    // Non-admin deep links to hours/payments → resumen
    useEffect(() => {
        if (isAdmin) return;
        if (searchParams.has('hours') || searchParams.has('payments') || searchParams.has('billing')) {
            navigate({ pathname: location.pathname, search: '' }, { replace: true });
        }
    }, [isAdmin, searchParams, navigate, location.pathname]);

    const [project, setProject] = useState<Project | null>(null);
    const [summary, setSummary] = useState<ProjectSummary | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [configForm, setConfigForm] = useState<ConfigForm | null>(null);
    const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
    const [savingConfig, setSavingConfig] = useState(false);
    const [jiraSpaces, setJiraSpaces] = useState<JiraProject[]>([]);
    const [jiraIssues, setJiraIssues] = useState<JiraIssue[]>([]);
    const [attachSpace, setAttachSpace] = useState('');
    const [attachMode, setAttachMode] = useState<'create' | 'link'>('create');
    const [attachIssue, setAttachIssue] = useState('');
    const [attachingJira, setAttachingJira] = useState(false);

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
    const [paymentMode, setPaymentMode] = useState<'add' | 'edit'>('add');
    const [expenseMode, setExpenseMode] = useState<'add' | 'edit'>('add');
    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    usePageCrumb(project?.name);

    const configDirtyRef = useRef(false);

    const applyLocalPayload = useCallback(
        (
            nextProject: Project,
            nextSummary: ProjectSummary,
            local: { data: ProjectActivity[] },
            jiraEntries: Activity[] = [],
            opts?: { forceForm?: boolean; keepJiraActivity?: boolean },
        ) => {
            setActivities((prev) => {
                const localRows: Activity[] = local.data.map((item: ProjectActivity) => ({
                    occurredAt: item.occurredAt,
                    message: item.message,
                    source: 'local' as const,
                    userName: item.user?.name ?? null,
                }));
                const jiraRows =
                    jiraEntries.length > 0
                        ? jiraEntries
                        : opts?.keepJiraActivity
                          ? prev.filter((a) => a.source === 'jira')
                          : [];
                return [...localRows, ...jiraRows]
                    .filter((item) => item.message)
                    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
                    .slice(0, 15);
            });

            setProject(nextProject);
            setSummary(nextSummary);
            // ponytail: don't wipe Config edits while background sync lands
            if (opts?.forceForm || !configDirtyRef.current) {
                setConfigForm(toConfigForm(nextProject));
                if (!nextSummary.jiraLinked) {
                    setAttachSpace(nextSummary.jiraProjectKey ?? '');
                    setAttachIssue('');
                    setAttachMode('create');
                }
            }
        },
        [],
    );

    /**
     * soft: refresh without full-page skeleton (after save).
     * Initial open: paint BDD first, then Jira in background.
     */
    const loadCore = useCallback(
        async (opts?: { soft?: boolean }) => {
            if (!Number.isFinite(projectId) || projectId < 1) {
                toastError('Proyecto no válido');
                setLoadFailed(true);
                setLoading(false);
                return;
            }
            const soft = opts?.soft ?? false;
            if (!soft) {
                setLoading(true);
                setLoadFailed(false);
            }
            try {
                const [nextProject, nextSummary, local] = await Promise.all([
                    getProject(projectId),
                    getProjectSummary(projectId),
                    listProjectActivities(projectId, { perPage: 20 }),
                ]);
                applyLocalPayload(nextProject, nextSummary, local, [], {
                    forceForm: true,
                    // after unlink, don't keep stale Jira changelog rows
                    keepJiraActivity: soft && Boolean(nextSummary.jiraLinked),
                });
                if (!soft) setLoading(false);

                if (soft) {
                    const issueKey = nextSummary.jiraIssueKey;
                    if (!issueKey) return;
                    const jira = await getJiraChangelog(issueKey).catch(() => []);
                    applyLocalPayload(
                        nextProject,
                        nextSummary,
                        local,
                        jira.map((entry) => ({
                            occurredAt: entry.created,
                            message: entry.items
                                .map((item) => `${item.field}: ${item.fromString || '—'} → ${item.toString || '—'}`)
                                .join(' · '),
                            source: 'jira' as const,
                        })),
                        { forceForm: true },
                    );
                    return;
                }

                void (async () => {
                    let projectAfter = nextProject;
                    let summaryAfter = nextSummary;
                    // Always sync this issue on detail open — batch throttle must not skip
                    // (user may have changed Jira after Home/list sync within 60s).
                    try {
                        projectAfter = await syncProjectJira(projectId);
                        summaryAfter = await getProjectSummary(projectId);
                        applyLocalPayload(projectAfter, summaryAfter, local);
                    } catch (err) {
                        if (!(err instanceof ApiError && err.status === 422)) {
                            /* silence flaky Jira */
                        }
                    }

                    const issueKey = summaryAfter.jiraIssueKey ?? nextSummary.jiraIssueKey;
                    if (!issueKey) return;
                    const jira = await getJiraChangelog(issueKey).catch(() => []);
                    applyLocalPayload(
                        projectAfter,
                        summaryAfter,
                        local,
                        jira.map((entry) => ({
                            occurredAt: entry.created,
                            message: entry.items
                                .map((item) => `${item.field}: ${item.fromString || '—'} → ${item.toString || '—'}`)
                                .join(' · '),
                            source: 'jira' as const,
                        })),
                    );
                })();
            } catch (err) {
                toastError(err);
                setProject(null);
                setLoadFailed(true);
                if (!soft) setLoading(false);
            }
        },
        [projectId, applyLocalPayload],
    );

    useEffect(() => {
        void loadCore();
    }, [loadCore]);

    useEffect(() => {
        if (tab !== 'config') return;
        let cancelled = false;
        void listClientOptions()
            .then((rows) => {
                if (!cancelled) setClients(rows);
            })
            .catch((err) => {
                if (!cancelled) toastError(err);
            });
        return () => {
            cancelled = true;
        };
    }, [tab]);

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
        if (!Number.isFinite(projectId) || projectId < 1) return;
        setBillingLoading(true);
        // ponytail: don't Promise.all — one 403/500 on summary used to blank both tables
        const settled = await Promise.allSettled([
            getBillingSummary(projectId),
            listPayments({ projectId, perPage: 50 }),
            listExpenses({ projectId, perPage: 50 }),
        ]);
        const [summaryResult, paymentsResult, expensesResult] = settled;
        if (summaryResult.status === 'fulfilled') {
            setBillingSummary(summaryResult.value);
        } else {
            toastError(summaryResult.reason);
        }
        if (paymentsResult.status === 'fulfilled') {
            setPayments(Array.isArray(paymentsResult.value.data) ? paymentsResult.value.data : []);
        } else {
            setPayments([]);
            toastError(paymentsResult.reason);
        }
        if (expensesResult.status === 'fulfilled') {
            setExpenses(Array.isArray(expensesResult.value.data) ? expensesResult.value.data : []);
        } else {
            setExpenses([]);
            toastError(expensesResult.reason);
        }
        setBillingLoading(false);
    }, [isAdmin, projectId]);

    useEffect(() => {
        if (tab === 'billing') void loadBilling();
    }, [tab, loadBilling]);

    const configDirty = useMemo(() => {
        if (!project || !configForm) return false;
        const baseline = toConfigForm(project);
        return (
            configForm.clientId !== baseline.clientId ||
            configForm.name.trim() !== baseline.name ||
            configForm.type !== baseline.type ||
            (configForm.color || '#ccff00') !== (baseline.color || '#ccff00') ||
            (configForm.description.trim() || '') !== (baseline.description.trim() || '')
        );
    }, [project, configForm]);

    useEffect(() => {
        configDirtyRef.current = configDirty;
    }, [configDirty]);

    useEffect(() => {
        if (tab !== 'config' || !isAdmin || summary?.jiraLinked) return;
        const controller = new AbortController();
        void listJiraProjects(controller.signal)
            .then(setJiraSpaces)
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                toastError(err);
            });
        return () => controller.abort();
    }, [tab, isAdmin, summary?.jiraLinked]);

    useEffect(() => {
        if (tab !== 'config' || !isAdmin || summary?.jiraLinked || attachMode !== 'link' || !attachSpace) {
            setJiraIssues([]);
            return;
        }
        const controller = new AbortController();
        void searchJiraIssues(attachSpace, '', controller.signal)
            .then(setJiraIssues)
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                toastError(err);
            });
        return () => controller.abort();
    }, [tab, isAdmin, summary?.jiraLinked, attachMode, attachSpace]);

    async function handleConfigSave(e: FormEvent) {
        e.preventDefault();
        if (!configForm || !configDirty) return;
        if (!configForm.clientId) {
            toastError('Selecciona un cliente.');
            return;
        }
        setSavingConfig(true);
        try {
            await updateProject(projectId, {
                clientId: configForm.clientId,
                name: configForm.name.trim(),
                type: configForm.type,
                color: configForm.color.trim() || '#ccff00',
                description: configForm.description.trim() || null,
            });
            toastSuccess('Proyecto actualizado');
            configDirtyRef.current = false;
            await loadCore({ soft: true });
        } catch (err) {
            toastError(err);
        } finally {
            setSavingConfig(false);
        }
    }

    async function handleJiraAttach() {
        if (!attachSpace) {
            toastError('Selecciona un espacio Jira.');
            return;
        }
        if (attachMode === 'link' && !attachIssue) {
            toastError('Selecciona un issue.');
            return;
        }
        setAttachingJira(true);
        try {
            await updateProject(projectId, {
                jiraProjectKey: attachSpace,
                jiraMode: attachMode,
                jiraIssueKey: attachMode === 'link' ? attachIssue : null,
            });
            toastSuccess(attachMode === 'create' ? 'Tarea Jira creada y vinculada' : 'Issue Jira vinculado');
            await loadCore({ soft: true });
        } catch (err) {
            toastError(err);
        } finally {
            setAttachingJira(false);
        }
    }

    async function handleDelete() {
        setDeleting(true);
        try {
            // soft-delete BOhub only — never deletes the Jira issue
            await deleteProject(projectId);
            toastSuccess('Proyecto eliminado en BOhub (Jira intacto)');
            navigate('/dashboard/projects');
        } catch (err) {
            toastError(err);
            setDeleting(false);
        }
    }

    async function handleJiraUnlink() {
        try {
            await updateProject(projectId, { unlinkJira: true });
            toastSuccess('Issue de Jira desvinculado');
            configDirtyRef.current = false;
            await loadCore({ soft: true });
        } catch (err) {
            toastError(err);
        }
    }

    async function handleSavePayment(data: PaymentInput) {
        if (paymentMode === 'edit' && editingPayment) {
            await updatePayment(editingPayment.id, data);
            toastSuccess('Ingreso actualizado');
        } else {
            await createPayment(data);
            toastSuccess('Ingreso creado');
        }
        await loadBilling();
        void loadCore({ soft: true });
    }

    async function handleSaveExpense(data: ExpenseInput) {
        if (expenseMode === 'edit' && editingExpense) {
            await updateExpense(editingExpense.id, data);
            toastSuccess('Gasto actualizado');
        } else {
            await createExpense(data);
            toastSuccess('Gasto creado');
        }
        await loadBilling();
        void loadCore({ soft: true });
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
                <Button
                    variant="outline"
                    className="w-fit cursor-pointer"
                    nativeButton={false}
                    render={<Link to="/dashboard/projects" />}
                >
                    <ArrowLeft />
                    Volver a proyectos
                </Button>
            </div>
        );
    }

    if (!project || !configForm) return null;

    return (
        <div className="flex flex-col gap-6">
            <div className="min-w-0">
                <Button
                    variant="ghost"
                    size="sm"
                    className="mb-2 -ml-2 cursor-pointer"
                    nativeButton={false}
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
                    <Card className="gap-3 py-4">
                        <CardContent className="px-4 pt-2">
                            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <div className="grid gap-1">
                                    <dt className="text-sm text-muted-foreground">Proyecto</dt>
                                    <dd className="text-sm font-medium text-foreground">{project.name}</dd>
                                </div>
                                <div className="grid gap-1">
                                    <dt className="text-sm text-muted-foreground">Cliente</dt>
                                    <dd className="text-sm font-medium text-foreground">{project.client?.name ?? '—'}</dd>
                                </div>
                                <div className="grid gap-1">
                                    <dt className="text-sm text-muted-foreground">Estado</dt>
                                    <dd>
                                        <Badge
                                            variant="outline"
                                            className={PROJECT_STATUS_BADGE_CLASS[project.status]}
                                        >
                                            {PROJECT_STATUS_LABELS[project.status]}
                                        </Badge>
                                    </dd>
                                </div>
                                <div className="grid gap-1">
                                    <dt className="text-sm text-muted-foreground">Tipo</dt>
                                    <dd className="text-sm font-medium text-foreground">
                                        {PROJECT_TYPE_LABELS[project.type]}
                                    </dd>
                                </div>
                                <div className="grid gap-1">
                                    <dt className="text-sm text-muted-foreground">Fin</dt>
                                    <dd>
                                        <Badge variant="outline">{project.endDate || '—'}</Badge>
                                    </dd>
                                </div>
                                <div className="grid gap-1">
                                    <dt className="text-sm text-muted-foreground">Días restantes</dt>
                                    <dd className="text-sm font-medium text-foreground">{daysRemaining}</dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    {(summary?.jiraProjectUrl || summary?.jiraIssueUrl) && (
                        <Card className="gap-3 py-4">
                            <CardHeader className="px-4">
                                <CardTitle>Jira</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-3 px-4">
                                {summary.jiraProjectUrl && (
                                    <Button
                                        variant="outline"
                                        nativeButton={false}
                                        render={
                                            <a href={summary.jiraProjectUrl} target="_blank" rel="noreferrer" />
                                        }
                                    >
                                        {summary.jiraProjectKey} <ExternalLink />
                                    </Button>
                                )}
                                {summary.jiraIssueUrl && (
                                    <Button
                                        variant="outline"
                                        nativeButton={false}
                                        render={
                                            <a href={summary.jiraIssueUrl} target="_blank" rel="noreferrer" />
                                        }
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
                                            <div className="min-w-0 flex-1">
                                                <p className="text-foreground">{activity.message}</p>
                                                {(activity.userName || activity.source === 'jira') && (
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        {[
                                                            activity.userName,
                                                            activity.source === 'jira' ? 'Jira' : null,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' · ')}
                                                    </p>
                                                )}
                                            </div>
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
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        setPaymentMode('add');
                                        setEditingPayment(null);
                                        setPaymentOpen(true);
                                    }}
                                >
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
                                        {billingLoading && payments.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4}>
                                                    <Skeleton className="h-8 w-full" />
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {!billingLoading && payments.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                                                    Sin ingresos.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {payments.map((payment) => (
                                            <TableRow
                                                key={payment.id}
                                                className="cursor-pointer"
                                                onClick={() => {
                                                    setPaymentMode('edit');
                                                    setEditingPayment(payment);
                                                    setPaymentOpen(true);
                                                }}
                                            >
                                                <TableCell className="text-muted-foreground">
                                                    {payment.invoiceDate || '—'}
                                                </TableCell>
                                                <TableCell className="font-medium text-foreground">
                                                    <span className="inline-flex items-center gap-2">
                                                        {payment.reference || payment.invoiceNumber || '—'}
                                                        {payment.invoiceUrl ? (
                                                            <a
                                                                href={payment.invoiceUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-primary"
                                                                aria-label="Abrir PDF"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <ExternalLink className="size-3.5" />
                                                            </a>
                                                        ) : null}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {LEDGER_STATUS_LABELS[payment.status] ?? payment.status}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-foreground">
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
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        setExpenseMode('add');
                                        setEditingExpense(null);
                                        setExpenseOpen(true);
                                    }}
                                >
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
                                        {billingLoading && expenses.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4}>
                                                    <Skeleton className="h-8 w-full" />
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {!billingLoading && expenses.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                                                    Sin gastos.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {expenses.map((expense) => (
                                            <TableRow
                                                key={expense.id}
                                                className="cursor-pointer"
                                                onClick={() => {
                                                    setExpenseMode('edit');
                                                    setEditingExpense(expense);
                                                    setExpenseOpen(true);
                                                }}
                                            >
                                                <TableCell className="text-muted-foreground">
                                                    {expense.expenseDate || '—'}
                                                </TableCell>
                                                <TableCell className="font-medium text-foreground">
                                                    <span className="inline-flex items-center gap-2">
                                                        {expense.description}
                                                        {expense.invoiceUrl ? (
                                                            <a
                                                                href={expense.invoiceUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-primary"
                                                                aria-label="Abrir PDF"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <ExternalLink className="size-3.5" />
                                                            </a>
                                                        ) : null}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {LEDGER_STATUS_LABELS[expense.status] ?? expense.status}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-foreground">
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
                <form className="flex w-full flex-col gap-6" noValidate onSubmit={(e) => void handleConfigSave(e)}>
                    <Card className="gap-4 py-4">
                        <CardHeader className="px-4">
                            <CardTitle>Datos del proyecto</CardTitle>
                            <CardDescription>
                                Estado, prioridad y fecha fin se sincronizan desde Jira cuando hay issue vinculado.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 px-4">
                            <div className="grid gap-2">
                                <Label htmlFor="cfg-name">Nombre</Label>
                                <Input
                                    id="cfg-name"
                                    required
                                    maxLength={255}
                                    value={configForm.name}
                                    onChange={(e) => setConfigForm((f) => (f ? { ...f, name: e.target.value } : f))}
                                    className="bg-card"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cfg-client">Cliente</Label>
                                <EntitySelect
                                    id="cfg-client"
                                    value={configForm.clientId || null}
                                    onValueChange={(cid) =>
                                        setConfigForm((f) => (f ? { ...f, clientId: cid ?? 0 } : f))
                                    }
                                    items={clients}
                                    placeholder="Seleccionar…"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cfg-type">Tipo</Label>
                                <AppSelect
                                    id="cfg-type"
                                    items={PROJECT_TYPES.map((type) => ({
                                        label: PROJECT_TYPE_LABELS[type],
                                        value: type,
                                    }))}
                                    value={configForm.type}
                                    onValueChange={(value) =>
                                        setConfigForm((f) => (f ? { ...f, type: value as ProjectType } : f))
                                    }
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                <div className="grid gap-1">
                                    <span className="text-sm text-muted-foreground">Estado</span>
                                    <Badge
                                        variant="outline"
                                        className={cn('w-fit', PROJECT_STATUS_BADGE_CLASS[project.status])}
                                    >
                                        {PROJECT_STATUS_LABELS[project.status]}
                                    </Badge>
                                </div>
                                <div className="grid gap-1">
                                    <span className="text-sm text-muted-foreground">Prioridad</span>
                                    <Badge
                                        variant="outline"
                                        className={cn('w-fit', PROJECT_PRIORITY_BADGE_CLASS[project.priority])}
                                    >
                                        {PROJECT_PRIORITY_LABELS[project.priority]}
                                    </Badge>
                                </div>
                                <div className="grid gap-1">
                                    <span className="text-sm text-muted-foreground">Fin</span>
                                    <Badge variant="outline" className="w-fit">
                                        {project.endDate || '—'}
                                    </Badge>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cfg-color">Color</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="cfg-color"
                                        type="color"
                                        value={configForm.color || '#ccff00'}
                                        onChange={(e) =>
                                            setConfigForm((f) => (f ? { ...f, color: e.target.value } : f))
                                        }
                                        className="h-9 w-12 cursor-pointer rounded-md border border-border bg-card"
                                    />
                                    <Input
                                        value={configForm.color}
                                        onChange={(e) =>
                                            setConfigForm((f) => (f ? { ...f, color: e.target.value } : f))
                                        }
                                        className="bg-card font-mono text-sm"
                                        maxLength={7}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cfg-desc">Descripción</Label>
                                <Textarea
                                    id="cfg-desc"
                                    rows={4}
                                    value={configForm.description}
                                    onChange={(e) =>
                                        setConfigForm((f) => (f ? { ...f, description: e.target.value } : f))
                                    }
                                    className="bg-card"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="gap-4 py-4">
                        <CardHeader className="px-4">
                            <CardTitle>Jira</CardTitle>
                            <CardDescription>
                                {summary?.jiraLinked
                                    ? 'Espacio e issue en solo lectura. Para cambiarlos, desvincula primero.'
                                    : 'Vincula un espacio e issue (crear o asignar).'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 px-4">
                            {summary?.jiraLinked ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="grid gap-1">
                                        <span className="text-sm text-muted-foreground">Espacio</span>
                                        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
                                            {summary.jiraProjectKey || '—'}
                                        </p>
                                    </div>
                                    <div className="grid gap-1">
                                        <span className="text-sm text-muted-foreground">Issue</span>
                                        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
                                            {summary.jiraIssueKey || '—'}
                                        </p>
                                    </div>
                                </div>
                            ) : isAdmin ? (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="cfg-jira-space">Espacio</Label>
                                        <AppSelect
                                            id="cfg-jira-space"
                                            items={jiraSpaces.map((space) => ({
                                                label: `${space.name} (${space.key})`,
                                                value: space.key,
                                            }))}
                                            value={attachSpace}
                                            onValueChange={(value) => {
                                                setAttachSpace(value ?? '');
                                                setAttachIssue('');
                                            }}
                                            placeholder="Seleccionar espacio…"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Tarea Jira</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                type="button"
                                                variant={attachMode === 'create' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => {
                                                    setAttachMode('create');
                                                    setAttachIssue('');
                                                }}
                                            >
                                                Crear
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={attachMode === 'link' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setAttachMode('link')}
                                            >
                                                Asignar
                                            </Button>
                                        </div>
                                    </div>
                                    {attachMode === 'link' && (
                                        <div className="grid gap-2">
                                            <Label htmlFor="cfg-jira-issue">Issue</Label>
                                            <AppSelect
                                                id="cfg-jira-issue"
                                                items={jiraIssues.map((issue) => ({
                                                    label: `${issue.key} · ${issue.summary}`,
                                                    value: issue.key,
                                                }))}
                                                value={attachIssue}
                                                onValueChange={(value) => setAttachIssue(value ?? '')}
                                                placeholder={
                                                    attachSpace ? 'Seleccionar issue…' : 'Elige un espacio primero'
                                                }
                                                disabled={!attachSpace}
                                            />
                                        </div>
                                    )}
                                    <Button
                                        type="button"
                                        className="w-fit cursor-pointer"
                                        disabled={attachingJira}
                                        onClick={() => void handleJiraAttach()}
                                    >
                                        {attachingJira
                                            ? 'Vinculando…'
                                            : attachMode === 'create'
                                              ? 'Crear y vincular'
                                              : 'Vincular issue'}
                                    </Button>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">Sin issue Jira vinculado.</p>
                            )}
                            {isAdmin && summary?.jiraLinked && (
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" onClick={() => void handleJiraUnlink()}>
                                        <Unlink /> Desvincular
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            void (async () => {
                                                try {
                                                    await syncProjectJira(projectId);
                                                    await loadCore({ soft: true });
                                                    toastSuccess('Sincronizado desde Jira');
                                                } catch (err) {
                                                    if (!(err instanceof ApiError && err.status === 422)) toastError(err);
                                                }
                                            })();
                                        }}
                                    >
                                        <RefreshCw /> Sincronizar
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                        <Button
                            type="submit"
                            className="cursor-pointer"
                            disabled={!configDirty || savingConfig}
                        >
                            {savingConfig ? 'Guardando…' : 'Guardar cambios'}
                        </Button>
                        {isAdmin && (
                            <Button
                                type="button"
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() => setDeleteOpen(true)}
                            >
                                <Trash2 /> Eliminar proyecto
                            </Button>
                        )}
                    </div>
                </form>
            )}

            <PaymentSheet
                open={paymentOpen}
                mode={paymentMode}
                payment={editingPayment}
                lockedProjectId={projectId}
                onOpenChange={(open) => {
                    setPaymentOpen(open);
                    if (!open) setEditingPayment(null);
                }}
                onSubmit={handleSavePayment}
            />
            <ExpenseSheet
                open={expenseOpen}
                mode={expenseMode}
                expense={editingExpense}
                lockedProjectId={projectId}
                onOpenChange={(open) => {
                    setExpenseOpen(open);
                    if (!open) setEditingExpense(null);
                }}
                onSubmit={handleSaveExpense}
            />

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar proyecto</DialogTitle>
                        <DialogDescription>
                            ¿Eliminar «{project.name}» de BOhub? Soft delete local. La tarea vinculada en Jira no se
                            elimina ni se modifica.
                        </DialogDescription>
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
