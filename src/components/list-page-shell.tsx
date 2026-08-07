import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
    title: string;
    description?: string;
    icon: LucideIcon;
    /** Right side of title row (e.g. per-page + primary CTA) */
    actions?: ReactNode;
    toolbar?: ReactNode;
    children: ReactNode;
    /** Extra above the card (e.g. EmailTabs) */
    above?: ReactNode;
};

/** ProjectHub-style list shell: Card + header icon + toolbar + table body. */
export function ListPageShell({ title, description, icon: Icon, actions, toolbar, children, above }: Props) {
    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            {above}
            <Card className="min-w-0">
                <CardHeader className="min-w-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                            <div className="shrink-0 rounded-lg bg-muted p-2">
                                <Icon className="size-5 text-foreground" aria-hidden />
                            </div>
                            <div className="min-w-0">
                                <CardTitle className="text-lg">{title}</CardTitle>
                                {description ? (
                                    <CardDescription className="break-words">{description}</CardDescription>
                                ) : null}
                            </div>
                        </div>
                        {actions ? (
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
                        ) : null}
                    </div>
                </CardHeader>
                <CardContent className="flex min-w-0 flex-col gap-4">
                    {toolbar}
                    {children}
                </CardContent>
            </Card>
        </div>
    );
}
