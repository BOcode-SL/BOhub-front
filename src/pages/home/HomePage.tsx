import { useEffect } from 'react';
import { formatHoursFromSeconds } from '@/lib/time';
import { syncProjectsFromJiraBatch } from '@/lib/projects';
import { useHomeDashboard } from '@/hooks/useHomeDashboard';
import { RecentErrors, StatsCards, UpcomingDeadlines, UpcomingMaintenances } from './components';

export function HomePage() {
    const {
        clientsCount,
        projectsCount,
        projectsInProgress,
        hoursThisMonthSeconds,
        upcomingMaintenances,
        deadlines,
        deadlinesCount,
        loading,
        refresh,
    } = useHomeDashboard();

    // ponytail: Jira→BDD batch in background; refetch home only if something changed
    useEffect(() => {
        let cancelled = false;
        void syncProjectsFromJiraBatch().then((result) => {
            if (!cancelled && result && result.updated > 0) refresh();
        });
        return () => {
            cancelled = true;
        };
    }, [refresh]);

    return (
        <div className="flex flex-col gap-3 sm:gap-4">
            <StatsCards
                clientsCount={clientsCount}
                projectsCount={projectsCount}
                projectsInProgress={projectsInProgress}
                hoursThisMonth={formatHoursFromSeconds(hoursThisMonthSeconds)}
                upcomingDeadlinesCount={deadlinesCount}
                isLoading={loading}
            />

            <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
                <RecentErrors />
                <UpcomingDeadlines projects={deadlines} isLoading={loading} />
            </div>

            <UpcomingMaintenances items={upcomingMaintenances} isLoading={loading} />
        </div>
    );
}
