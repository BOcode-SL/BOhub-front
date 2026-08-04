import type { ReactNode } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

type FormFieldProps = {
    id: string;
    label: ReactNode;
    error?: string;
    description?: ReactNode;
    children: ReactNode;
    className?: string;
    labelClassName?: string;
};

/** Label + control + FieldError. Caller sets aria-invalid on the control. */
export function FormField({ id, label, error, description, children, className, labelClassName }: FormFieldProps) {
    return (
        <Field data-invalid={error ? true : undefined} className={cn('gap-2', className)}>
            <FieldLabel htmlFor={id} className={labelClassName}>
                {label}
            </FieldLabel>
            {children}
            {description ? <FieldDescription>{description}</FieldDescription> : null}
            {error ? <FieldError>{error}</FieldError> : null}
        </Field>
    );
}
