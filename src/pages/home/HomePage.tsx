import { useEffect, useState } from 'react';
import { formatHoursFromSeconds } from '@/lib/time';
import { syncProjectsFromJiraBatch } from '@/lib/projects';
import { useHomeDashboard } from '@/hooks/useHomeDashboard';
import { ProjectStatusChart, StatsCards, TopProjectsByHours, UpcomingDeadlines } from './components';

function useIsMobile(breakpoint = 640) {
    const [mobile, setMobile] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches,
    );
    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
        const onChange = () => setMobile(mq.matches);
        onChange();
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, [breakpoint]);
    return mobile;
}

export function HomePage() {
    const isMobile = useIsMobile();
    const {
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

            <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
                <div className="lg:col-span-1">
                    <ProjectStatusChart data={statusSlices} isMobile={isMobile} isLoading={loading} />
                </div>
                <div className="lg:col-span-2">
                    <UpcomingDeadlines projects={deadlines} isLoading={loading} />
                </div>
            </div>

            <TopProjectsByHours projects={topProjects} formatHours={formatHoursFromSeconds} isLoading={loading} />
        </div>
    );
}
