import { Input } from '@/components/ui/input'
import { digitsToNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface NumberFieldProps {
  value: number
  onChange: (value: number) => void
  /** Painted inside the box, never typed. "minutes", "days". */
  unit: string
  /** For screen readers. The visible label is the row's own title. */
  label: string
  id?: string
  className?: string
}

/**
 * A number and the unit it is counted in, in one box.
 *
 * The unit is drawn, not typed and not selectable. A dropdown would make every
 * duration a mode — the same "30" meaning two things depending on a control
 * beside it — and a second focusable thing inside the border fights the focus
 * rule, which lays one outline over the control's own edge at
 * `outline-offset: -1px` and has nowhere to put a second.
 *
 * Digits only, so there is nothing to parse and no failure state to design.
 * Minutes is the unit you *edit* in; `formatMinutes` is the unit you *read* in,
 * which is why a 90-minute service shows "1 hr 30 min" in the services list and
 * `90 minutes` here. Canonical where you edit, human where you read.
 *
 * One component for all five duration and count fields, so the digit-stripping
 * and the unit live in one place rather than at every call site.
 */
export function NumberField({
  value,
  onChange,
  unit,
  label,
  id,
  className,
}: NumberFieldProps) {
  return (
    <span className={cn('relative inline-flex w-field-sm', className)}>
      <Input
        id={id}
        aria-label={label}
        inputMode="numeric"
        value={String(value)}
        onChange={(e) => onChange(digitsToNumber(e.target.value))}
        className="pr-[var(--unit-gutter)] text-right tabular-nums"
        style={{ '--unit-gutter': `${unit.length + 2}ch` } as React.CSSProperties}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted-foreground"
      >
        {unit}
      </span>
    </span>
  )
}
