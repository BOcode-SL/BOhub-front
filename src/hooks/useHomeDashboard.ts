import { useCallback, useEffect, useMemo, useState } from 'react';
import { getHomeDashboard, type HomeDeadline } from '@/lib/dashboard';
import { listMaintenances, type MaintenancePeriod } from '@/lib/maintenance';
import { toastError } from '@/lib/toast';
import { PROJECT_STATUS_CHART_COLORS, PROJECT_STATUS_LABELS, type ProjectStatus } from '@/lib/projects';

export type StatusSlice = {
    status: ProjectStatus;
    name: string;
    value: number;
    color: string;
};

const UPCOMING_MAINTENANCES_LIMIT = 3;

export type HomeDashboard = {
    clientsCount: number;
    projectsCount: number;
    projectsInProgress: number;
    hoursThisMonthSeconds: number;
    upcomingMaintenances: MaintenancePeriod[];
    statusSlices: StatusSlice[];
    deadlines: HomeDeadline[];
    deadlinesCount: number;
    loading: boolean;
    refresh: () => void;
};

export function useHomeDashboard(): HomeDashboard {
    const [clientsCount, setClientsCount] = useState(0);
    const [projectsCount, setProjectsCount] = useState(0);
    const [projectsInProgress, setProjectsInProgress] = useState(0);
    const [hoursThisMonthSeconds, setHoursThisMonthSeconds] = useState(0);
    const [upcomingMaintenances, setUpcomingMaintenances] = useState<MaintenancePeriod[]>([]);
    const [statusRaw, setStatusRaw] = useState<{ status: ProjectStatus; value: number }[]>([]);
    const [deadlines, setDeadlines] = useState<HomeDeadline[]>([]);
    const [deadlinesCount, setDeadlinesCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [reloadTick, setReloadTick] = useState(0);
    const refresh = useCallback(() => setReloadTick((n) => n + 1), []);

    useEffect(() => {
        const ac = new AbortController();
        let cancelled = false;

        async function run() {
            setLoading(true);
            try {
                // ponytail: home aggregates + open maintenances (same scope/sort as MaintenancePage)
                const [data, maint] = await Promise.all([
                    getHomeDashboard(ac.signal),
                    listMaintenances(
                        {
                            scope: 'open',
                            sort: 'ends_on',
                            perPage: UPCOMING_MAINTENANCES_LIMIT,
                            page: 1,
                        },
                        ac.signal,
                    ),
                ]);
                if (cancelled) return;
                setClientsCount(data.clientsCount);
                setProjectsCount(data.projectsCount);
                setProjectsInProgress(data.projectsInProgress);
                setHoursThisMonthSeconds(data.hoursThisMonthSeconds);
                setUpcomingMaintenances(maint.data);
                setStatusRaw(data.statusSlices);
                setDeadlines(data.deadlines);
                setDeadlinesCount(data.deadlinesCount);
            } catch (err) {
                if (cancelled) return;
                toastError(err);
                setClientsCount(0);
                setProjectsCount(0);
                setProjectsInProgress(0);
                setHoursThisMonthSeconds(0);
                setUpcomingMaintenances([]);
                setStatusRaw([]);
                setDeadlines([]);
                setDeadlinesCount(0);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void run();
        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [reloadTick]);

    const statusSlices = useMemo(
        (): StatusSlice[] =>
            statusRaw.map((s) => ({
                status: s.status,
                name: PROJECT_STATUS_LABELS[s.status],
                value: s.value,
                color: PROJECT_STATUS_CHART_COLORS[s.status],
            })),
        [statusRaw],
    );

    return {
        clientsCount,
        projectsCount,
        projectsInProgress,
        hoursThisMonthSeconds,
        upcomingMaintenances,
        statusSlices,
        deadlines,
        deadlinesCount,
        loading,
        refresh,
    };
}
