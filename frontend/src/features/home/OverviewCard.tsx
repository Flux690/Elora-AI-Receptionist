import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/layout/PageHeader'
import { formatPhone } from '@/lib/formatters'
import { TestAgentControl } from './TestAgentControl'
import type { AppSettings } from '@/lib/settings-types'

interface OverviewHeaderProps {
  settings: AppSettings | undefined
}

/**
 * Who you are and who is answering.
 *
 * This used to hand-roll its own `<h1>` and description, which is the second
 * implementation of a page heading in a product that already had `PageHeader` —
 * two places for the measure, the weight and the gap below to drift apart. It
 * is the same header as every other page now; only the words are its own.
 *
 * (It was a Card before that. A card is for an object — a call, an escalation,
 * a settings group you can act on as a unit. A page heading is none of those,
 * and boxing it just draws a line round the top of the screen.)
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
    <PageHeader
      className="mb-0"
      title={business.name}
      actions={<TestAgentControl />}
      description={
        <>
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
        </>
      }
    />
  )
}
