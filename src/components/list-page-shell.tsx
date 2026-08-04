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
        <div className="flex flex-col gap-4">
            {above}
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-muted p-2">
                                <Icon className="size-5 text-foreground" aria-hidden />
                            </div>
                            <div>
                                <CardTitle className="text-lg">{title}</CardTitle>
                                {description ? <CardDescription>{description}</CardDescription> : null}
                            </div>
                        </div>
                        {actions ? (
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
                        ) : null}
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {toolbar}
                    {children}
                </CardContent>
            </Card>
        </div>
    );
}
