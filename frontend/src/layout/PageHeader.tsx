import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  /** One line, in the reader's terms. Omit it rather than restating the title. */
  description?: React.ReactNode
  /** A control that belongs to the page as a whole, e.g. Test Agent. */
  actions?: React.ReactNode
  className?: string
}

/**
 * The top of every page, written once.
 *
 * Every page had its own arrangement before this — Settings hand-rolled an h1,
 * Home built a bespoke header, and Escalations, Appointments and Knowledge had
 * no title at all, so which page you were on was carried by the sidebar alone.
 * One component means the measure, the weight and the gap below are decided in
 * a single place and cannot drift apart again.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 flex items-start justify-between gap-6', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  )
}
