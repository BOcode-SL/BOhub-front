import type { ReactNode } from 'react'
import { AppSelect, type AppSelectItem } from '@/components/app-select'
import { Field, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'

/** Shared control look for list toolbar inputs (dates, etc.). */
export const toolbarControlClass =
  'h-9 rounded-md border border-border bg-input/30 px-2 text-sm text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

type ToolbarFieldProps = {
  id: string
  label: string
  className?: string
  children: ReactNode
}

/** Label above control (muted), same pattern as Clients / Maintenance filters. */
export function ToolbarField({ id, label, className, children }: ToolbarFieldProps) {
  return (
    <Field className={cn('w-auto shrink-0 gap-1.5', className)}>
      <FieldLabel htmlFor={id} className="font-normal text-muted-foreground">
        {label}
      </FieldLabel>
      {children}
    </Field>
  )
}

type ToolbarSelectProps = {
  id: string
  label: string
  items: AppSelectItem[]
  value: string | null
  onValueChange: (value: string | null) => void
  fieldClassName?: string
  className?: string
  placeholder?: string
}

export function ToolbarSelect({
  id,
  label,
  items,
  value,
  onValueChange,
  fieldClassName,
  className,
  placeholder,
}: ToolbarSelectProps) {
  return (
    <ToolbarField id={id} label={label} className={fieldClassName}>
      <AppSelect
        id={id}
        items={items}
        value={value}
        onValueChange={onValueChange}
        groupLabel={label}
        placeholder={placeholder}
        className={cn('w-auto min-w-28', className)}
      />
    </ToolbarField>
  )
}
