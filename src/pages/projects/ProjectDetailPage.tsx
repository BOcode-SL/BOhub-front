import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, FileWarning, Mail, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, Unlink } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AppSelect } from '@/components/app-select';
import { EntitySelect } from '@/components/entity-select';
import { FormField } from '@/components/form-field';
import { usePageCrumb } from '@/components/layout/page-crumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { listClientOptions } from '@/lib/clients';
import {
    createExpense,
    createPayment,
    deleteExpense,
    deletePayment,
    downloadPaymentInvoice,
    formatMoney,
    isPaymentIssued,
    listExpenses,
    listPayments,
    updateExpense,
    updatePayment,
    type Expense,
    type ExpenseInput,
    type Payment,
    type PaymentInput,
} from '@/lib/billing';
import { LedgerStatusBadge } from '@/components/ledger-status-badge';
import { EmitPaymentDialog } from '@/pages/billing/EmitPaymentDialog';
import { ExpenseSheet } from '@/pages/billing/ExpenseSheet';
import { PaymentSheet } from '@/pages/billing/PaymentSheet';
import { SendInvoiceDialog } from '@/pages/billing/SendInvoiceDialog';
import {
    getJiraChangelog,
    listJiraProjects,
    searchJiraIssues,
    type JiraChangelogEntry,
    type JiraIssue,
    type JiraProject,
} from '@/lib/jira';
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
    wasJiraBatchRecent,
    type ProjectActivity,
    type ProjectBillingSummary,
    type ProjectHoursSummary,
    type ProjectSummary,
    type Project,
    type ProjectType,
} from '@/lib/projects';
import { formatProjectActivityMessage } from '@/lib/project-activity';
import { formatHoursFromSeconds } from '@/lib/time';
import { listTeamHours, type Hour, type HoursMeta } from '@/lib/timer';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';
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
    event?: string;
    source: 'jira' | 'local';
    userName?: string | null;
};

function mapJiraActivity(entries: JiraChangelogEntry[]): Activity[] {
    return entries.map((entry) => ({
        occurredAt: entry.created,
        message: entry.items
            .map((item) => `${item.field}: ${item.fromString || '—'} → ${item.toString || '—'}`)
            .join(' · '),
        source: 'jira' as const,
    }));
}

/** Recompute daysRemaining from Project.endDate so we can skip getProjectSummary after sync. */
function summaryAfterProjectSync(base: ProjectSummary, p: Project): ProjectSummary {
    let daysRemaining: number | null = null;
    if (p.endDate) {
        const end = Date.parse(`${p.endDate}T12:00:00`);
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        daysRemaining = Math.round((end - today.getTime()) / 86_400_000);
    }
    return { ...base, daysRemaining };
}

type ConfigForm = {
    clientId: number;
    name: string;
    type: ProjectType;
    color: string;
    description: string;
};

