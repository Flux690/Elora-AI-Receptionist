import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/**
 * Linear-style empty state primitive.
 *
 * Layout: vertically centered in available space, content left-aligned,
 * max-width ~480px. Icon top, bold title, muted description, optional CTA.
 *
 * Purpose: explain what the page is when there's no data — nothing more.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-1 w-full items-center justify-center px-6 py-12',
        className,
      )}
    >
      <div className="flex max-w-sm flex-col items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-sunk-1">
          <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  )
}
