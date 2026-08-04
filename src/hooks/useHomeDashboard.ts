import { useCallback, useEffect, useMemo, useState } from 'react';
import { getHomeDashboard, type HomeDeadline, type HomeTopProject } from '@/lib/dashboard';
import { toastError } from '@/lib/toast';
import { PROJECT_STATUS_LABELS, type ProjectStatus } from '@/lib/projects';

export type StatusSlice = {
    status: ProjectStatus;
    name: string;
    value: number;
    color: string;
};

export type TopProjectHours = HomeTopProject;

export type HomeDashboard = {
    clientsCount: number;
    projectsCount: number;
    projectsInProgress: number;
    hoursThisMonthSeconds: number;
    topProjects: TopProjectHours[];
    statusSlices: StatusSlice[];
    deadlines: HomeDeadline[];
    deadlinesCount: number;
    loading: boolean;
    refresh: () => void;
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
    todo: '#8b9294',
    in_progress: '#ccff00',
    in_review: '#60a5fa',
    blocked: '#f87171',
    done: '#64748b',
    maintenance: '#fbbf24',
};

export function useHomeDashboard(): HomeDashboard {
    const [clientsCount, setClientsCount] = useState(0);
    const [projectsCount, setProjectsCount] = useState(0);
    const [projectsInProgress, setProjectsInProgress] = useState(0);
    const [hoursThisMonthSeconds, setHoursThisMonthSeconds] = useState(0);
    const [topProjects, setTopProjects] = useState<TopProjectHours[]>([]);
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
                const data = await getHomeDashboard(ac.signal);
                if (cancelled) return;
                setClientsCount(data.clientsCount);
                setProjectsCount(data.projectsCount);
                setProjectsInProgress(data.projectsInProgress);
                setHoursThisMonthSeconds(data.hoursThisMonthSeconds);
                setTopProjects(data.topProjects);
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
                setTopProjects([]);
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
                color: STATUS_COLORS[s.status],
            })),
        [statusRaw],
    );

    return {
        clientsCount,
        projectsCount,
        projectsInProgress,
        hoursThisMonthSeconds,
        topProjects,
        statusSlices,
        deadlines,
        deadlinesCount,
        loading,
        refresh,
    };
}