function StatCard({ label, value }: { label: string; value: ReactNode }) {
    return (
        <Card className="min-w-0 gap-2 py-4">
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
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    const [ledgerDeleteTarget, setLedgerDeleteTarget] = useState<
        { kind: 'payment'; row: Payment } | { kind: 'expense'; row: Expense } | null
    >(null);
    const [ledgerDeleting, setLedgerDeleting] = useState(false);
    const [emitPaymentTarget, setEmitPaymentTarget] = useState<Payment | null>(null);
    const [sendInvoicePayment, setSendInvoicePayment] = useState<Payment | null>(null);

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
                    event: item.event,
                    message: formatProjectActivityMessage(item.event, item.message),
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
                    .filter((item) => item.message.trim())
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

                const issueKey = nextSummary.jiraIssueKey;

                if (soft) {
                    // ponytail: don't block soft refresh on changelog
                    if (!issueKey) return;
                    void getJiraChangelog(issueKey)
                        .catch(() => [])
                        .then((jira) => {
                            applyLocalPayload(nextProject, nextSummary, local, mapJiraActivity(jira), {
                                forceForm: true,
                            });
                        });
                    return;
                }

                void (async () => {
                    let projectAfter = nextProject;
                    let summaryAfter = nextSummary;
                    // Skip auto-sync if Home/list batch ran <60s ago; manual Sync always forces.
                    const shouldSync = Boolean(nextSummary.jiraLinked) && !wasJiraBatchRecent();
                    const changelogPromise = issueKey
                        ? getJiraChangelog(issueKey).catch(() => [] as JiraChangelogEntry[])
                        : Promise.resolve([] as JiraChangelogEntry[]);

                    if (shouldSync) {
                        try {
                            const [synced, jira] = await Promise.all([
                                syncProjectJira(projectId),
                                changelogPromise,
                            ]);
                            projectAfter = synced;
                            summaryAfter = summaryAfterProjectSync(nextSummary, synced);
                            applyLocalPayload(projectAfter, summaryAfter, local, mapJiraActivity(jira));
                            return;
                        } catch (err) {
                            if (!(err instanceof ApiError && err.status === 422)) {
                                /* silence flaky Jira */
                            }
                        }
                    }

                    if (!issueKey) return;
                    const jira = await changelogPromise;
                    applyLocalPayload(projectAfter, summaryAfter, local, mapJiraActivity(jira));
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
        // hours tab is admin-only (see tabFromSearch + redirect)
        if (tab !== 'hours') return;
        const controller = new AbortController();
        setHoursLoading(true);
        void Promise.all([
            getHoursSummary(projectId, controller.signal),
            listTeamHours({ projectId, page: hoursPage, perPage: 20 }, controller.signal),
        ])
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
    }, [tab, projectId, hoursPage]);

    const billingAbortRef = useRef<AbortController | null>(null);

    const loadBilling = useCallback(async () => {
        if (!isAdmin) return;
        if (!Number.isFinite(projectId) || projectId < 1) return;
        billingAbortRef.current?.abort();
        const controller = new AbortController();
        billingAbortRef.current = controller;
        setBillingLoading(true);
        // ponytail: don't Promise.all — one 403/500 on summary used to blank both tables
        const settled = await Promise.allSettled([
            getBillingSummary(projectId, controller.signal),
            listPayments({ projectId, perPage: 50 }, controller.signal),
            listExpenses({ projectId, perPage: 50 }, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';
        const [summaryResult, paymentsResult, expensesResult] = settled;
        if (summaryResult.status === 'fulfilled') {
            setBillingSummary(summaryResult.value);
        } else if (!isAbort(summaryResult.reason)) {
            toastError(summaryResult.reason);
        }
        if (paymentsResult.status === 'fulfilled') {
            setPayments(Array.isArray(paymentsResult.value.data) ? paymentsResult.value.data : []);
        } else if (!isAbort(paymentsResult.reason)) {
            setPayments([]);
            toastError(paymentsResult.reason);
        }
        if (expensesResult.status === 'fulfilled') {
            setExpenses(Array.isArray(expensesResult.value.data) ? expensesResult.value.data : []);
        } else if (!isAbort(expensesResult.reason)) {
            setExpenses([]);
            toastError(expensesResult.reason);
        }
        setBillingLoading(false);
    }, [isAdmin, projectId]);

    useEffect(() => {
        if (tab === 'billing') void loadBilling();
        return () => billingAbortRef.current?.abort();
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
            setFieldErrors((prev) => ({ ...prev, clientId: 'Selecciona un cliente.' }));
            toastError('Selecciona un cliente.');
            return;
        }
        setSavingConfig(true);
        setFieldErrors({});
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
            if (err instanceof ApiError && err.fieldErrors) {
                setFieldErrors(flattenFieldErrors(err.fieldErrors));
            }
            toastError(err);
        } finally {
            setSavingConfig(false);
        }
    }

    function setConfigField<K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) {
        setConfigForm((f) => (f ? { ...f, [key]: value } : f));
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
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

    async function handleDeleteLedger() {
        if (!ledgerDeleteTarget) return;
        setLedgerDeleting(true);
        try {
            if (ledgerDeleteTarget.kind === 'payment') {
                await deletePayment(ledgerDeleteTarget.row.id);
                toastSuccess('Ingreso eliminado');
            } else {
                await deleteExpense(ledgerDeleteTarget.row.id);
                toastSuccess('Gasto eliminado');
            }
            setLedgerDeleteTarget(null);
            await loadBilling();
            void loadCore({ soft: true });
        } catch (err) {
            toastError(err);
        } finally {
            setLedgerDeleting(false);
        }
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
        <div className="flex min-w-0 flex-col gap-6">
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
                                    <dd className="truncate text-sm font-medium text-foreground" title={project.name}>
                                        {project.name}
                                    </dd>
                                </div>
                                <div className="grid gap-1">
                                    <dt className="text-sm text-muted-foreground">Cliente</dt>
                                    <dd
                                        className="truncate text-sm font-medium text-foreground"
                                        title={project.client?.name ?? undefined}
                                    >
                                        {project.client?.name ?? '—'}
                                    </dd>
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
                                        <li
                                            key={`${activity.occurredAt}-${index}`}
                                            className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:gap-4"
                                        >
                                            <time className="shrink-0 text-muted-foreground sm:w-36">
                                                {new Date(activity.occurredAt).toLocaleString('es-ES')}
                                            </time>
                                            <div className="min-w-0 flex-1">
                                                <p className="break-words text-foreground">{activity.message}</p>
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
                <div className="grid min-w-0 gap-6">
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
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
                    <Card className="min-w-0 gap-3 py-4">
                        <CardHeader className="px-4">
                            <CardTitle>Registro</CardTitle>
                        </CardHeader>
                        <CardContent className="flex min-w-0 flex-col gap-4 px-4">
                            <HoursTable
                                hours={hours}
                                meta={hoursMeta}
                                loading={hoursLoading}
                                showUser
                                showActions={false}
                                hideProject
                                page={hoursPage}
                                onPageChange={setHoursPage}
                            />
                        </CardContent>
                    </Card>
                </div>
            )}

            {tab === 'billing' && isAdmin && (
                <div className="grid min-w-0 gap-6">
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard label="Facturado" value={formatMoney(billingSummary?.paymentsTotal ?? 0)} />
                        <StatCard label="Cobro neto" value={formatMoney(billingSummary?.paymentsNet ?? 0)} />
                        <StatCard label="Gastos" value={formatMoney(billingSummary?.expensesTotal ?? 0)} />
                        <StatCard label="Beneficio neto" value={formatMoney(billingSummary?.netBenefit ?? 0)} />
                    </div>

                    <Card className="min-w-0 gap-3 py-4">
                        <CardHeader className="px-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
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
                        <CardContent className="min-w-0 px-4">
                            <div className="min-w-0 overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nº</TableHead>
                                            <TableHead>F. Factura</TableHead>
                                            <TableHead>Concepto</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead className="hidden sm:table-cell text-right">Base</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="w-10">
                                                <span className="sr-only">Acciones</span>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {billingLoading && payments.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7}>
                                                    <Skeleton className="h-8 w-full" />
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {!billingLoading && payments.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                                                    Sin ingresos.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {payments.map((payment) => {
                                            const description = payment.concept?.trim() || '—';
                                            return (
                                                <TableRow key={payment.id}>
                                                    <TableCell className="font-mono text-foreground whitespace-nowrap">
                                                        {payment.invoiceNumber?.trim() || '—'}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground whitespace-nowrap">
                                                        {payment.invoiceDate || '—'}
                                                    </TableCell>
                                                    <TableCell
                                                        className="max-w-[10rem] truncate font-medium text-foreground sm:max-w-[20rem]"
                                                        title={description !== '—' ? description : undefined}
                                                    >
                                                        {description}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <LedgerStatusBadge status={payment.status} />
                                                            {isPaymentIssued(payment.status) &&
                                                            !payment.storageKey?.trim() ? (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="border-transparent bg-amber-500/15 font-normal text-amber-300"
                                                                >
                                                                    Sin archivo
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden text-right text-muted-foreground whitespace-nowrap sm:table-cell">
                                                        {formatMoney(payment.baseAmount ?? 0)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-foreground whitespace-nowrap">
                                                        {formatMoney(payment.totalAmount)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                render={
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon-sm"
                                                                        className="cursor-pointer"
                                                                    />
                                                                }
                                                            >
                                                                <MoreHorizontal />
                                                                <span className="sr-only">Acciones</span>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer"
                                                                    onClick={() => {
                                                                        setPaymentMode('edit');
                                                                        setEditingPayment(payment);
                                                                        setPaymentOpen(true);
                                                                    }}
                                                                >
                                                                    <Pencil />
                                                                    Editar
                                                                </DropdownMenuItem>
                                                                {payment.status === 'draft' ? (
                                                                    <DropdownMenuItem
                                                                        className="cursor-pointer"
                                                                        onClick={() => setEmitPaymentTarget(payment)}
                                                                    >
                                                                        <FileWarning />
                                                                        Emitir factura
                                                                    </DropdownMenuItem>
                                                                ) : null}
                                                                {!isPaymentIssued(payment.status) ||
                                                                payment.storageKey?.trim() ? (
                                                                    <DropdownMenuItem
                                                                        className="cursor-pointer"
                                                                        onClick={() => {
                                                                            void downloadPaymentInvoice(payment.id)
                                                                                .then(() =>
                                                                                    toastSuccess(
                                                                                        isPaymentIssued(payment.status)
                                                                                            ? 'PDF descargado'
                                                                                            : 'Borrador PDF descargado',
                                                                                    ),
                                                                                )
                                                                                .catch((err) => toastError(err));
                                                                        }}
                                                                    >
                                                                        <Download />
                                                                        {isPaymentIssued(payment.status)
                                                                            ? 'Descargar PDF'
                                                                            : 'Vista borrador PDF'}
                                                                    </DropdownMenuItem>
                                                                ) : null}
                                                                {isPaymentIssued(payment.status) ? (
                                                                    <DropdownMenuItem
                                                                        className="cursor-pointer"
                                                                        onClick={() => setSendInvoicePayment(payment)}
                                                                    >
                                                                        <Mail />
                                                                        Enviar factura
                                                                    </DropdownMenuItem>
                                                                ) : null}
                                                                {payment.status === 'draft' ? (
                                                                    <DropdownMenuItem
                                                                        variant="destructive"
                                                                        className="cursor-pointer"
                                                                        onClick={() =>
                                                                            setLedgerDeleteTarget({
                                                                                kind: 'payment',
                                                                                row: payment,
                                                                            })
                                                                        }
                                                                    >
                                                                        <Trash2 />
                                                                        Eliminar
                                                                    </DropdownMenuItem>
                                                                ) : null}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="min-w-0 gap-3 py-4">
                        <CardHeader className="px-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
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
                        <CardContent className="min-w-0 px-4">
                            <div className="min-w-0 overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>F. Factura</TableHead>
                                            <TableHead>Descripción</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead className="hidden sm:table-cell text-right">Base</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="w-10">
                                                <span className="sr-only">Acciones</span>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {billingLoading && expenses.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6}>
                                                    <Skeleton className="h-8 w-full" />
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {!billingLoading && expenses.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                                                    Sin gastos.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {expenses.map((expense) => {
                                            const description = expense.description || '—';
                                            return (
                                                <TableRow key={expense.id}>
                                                    <TableCell className="text-muted-foreground whitespace-nowrap">
                                                        {expense.expenseDate || '—'}
                                                    </TableCell>
                                                    <TableCell
                                                        className="max-w-[10rem] truncate font-medium text-foreground sm:max-w-[20rem]"
                                                        title={description}
                                                    >
                                                        {description}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <LedgerStatusBadge status={expense.status} />
                                                            {!expense.storageKey?.trim() ? (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="border-transparent bg-amber-500/15 font-normal text-amber-300"
                                                                >
                                                                    Sin archivo
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden text-right text-muted-foreground whitespace-nowrap sm:table-cell">
                                                        {formatMoney(expense.baseAmount ?? 0)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-foreground whitespace-nowrap">
                                                        {formatMoney(expense.totalAmount)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                render={
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon-sm"
                                                                        className="cursor-pointer"
                                                                    />
                                                                }
                                                            >
                                                                <MoreHorizontal />
                                                                <span className="sr-only">Acciones</span>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer"
                                                                    onClick={() => {
                                                                        setExpenseMode('edit');
                                                                        setEditingExpense(expense);
                                                                        setExpenseOpen(true);
                                                                    }}
                                                                >
                                                                    <Pencil />
                                                                    Editar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    variant="destructive"
                                                                    className="cursor-pointer"
                                                                    onClick={() =>
                                                                        setLedgerDeleteTarget({
                                                                            kind: 'expense',
                                                                            row: expense,
                                                                        })
                                                                    }
                                                                >
                                                                    <Trash2 />
                                                                    Eliminar
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
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
                            <FormField id="cfg-name" label="Nombre" error={fieldErrors.name}>
                                <Input
                                    id="cfg-name"
                                    required
                                    maxLength={255}
                                    value={configForm.name}
                                    onChange={(e) => setConfigField('name', e.target.value)}
                                    className="bg-card"
                                    aria-invalid={!!fieldErrors.name}
                                />
                            </FormField>
                            <FormField id="cfg-client" label="Cliente" error={fieldErrors.clientId}>
                                <EntitySelect
                                    id="cfg-client"
                                    value={configForm.clientId || null}
                                    onValueChange={(cid) => setConfigField('clientId', cid ?? 0)}
                                    items={clients}
                                    placeholder="Seleccionar…"
                                    aria-invalid={!!fieldErrors.clientId}
                                />
                            </FormField>
                            <FormField id="cfg-type" label="Tipo" error={fieldErrors.type}>
                                <AppSelect
                                    id="cfg-type"
                                    items={PROJECT_TYPES.map((type) => ({
                                        label: PROJECT_TYPE_LABELS[type],
                                        value: type,
                                    }))}
                                    value={configForm.type}
                                    onValueChange={(value) => setConfigField('type', value as ProjectType)}
                                    aria-invalid={!!fieldErrors.type}
                                />
                            </FormField>
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
                            <FormField id="cfg-color" label="Color" error={fieldErrors.color}>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="cfg-color"
                                        type="color"
                                        value={configForm.color || '#ccff00'}
                                        onChange={(e) => setConfigField('color', e.target.value)}
                                        className="h-9 w-12 cursor-pointer rounded-md border border-border bg-card"
                                        aria-invalid={!!fieldErrors.color}
                                    />
                                    <Input
                                        value={configForm.color}
                                        onChange={(e) => setConfigField('color', e.target.value)}
                                        className="bg-card font-mono text-sm"
                                        maxLength={7}
                                        aria-invalid={!!fieldErrors.color}
                                    />
                                </div>
                            </FormField>
                            <FormField id="cfg-desc" label="Descripción" error={fieldErrors.description}>
                                <Textarea
                                    id="cfg-desc"
                                    rows={4}
                                    value={configForm.description}
                                    onChange={(e) => setConfigField('description', e.target.value)}
                                    className="bg-card"
                                    aria-invalid={!!fieldErrors.description}
                                />
                            </FormField>
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
                                                    const issueKey = summary?.jiraIssueKey;
                                                    const [synced, local, jira] = await Promise.all([
                                                        syncProjectJira(projectId),
                                                        listProjectActivities(projectId, { perPage: 20 }),
                                                        issueKey
                                                            ? getJiraChangelog(issueKey).catch(() => [])
                                                            : Promise.resolve([] as JiraChangelogEntry[]),
                                                    ]);
                                                    const summaryBase = summary ?? (await getProjectSummary(projectId));
                                                    applyLocalPayload(
                                                        synced,
                                                        summaryAfterProjectSync(summaryBase, synced),
                                                        local,
                                                        mapJiraActivity(jira),
                                                        { forceForm: true },
                                                    );
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
                onEmitted={(emitted) => {
                    setEditingPayment(emitted);
                    void loadBilling();
                }}
                onSendInvoice={
                    editingPayment && isPaymentIssued(editingPayment.status)
                        ? () => setSendInvoicePayment(editingPayment)
                        : undefined
                }
            />
            <EmitPaymentDialog
                open={Boolean(emitPaymentTarget)}
                payment={emitPaymentTarget}
                onOpenChange={(o) => {
                    if (!o) setEmitPaymentTarget(null);
                }}
                onEmitted={() => {
                    setEmitPaymentTarget(null);
                    void loadBilling();
                }}
            />
            <SendInvoiceDialog
                open={Boolean(sendInvoicePayment)}
                payment={sendInvoicePayment}
                onOpenChange={(o) => {
                    if (!o) setSendInvoicePayment(null);
                }}
                onSent={() => {
                    setSendInvoicePayment(null);
                    void loadBilling();
                }}
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

            <Dialog
                open={Boolean(ledgerDeleteTarget)}
                onOpenChange={(o) => {
                    if (!o) setLedgerDeleteTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {ledgerDeleteTarget?.kind === 'expense' ? 'Eliminar gasto' : 'Eliminar ingreso'}
                        </DialogTitle>
                        <DialogDescription>Soft delete del registro ledger.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => setLedgerDeleteTarget(null)}
                            disabled={ledgerDeleting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            className="cursor-pointer"
                            onClick={() => void handleDeleteLedger()}
                            disabled={ledgerDeleting}
                        >
                            {ledgerDeleting ? 'Eliminando…' : 'Eliminar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
