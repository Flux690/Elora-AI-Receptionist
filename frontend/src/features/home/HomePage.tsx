import { useQueries } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/layout/PageContainer'
import { PageHeader } from '@/layout/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { keys, fetchers } from '@/lib/queries'
import { usePageReady } from '@/hooks/usePageData'
import { formatPhone } from '@/lib/formatters'
import type { Period } from '@/lib/types'
import { CallStats } from './CallStats'
import { CallsTable } from './CallsTable'
import { TestAgentControl } from './TestAgentControl'

function isPeriod(v: string | null): v is Period {
  return v === 'today' || v === '7d' || v === '30d'
}

function HomeSkeleton() {
  return (
    <>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-6 w-80" />
      <Skeleton className="mt-7 h-7 w-96" />
      <div className="mt-8 flex flex-col gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </>
  )
}

/**
 * The call log. Settings and metrics are fetched here rather than inside the
 * pieces, so the page paints once instead of in three stages.
 */
export default function HomePage() {
  const [params] = useSearchParams()
  const raw = params.get('period')
  const period: Period = isPeriod(raw) ? raw : '30d'

  const [settings, metrics] = useQueries({
    queries: [
      { queryKey: keys.settings, queryFn: fetchers.settings },
      { queryKey: keys.metrics(period), queryFn: () => fetchers.metrics(period) },
    ],
  })

  const { ready, showSkeleton } = usePageReady(settings.isPending || metrics.isPending)

  return (
    <PageContainer>
      {!ready ? (
        showSkeleton ? <HomeSkeleton /> : null
      ) : (
        <>
          <PageHeader
            title={settings.data!.business.name}
            actions={<TestAgentControl />}
            description={
              <>
                {settings.data!.business.industry}
                {settings.data!.business.phoneNumber && (
                  <>
                    {' · '}
                    {settings.data!.agent.name || 'Your agent'} is answering{' '}
                    <span className="text-secondary-foreground tabular-nums">
                      {formatPhone(settings.data!.business.phoneNumber)}
                    </span>
                  </>
                )}
              </>
            }
          />
          <CallStats period={period} metrics={metrics.data!} />
          <CallsTable />
        </>
      )}
    </PageContainer>
  )
}
