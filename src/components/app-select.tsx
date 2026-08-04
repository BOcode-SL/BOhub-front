import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type AppSelectItem = {
  label: string
  value: string | null
}

type AppSelectProps = {
  items: AppSelectItem[]
  value: string | null
  onValueChange: (value: string | null) => void
  id?: string
  placeholder?: string
  groupLabel?: string
  className?: string
  disabled?: boolean
  required?: boolean
  'aria-invalid'?: boolean
}

/** Short dropdowns (status, role, per_page, …). Not for searchable entity lists. */
export function AppSelect({
  items,
  value,
  onValueChange,
  id,
  placeholder,
  groupLabel,
  className,
  disabled,
  required,
  'aria-invalid': ariaInvalid,
}: AppSelectProps) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => onValueChange((v as string | null) ?? null)}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger
        id={id}
        aria-invalid={ariaInvalid || undefined}
        className={cn(
          'h-9 w-full min-w-0 rounded-md border-border bg-input/30 px-2.5 dark:bg-input/30 dark:hover:bg-input/50',
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {groupLabel ? <SelectLabel>{groupLabel}</SelectLabel> : null}
          {items.map((item) => (
            <SelectItem key={String(item.value)} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
