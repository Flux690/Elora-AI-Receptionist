import { cn } from '@/lib/utils'
import { toneToClasses, type StatusEntry } from '@/lib/status-config'

interface StatusBadgeProps<T extends string> {
  value: T | null | undefined
  config: Record<T, StatusEntry>
  className?: string
}

/**
 * Generic status badge driven by a single StatusEntry config.
 * Replaces the duplicated OutcomeBadge / appointment StatusBadge components.
 * Falls back to a quiet em-dash if the value is missing or unmapped.
 *
 * A tone is type and weight, not a fill, so there is no chip to pad — status
 * reads inline with the row it belongs to.
 */
export function StatusBadge<T extends string>({
  value,
  config,
  className,
}: StatusBadgeProps<T>) {
  const entry = value ? config[value] : undefined
  const label = entry?.label ?? '—'
  const tone = entry?.tone ?? 'quiet'

  return (
    <span
      className={cn(
        'inline-flex items-center text-xs',
        toneToClasses(tone),
        className,
      )}
    >
      {label}
    </span>
  )
}
