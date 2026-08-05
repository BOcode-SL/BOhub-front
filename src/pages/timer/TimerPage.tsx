import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Clock, Pause, Play, Plus, Square, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { EntitySelect } from '@/components/entity-select';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListPageShell } from '@/components/list-page-shell';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ToolbarField, toolbarControlClass } from '@/components/toolbar-field';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { listProjectOptions } from '@/lib/projects';
import { formatHoursFromSeconds } from '@/lib/time';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';
import {
    createHour,
    deleteHour,
    discardTimer,
    formatDuration,
    getActiveTimer,
    getHoursSummary,
    listHours,
    listTeamHours,
    patchTimer,
    saveTimer,
    startTimer,
    updateHour,
    type ActiveTimer,
    type Hour,
    type HoursMeta,
    type HoursSummary,
    type HourInput,
} from '@/lib/timer';
import { HourSheet } from './HourSheet';
import { HoursTable } from './HoursTable';
import { TimerTabs } from './TimerTabs';

// ponytail: keep recharts off the Mis horas / Equipo path until Analytics opens
const TimerAnalytics = lazy(() => import('./TimerAnalytics').then((m) => ({ default: m.TimerAnalytics })));

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

/** Visible month for Mis horas cards: from filter date if set, else current calendar month. */
function summaryMonth(from: string): { year: number; month: number } {
    if (from && /^\d{4}-\d{2}/.test(from)) {
        return { year: Number(from.slice(0, 4)), month: Number(from.slice(5, 7)) };
    }
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() + 1 };
}

type Tab = 'mine' | 'team' | 'analytics';

type ListFilters = {
    projectId: number | '';
    userId: number | '';
    from: string;
    to: string;
};

