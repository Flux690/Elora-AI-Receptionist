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
 * Falls back to a muted "Unknown" if the value is missing or unmapped.
 */
export function StatusBadge<T extends string>({
  value,
  config,
  className,
}: StatusBadgeProps<T>) {
  const entry = value ? config[value] : undefined
  const label = entry?.label ?? '—'
  const tone = entry?.tone ?? 'muted'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        toneToClasses(tone),
        className,
      )}
    >
      {label}
    </span>
  )
}
