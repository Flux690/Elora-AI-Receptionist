import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export interface FilterOption<T extends string> {
  id: T
  label: string
}

interface FilterPillsProps<T extends string> {
  options: readonly FilterOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  /** Read out to a screen reader as the name of the whole control. */
  label?: string
}

/**
 * The one control for choosing which subset of a list to see, used for page
 * filters and for the settings panels alike. A `ToggleGroup` rather than a row
 * of buttons, so a screen reader announces one control with a chosen value and
 * the arrow keys walk it.
 */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  className,
  label,
}: FilterPillsProps<T>) {
  return (
    <ToggleGroup
      className={className}
      aria-label={label}
      value={[value]}
      /* One at a time. An empty array means the chosen pill was pressed again,
         and a filter always has a value, so that is a no-op. */
      onValueChange={(next) => {
        const [chosen] = next as T[]
        if (chosen) onChange(chosen)
      }}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.id} value={o.id} variant="pill">
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
