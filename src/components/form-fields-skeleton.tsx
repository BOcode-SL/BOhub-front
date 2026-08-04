import { Skeleton } from '@/components/ui/skeleton';

type Props = {
    /** Field rows (label + control). Default 7. */
    fields?: number;
};

/** Field-shaped placeholders for sheet edit hydrate. */
export function FormFieldsSkeleton({ fields = 7 }: Props) {
    return (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando formulario">
            {Array.from({ length: fields }, (_, i) => (
                <div key={i} className="grid gap-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-full" />
                </div>
            ))}
        </div>
    );
}
