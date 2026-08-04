import { useMemo } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import { cn } from '@/lib/utils'

export type EntitySelectItem = {
  id: number
  name: string
}

type Option = {
  id: number | null
  name: string
}

type EntitySelectProps = {
  value: number | null
  onValueChange: (id: number | null) => void
  items: EntitySelectItem[]
  allowClear?: boolean
  placeholder?: string
  id?: string
  className?: string
  disabled?: boolean
}

/** Searchable client/project (and similar) picker — Combobox look-alike of SelectTrigger. */
export function EntitySelect({
  value,
  onValueChange,
  items,
  allowClear = false,
  placeholder = 'Seleccionar…',
  id,
  className,
  disabled,
}: EntitySelectProps) {
  const options = useMemo((): Option[] => {
    const base = items.map((i) => ({ id: i.id, name: i.name }))
    return allowClear ? [{ id: null, name: placeholder }, ...base] : base
  }, [items, allowClear, placeholder])

  const selected = options.find((o) => o.id === value) ?? null

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(opt) => onValueChange(opt?.id ?? null)}
      itemToStringValue={(opt) => opt.name}
      isItemEqualToValue={(a, b) => a.id === b.id}
      disabled={disabled}
    >
      <ComboboxTrigger
        id={id}
        disabled={disabled}
        className={cn(
          'flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-md border border-border bg-input/30 px-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'dark:bg-input/30 dark:hover:bg-input/50',
          className,
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate text-left', !selected && 'text-muted-foreground')}>
          {selected?.name ?? placeholder}
        </span>
      </ComboboxTrigger>
      <ComboboxContent className="min-w-(--anchor-width)">
        <ComboboxInput placeholder="Buscar…" showTrigger={false} className="w-full" />
        <ComboboxEmpty>Sin resultados</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={String(item.id)} value={item}>
              {item.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
