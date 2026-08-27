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
 * The filter control, and the only one. It sits on the left edge of a page
 * because that is where the eye starts, and because a filter is the first
 * decision about a list rather than an afterthought parked opposite the title.
 *
 * Deliberately not a segmented control in a sunk track: that reads as a mode
 * switch for the whole screen, and these only ever narrow a list.
 *
 * The look is unchanged; what changed is underneath. This was a row of
 * `<button aria-pressed>`, which a screen reader announces as several unrelated
 * toggles rather than one control with a chosen value, and which a keyboard
 * user walks with Tab instead of arrow keys. `ToggleGroup` is the primitive for
 * exactly this and it ships with the library.
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
      /* One at a time. An empty array means the pressed pill was pressed
         again — a filter always has a value, so that is a no-op rather than
         "no filter". */
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