export function TimerPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
    const [timer, setTimer] = useState<ActiveTimer | null>(null);
    const [displaySeconds, setDisplaySeconds] = useState(0);
    const [liveProjectId, setLiveProjectId] = useState<number | ''>('');
    const [liveDesc, setLiveDesc] = useState('');
    const [busy, setBusy] = useState(false);

    const [tab, setTab] = useState<Tab>('mine');
    const [hours, setHours] = useState<Hour[]>([]);
    const [meta, setMeta] = useState<HoursMeta | null>(null);
    const [teamUsers, setTeamUsers] = useState<{ id: number; name: string }[]>([]);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<ListFilters>({
        projectId: '',
        userId: '',
        from: '',
        to: '',
    });
    const [debouncedFilters, setDebouncedFilters] = useState(filters);
    const [listLoading, setListLoading] = useState(true);
    const [listTick, setListTick] = useState(0);

    const [saveOpen, setSaveOpen] = useState(false);
    const [frozenSeconds, setFrozenSeconds] = useState(0);
    const [saveProjectId, setSaveProjectId] = useState<number | ''>('');
    const [saveDesc, setSaveDesc] = useState('');
    const [saveDate, setSaveDate] = useState(today());

    const [manualOpen, setManualOpen] = useState(false);
    const [manualProjectId, setManualProjectId] = useState<number | ''>('');
    const [manualHours, setManualHours] = useState('0');
    const [manualMinutes, setManualMinutes] = useState('30');
    const [manualSeconds, setManualSeconds] = useState('0');
    const [manualDate, setManualDate] = useState(today());
    const [manualDesc, setManualDesc] = useState('');
    const [manualSaving, setManualSaving] = useState(false);

    const [editHour, setEditHour] = useState<Hour | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Hour | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const [mineSummary, setMineSummary] = useState<HoursSummary | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    const { year: summaryYear, month: summaryMonthNum } = useMemo(
        () => summaryMonth(debouncedFilters.from),
        [debouncedFilters.from],
    );

    useEffect(() => {
        void listProjectOptions().then(setProjects);
    }, []);

    // ponytail: 300ms debounce on list filters; AbortSignal cancels in-flight
    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedFilters(filters), 300);
        return () => window.clearTimeout(t);
    }, [filters]);

    async function refreshTimer() {
        const t = await getActiveTimer();
        setTimer(t);
        if (t) {
            setDisplaySeconds(t.elapsedSeconds);
            setLiveProjectId(t.projectId ?? '');
            setLiveDesc(t.description ?? '');
        } else {
            setDisplaySeconds(0);
        }
    }

    useEffect(() => {
        void refreshTimer().catch((err) => toastError(err));
    }, []);

    // ponytail: local 1s tick only; API resync on pause/resume/focus/visibility — not each second
    useEffect(() => {
        if (!timer || timer.state !== 'running') return;
        const anchor = Date.now();
        const base = timer.elapsedSeconds;
        const id = window.setInterval(() => {
            setDisplaySeconds(base + Math.floor((Date.now() - anchor) / 1000));
        }, 1000);
        return () => window.clearInterval(id);
    }, [timer]);

    useEffect(() => {
        function resync() {
            if (document.visibilityState === 'hidden') return;
            void refreshTimer().catch(() => {});
        }
        window.addEventListener('focus', resync);
        document.addEventListener('visibilitychange', resync);
        return () => {
            window.removeEventListener('focus', resync);
            document.removeEventListener('visibilitychange', resync);
        };
    }, []);

    useEffect(() => {
        if (tab === 'team' && !isAdmin) setTab('mine');
    }, [tab, isAdmin]);

    useEffect(() => {
        if (tab === 'analytics') return;
        const ac = new AbortController();
        let cancelled = false;
        async function run() {
            setListLoading(true);
            try {
                if (tab === 'team') {
                    const res = await listTeamHours(
                        {
                            page,
                            perPage: 10,
                            projectId: debouncedFilters.projectId || undefined,
                            userId: debouncedFilters.userId || undefined,
                            from: debouncedFilters.from || undefined,
                            to: debouncedFilters.to || undefined,
                        },
                        ac.signal,
                    );
                    if (!cancelled) {
                        setHours(res.data);
                        setMeta(res.meta);
                        if (res.users?.length) setTeamUsers(res.users);
                    }
                } else {
                    const res = await listHours(
                        {
                            page,
                            perPage: 10,
                            projectId: debouncedFilters.projectId || undefined,
                            from: debouncedFilters.from || undefined,
                            to: debouncedFilters.to || undefined,
                        },
                        ac.signal,
                    );
                    if (!cancelled) {
                        setHours(res.data);
                        setMeta(res.meta);
                    }
                }
            } catch (err) {
                if (cancelled) return;
                toastError(err);
            } finally {
                if (!cancelled) setListLoading(false);
            }
        }
        void run();
        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [page, listTick, tab, debouncedFilters]);

    useEffect(() => {
        if (tab !== 'mine') return;
        const ac = new AbortController();
        let cancelled = false;
        async function run() {
            setSummaryLoading(true);
            try {
                const res = await getHoursSummary({ year: summaryYear, month: summaryMonthNum }, ac.signal);
                if (!cancelled) setMineSummary(res);
            } catch (err) {
                if (cancelled) return;
                toastError(err);
                setMineSummary(null);
            } finally {
                if (!cancelled) setSummaryLoading(false);
            }
        }
        void run();
        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [tab, summaryYear, summaryMonthNum, listTick]);

    async function runAction(fn: () => Promise<void>) {
        setBusy(true);
        try {
            await fn();
        } catch (err) {
            toastError(err);
        } finally {
            setBusy(false);
        }
    }

    function reloadList() {
        setListTick((n) => n + 1);
    }

    function switchTab(next: Tab) {
        if (tab === next) return;
        setTab(next);
        setPage(1);
    }

    function patchFilters(patch: Partial<ListFilters>) {
        setFilters((prev) => ({ ...prev, ...patch }));
        setPage(1);
    }

    function clearFieldError(key: string) {
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    async function handleStart() {
        setFieldErrors({});
        setBusy(true);
        try {
            const t = await startTimer({
                projectId: liveProjectId || null,
                description: liveDesc.trim() || null,
            });
            setTimer(t);
            setDisplaySeconds(t.elapsedSeconds);
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) {
                setFieldErrors(flattenFieldErrors(err.fieldErrors));
            }
            toastError(err);
        } finally {
            setBusy(false);
        }
    }

    async function handlePause() {
        if (!timer) return;
        await runAction(async () => {
            const t = await patchTimer(timer.id, { action: 'pause' });
            setTimer(t);
            setDisplaySeconds(t.elapsedSeconds);
        });
    }

    async function handleResume() {
        if (!timer) return;
        await runAction(async () => {
            const t = await patchTimer(timer.id, { action: 'resume' });
            setTimer(t);
            setDisplaySeconds(t.elapsedSeconds);
        });
    }

    function handleStop() {
        if (!timer) return;
        setFieldErrors({});
        setFrozenSeconds(displaySeconds);
        setSaveProjectId(liveProjectId || timer.projectId || '');
        setSaveDesc(liveDesc || timer.description || '');
        setSaveDate(today());
        setSaveOpen(true);
    }

    async function confirmSave() {
        if (!timer) return;
        if (!saveProjectId) {
            setFieldErrors({ projectId: 'Selecciona un proyecto para guardar.' });
            return;
        }
        setBusy(true);
        try {
            await saveTimer(timer.id, {
                projectId: Number(saveProjectId),
                description: saveDesc.trim() || null,
                workedOn: saveDate,
            });
            setTimer(null);
            setDisplaySeconds(0);
            setSaveOpen(false);
            setFieldErrors({});
            reloadList();
            toastSuccess('Horas guardadas');
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) {
                setFieldErrors(flattenFieldErrors(err.fieldErrors));
            }
            toastError(err);
        } finally {
            setBusy(false);
        }
    }

    async function confirmDiscardFromSave() {
        if (!timer) return;
        await runAction(async () => {
            await discardTimer(timer.id);
            setTimer(null);
            setDisplaySeconds(0);
            setSaveOpen(false);
        });
    }

    async function handleManual(e: FormEvent) {
        e.preventDefault();
        const nextErrors: Record<string, string> = {};
        if (!manualProjectId) nextErrors.projectId = 'Selecciona un proyecto.';
        const duration =
            (Number(manualHours) || 0) * 3600 + (Number(manualMinutes) || 0) * 60 + (Number(manualSeconds) || 0);
        if (duration < 1) nextErrors.duration = 'La duración debe ser mayor que 0.';
        if (Object.keys(nextErrors).length) {
            setFieldErrors(nextErrors);
            return;
        }
        setManualSaving(true);
        try {
            await createHour({
                projectId: Number(manualProjectId),
                hours: Number(manualHours) || 0,
                minutes: Number(manualMinutes) || 0,
                seconds: Number(manualSeconds) || 0,
                workedOn: manualDate,
                description: manualDesc.trim() || null,
            });
            setManualDesc('');
            setManualOpen(false);
            setFieldErrors({});
            reloadList();
            toastSuccess('Horas guardadas');
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) {
                setFieldErrors(flattenFieldErrors(err.fieldErrors));
            }
            toastError(err);
        } finally {
            setManualSaving(false);
        }
    }

    async function handleEditSubmit(data: Partial<HourInput>) {
        if (!editHour) return;
        await updateHour(editHour.id, data);
        setEditHour(null);
        reloadList();
        toastSuccess('Horas actualizadas');
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        setBusy(true);
        try {
            await deleteHour(deleteTarget.id);
            setDeleteTarget(null);
            reloadList();
            toastSuccess('Horas eliminadas');
        } catch (err) {
            toastError(err);
        } finally {
            setBusy(false);
        }
    }

    const isRunning = timer?.state === 'running';
    const isPaused = timer?.state === 'paused';

    return (
        <div className="flex flex-col gap-8">
            <section className="flex flex-col items-center gap-6 rounded-xl border border-border bg-card px-4 py-8 sm:px-8">
                <p
                    className="font-mono text-5xl font-semibold tracking-tight text-primary tabular-nums sm:text-6xl md:text-7xl"
                    aria-live="polite"
                >
                    {formatDuration(displaySeconds)}
                </p>

                <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
                    <FormField id="live-project" label="Proyecto" error={fieldErrors.projectId}>
                        <EntitySelect
                            id="live-project"
                            items={projects}
                            value={liveProjectId || null}
                            onValueChange={(value) => {
                                setLiveProjectId(value ?? '');
                                clearFieldError('projectId');
                            }}
                            allowClear
                            placeholder="Seleccionar…"
                            disabled={busy || saveOpen}
                            aria-invalid={!!fieldErrors.projectId}
                        />
                    </FormField>
                    <FormField id="live-desc" label="Descripción" error={fieldErrors.description}>
                        <Input
                            id="live-desc"
                            value={liveDesc}
                            onChange={(e) => {
                                setLiveDesc(e.target.value);
                                clearFieldError('description');
                            }}
                            className="bg-background"
                            disabled={busy || saveOpen}
                            placeholder="¿En qué trabajas?"
                            aria-invalid={!!fieldErrors.description}
                        />
                    </FormField>
                </div>

                <div className="flex w-full max-w-xl flex-wrap justify-center gap-2">
                    {!timer && (
                        <Button type="button" size="lg" className="min-w-32" disabled={busy} onClick={() => void handleStart()}>
                            <Play />
                            Iniciar
                        </Button>
                    )}
                    {isRunning && (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                className="min-w-32"
                                disabled={busy}
                                onClick={() => void handlePause()}
                            >
                                <Pause />
                                Pausar
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                size="lg"
                                className="min-w-32"
                                disabled={busy}
                                onClick={handleStop}
                            >
                                <Square />
                                Parar
                            </Button>
                        </>
                    )}
                    {isPaused && (
                        <>
                            <Button
                                type="button"
                                size="lg"
                                className="min-w-32"
                                disabled={busy}
                                onClick={() => void handleResume()}
                            >
                                <Play />
                                Reanudar
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                size="lg"
                                className="min-w-32"
                                disabled={busy}
                                onClick={handleStop}
                            >
                                <Square />
                                Parar
                            </Button>
                        </>
                    )}
                </div>
            </section>

            {tab === 'analytics' ? (
                <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-xl" />}>
                    <TimerAnalytics above={<TimerTabs tab={tab} isAdmin={isAdmin} onChange={switchTab} />} />
                </Suspense>
            ) : (
                <ListPageShell
                    title={tab === 'team' ? 'Equipo' : 'Mis horas'}
                    description={tab === 'team' ? 'Horas registradas por el equipo.' : 'Registro de tus horas trabajadas.'}
                    icon={Clock}
                    above={<TimerTabs tab={tab} isAdmin={isAdmin} onChange={switchTab} />}
                    actions={
                        tab === 'mine' ? (
                            <Button
                                type="button"
                                onClick={() => {
                                    setFieldErrors({});
                                    setManualProjectId('');
                                    setManualHours('0');
                                    setManualMinutes('30');
                                    setManualSeconds('0');
                                    setManualDate(today());
                                    setManualDesc('');
                                    setManualOpen(true);
                                }}
                            >
                                <Plus />
                                Añadir
                            </Button>
                        ) : null
                    }
                    toolbar={
                        <div className="flex flex-wrap items-end gap-2 py-1">
                            <ToolbarField id="timer-project" label="Proyecto">
                                <EntitySelect
                                    id="timer-project"
                                    items={projects}
                                    value={filters.projectId || null}
                                    onValueChange={(value) => patchFilters({ projectId: value ?? '' })}
                                    allowClear
                                    placeholder="Todos"
                                    className="min-w-40"
                                />
                            </ToolbarField>
                            {tab === 'team' && (
                                <ToolbarField id="timer-user" label="Usuario">
                                    <EntitySelect
                                        id="timer-user"
                                        items={teamUsers}
                                        value={filters.userId || null}
                                        onValueChange={(value) => patchFilters({ userId: value ?? '' })}
                                        allowClear
                                        placeholder="Todos"
                                        className="min-w-40"
                                    />
                                </ToolbarField>
                            )}
                            <ToolbarField id="timer-from" label="Desde">
                                <Input
                                    id="timer-from"
                                    type="date"
                                    value={filters.from}
                                    onChange={(e) => patchFilters({ from: e.target.value })}
                                    className={cn(toolbarControlClass, 'w-auto')}
                                />
                            </ToolbarField>
                            <ToolbarField id="timer-to" label="Hasta">
                                <Input
                                    id="timer-to"
                                    type="date"
                                    value={filters.to}
                                    onChange={(e) => patchFilters({ to: e.target.value })}
                                    className={cn(toolbarControlClass, 'w-auto')}
                                />
                            </ToolbarField>
                        </div>
                    }
                >
                    {tab === 'mine' && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {[
                                {
                                    title: 'Total del mes',
                                    value: formatDuration(mineSummary?.totalSeconds ?? 0),
                                },
                                {
                                    title: 'Media diaria',
                                    value: formatHoursFromSeconds(mineSummary?.avgDailySeconds ?? 0),
                                },
                                {
                                    title: 'Días activos',
                                    value: String(mineSummary?.activeDays ?? 0),
                                },
                            ].map((tile) => (
                                <div key={tile.title} className="rounded-xl border border-border bg-card/50 p-4">
                                    <p className="text-sm text-muted-foreground">{tile.title}</p>
                                    <div className="mt-2 font-mono text-xl font-semibold text-primary tabular-nums sm:text-2xl">
                                        {summaryLoading ? (
                                            <Skeleton className="h-7 w-24" />
                                        ) : (
                                            tile.value
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <HoursTable
                        hours={hours}
                        meta={meta}
                        loading={listLoading}
                        showUser={tab === 'team'}
                        showActions={tab === 'mine'}
                        page={page}
                        onPageChange={setPage}
                        onEdit={setEditHour}
                        onDelete={setDeleteTarget}
                    />
                </ListPageShell>
            )}

            <Dialog
                open={saveOpen}
                onOpenChange={(o) => {
                    if (!o && !busy) setSaveOpen(false);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Guardar tiempo</DialogTitle>
                        <DialogDescription>Duración congelada. Guarda o descarta la sesión.</DialogDescription>
                    </DialogHeader>
                    <p className="font-mono text-3xl font-semibold text-primary tabular-nums">{formatDuration(frozenSeconds)}</p>
                    <div className="grid gap-3">
                        <FormField id="save-project" label="Proyecto *" error={fieldErrors.projectId}>
                            <EntitySelect
                                id="save-project"
                                items={projects}
                                value={saveProjectId || null}
                                onValueChange={(value) => {
                                    setSaveProjectId(value ?? '');
                                    clearFieldError('projectId');
                                }}
                                placeholder="Selecciona proyecto…"
                                aria-invalid={!!fieldErrors.projectId}
                            />
                        </FormField>
                        <FormField id="save-desc" label="Descripción" error={fieldErrors.description}>
                            <Input
                                id="save-desc"
                                value={saveDesc}
                                onChange={(e) => {
                                    setSaveDesc(e.target.value);
                                    clearFieldError('description');
                                }}
                                className="bg-card"
                                aria-invalid={!!fieldErrors.description}
                            />
                        </FormField>
                        <FormField id="save-date" label="Fecha" error={fieldErrors.workedOn}>
                            <Input
                                id="save-date"
                                type="date"
                                value={saveDate}
                                onChange={(e) => {
                                    setSaveDate(e.target.value);
                                    clearFieldError('workedOn');
                                }}
                                className="bg-card"
                                aria-invalid={!!fieldErrors.workedOn}
                            />
                        </FormField>
                    </div>
                    <DialogFooter className="gap-2 sm:justify-between">
                        <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirmDiscardFromSave()}>
                            <Trash2 />
                            Descartar
                        </Button>
                        <Button type="button" disabled={busy} onClick={() => void confirmSave()}>
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={manualOpen}
                onOpenChange={(o) => {
                    if (!o) setFieldErrors({});
                    setManualOpen(o);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Añadir horas</DialogTitle>
                        <DialogDescription>Alta manual de tiempo.</DialogDescription>
                    </DialogHeader>
                    <form id="manual-hour-form" noValidate className="grid gap-3" onSubmit={(e) => void handleManual(e)}>
                        <FormField id="manual-project" label="Proyecto" error={fieldErrors.projectId}>
                            <EntitySelect
                                id="manual-project"
                                items={projects}
                                value={manualProjectId || null}
                                onValueChange={(value) => {
                                    setManualProjectId(value ?? '');
                                    clearFieldError('projectId');
                                }}
                                placeholder="Seleccionar…"
                                aria-invalid={!!fieldErrors.projectId}
                            />
                        </FormField>
                        <FormField id="manual-duration" label="Duración" error={fieldErrors.duration}>
                            <div className="grid grid-cols-3 gap-2">
                                <Input
                                    id="manual-hours"
                                    type="number"
                                    min={0}
                                    max={24}
                                    value={manualHours}
                                    onChange={(e) => {
                                        setManualHours(e.target.value);
                                        clearFieldError('duration');
                                    }}
                                    className="bg-card"
                                    aria-label="Horas"
                                    aria-invalid={!!fieldErrors.duration}
                                />
                                <Input
                                    id="manual-minutes"
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={manualMinutes}
                                    onChange={(e) => {
                                        setManualMinutes(e.target.value);
                                        clearFieldError('duration');
                                    }}
                                    className="bg-card"
                                    aria-label="Minutos"
                                    aria-invalid={!!fieldErrors.duration}
                                />
                                <Input
                                    id="manual-seconds"
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={manualSeconds}
                                    onChange={(e) => {
                                        setManualSeconds(e.target.value);
                                        clearFieldError('duration');
                                    }}
                                    className="bg-card"
                                    aria-label="Segundos"
                                    aria-invalid={!!fieldErrors.duration}
                                />
                            </div>
                        </FormField>
                        <FormField id="manual-date" label="Fecha" error={fieldErrors.workedOn}>
                            <Input
                                id="manual-date"
                                type="date"
                                required
                                value={manualDate}
                                onChange={(e) => {
                                    setManualDate(e.target.value);
                                    clearFieldError('workedOn');
                                }}
                                className="bg-card"
                                aria-invalid={!!fieldErrors.workedOn}
                            />
                        </FormField>
                        <FormField id="manual-desc" label="Descripción" error={fieldErrors.description}>
                            <Input
                                id="manual-desc"
                                value={manualDesc}
                                onChange={(e) => {
                                    setManualDesc(e.target.value);
                                    clearFieldError('description');
                                }}
                                className="bg-card"
                                aria-invalid={!!fieldErrors.description}
                            />
                        </FormField>
                    </form>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setManualOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" form="manual-hour-form" disabled={manualSaving}>
                            {manualSaving ? 'Guardando…' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <HourSheet
                open={Boolean(editHour)}
                hour={editHour}
                onOpenChange={(o) => {
                    if (!o) setEditHour(null);
                }}
                onSubmit={handleEditSubmit}
            />

            <Dialog
                open={Boolean(deleteTarget)}
                onOpenChange={(o) => {
                    if (!o) setDeleteTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar horas</DialogTitle>
                        <DialogDescription>Soft delete de esta entrada.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" disabled={busy} onClick={() => void confirmDelete()}>
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
