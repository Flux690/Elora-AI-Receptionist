import { Skeleton } from '@/components/ui/skeleton'
import { formatPhone } from '@/lib/formatters'
import { TestAgentControl } from './TestAgentControl'
import type { AppSettings } from '@/lib/settings-types'

interface OverviewHeaderProps {
  settings: AppSettings | undefined
}

/**
 * Who you are and who is answering, as page content rather than a card.
 *
 * This used to sit on a Card. A card is for an object — a call, an escalation,
 * a settings group you can act on as a unit. A page heading is none of those,
 * and boxing it just draws a line round the top of the screen.
 */
export function OverviewHeader({ settings }: OverviewHeaderProps) {
  if (!settings) {
    return (
      <div>
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-5 w-72" />
      </div>
    )
  }

  const { business, agent } = settings

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {business.name}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {business.industry}
          {business.phoneNumber && (
            <>
              {' · '}
              {agent.name || 'Your agent'} is answering{' '}
              <span className="text-secondary-foreground">
                {formatPhone(business.phoneNumber)}
              </span>
            </>
          )}
        </p>
      </div>
      <TestAgentControl />
    </div>
  )
}
