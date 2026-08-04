import { useMemo } from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';
import { Pie, PieChart, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { StatusSlice } from '@/hooks/useHomeDashboard';

type Props = {
    data: StatusSlice[];
    isMobile: boolean;
    isLoading?: boolean;
};

export function ProjectStatusChart({ data, isMobile, isLoading }: Props) {
    const chartConfig = useMemo(() => {
        const config: ChartConfig = {
            value: { label: 'Proyectos' },
        };
        for (const s of data) {
            config[s.status] = { label: s.name, color: s.color };
        }
        return config;
    }, [data]);

    const chartData = data.map((s) => ({
        status: s.status,
        name: s.name,
        value: s.value,
        fill: `var(--color-${s.status})`,
    }));

    return (
        <Card className="w-full min-w-0 max-w-full">
            <CardHeader className="min-w-0">
                <CardTitle className="truncate text-base sm:text-lg">Estado de Proyectos</CardTitle>
                <CardDescription className="truncate text-xs sm:text-sm">Distribución por estado</CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-[240px] min-w-0 flex-col">
                {isLoading ? (
                    <div className="flex flex-1 items-center justify-center">
                        <Skeleton className="size-[160px] rounded-full sm:size-[200px]" />
                    </div>
                ) : chartData.length > 0 ? (
                    <ChartContainer
                        config={chartConfig}
                        className="mx-auto aspect-square h-[200px] w-full max-w-[240px] flex-1 sm:h-[220px]"
                    >
                        <PieChart>
                            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="name" />} />
                            <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={isMobile ? 40 : 50}
                                outerRadius={isMobile ? 70 : 85}
                                strokeWidth={2}
                            >
                                {chartData.map((item) => (
                                    <Cell key={item.status} fill={item.fill} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                ) : (
                    <div className="flex flex-1 items-center justify-center py-8 text-muted-foreground">
                        <div className="text-center">
                            <PieChartIcon className="mx-auto mb-2 size-10 opacity-50" />
                            <p className="text-sm">No hay proyectos activos para mostrar</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
