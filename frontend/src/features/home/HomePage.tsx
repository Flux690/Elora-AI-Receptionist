import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/layout/PageContainer'
import { keys, fetchers } from '@/lib/queries'
import { useCallsQuery } from '@/hooks/useCallsQuery'
import { OverviewCard } from './OverviewCard'
import { CallStats } from './CallStats'
import { CallsTable } from './CallsTable'
import { CallDetailSheet } from './CallDetailSheet'

export default function HomePage() {
  const [params, setParams] = useSearchParams()
  const callId = params.get('call')

  function selectCall(id: string | null) {
    const next = new URLSearchParams(params)
    if (id) next.set('call', id)
    else next.delete('call')
    setParams(next, { replace: true })
  }

  const { data: settings } = useQuery({
    queryKey: keys.settings,
    queryFn: fetchers.settings,
  })

  const { isLoading: callsLoading } = useCallsQuery()

  return (
    <PageContainer size="md">
      <div className="flex flex-col gap-8">
        <OverviewCard settings={settings} />

        <CallStats />

        <section>
          {callsLoading
            ? <Skeleton className="mb-4 h-6 w-28" />
            : <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Calls</h2>
          }
          <CallsTable onSelectCall={selectCall} />
        </section>
      </div>

      <CallDetailSheet
        callId={callId}
        open={!!callId}
        onClose={() => selectCall(null)}
      />
    </PageContainer>
  )
}
