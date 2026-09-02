import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  /** One line, in the reader's terms. Omit it rather than restating the title. */
  description?: React.ReactNode
  /** A control belonging to the page as a whole, such as Test agent. */
  actions?: React.ReactNode
  className?: string
}

/** The top of every page. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-5 flex items-start justify-between gap-6', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 text-base text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  )
}
