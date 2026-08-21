import { cn } from '@/lib/utils'

export interface FilterOption<T extends string> {
  id: T
  label: string
}

interface FilterPillsProps<T extends string> {
  options: readonly FilterOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/**
 * The filter control, and the only one. It sits on the left edge of a page
 * because that is where the eye starts, and because a filter is the first
 * decision about a list rather than an afterthought parked opposite the title.
 *
 * Deliberately not a segmented control in a sunk track: that reads as a mode
 * switch for the whole screen, and these only ever narrow a list.
 *
 * Every pill carries a surface — a control with no fill at rest does not look
 * like something you can press. The three states are one step apart each, so
 * hover and selected are distinguishable without either shouting.
 */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  className,
}: FilterPillsProps<T>) {
  return (
    <div className={cn('flex gap-1.5', className)}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            'h-7 rounded-full px-3 text-sm transition-[background-color,box-shadow,color]',
            /* Measured off Linear's My Issues pills, and the opposite way round
               to intuition: the UNSELECTED pill is the raised one — white, with
               a hairline and two soft lifts — and the selected pill is pressed
               IN. It takes a darker fill (lch 93.5 against a white rest) and
               LOSES its lift, keeping only the ring. A pressed thing sinks and
               its shadow goes; carrying the lift into the selected state made
               it read as raised and dark at once, which is nothing physical. */
            value === o.id
              ? 'bg-control-active font-medium text-foreground shadow-edge'
              : 'bg-control text-muted-foreground shadow-raised hover:bg-control-hover hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
