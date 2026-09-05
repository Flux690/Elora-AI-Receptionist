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

/** The unit is drawn rather than chosen, so no duration is a mode and nothing
 *  else inside the border competes for the focus ring. */
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
