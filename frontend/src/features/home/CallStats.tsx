import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { FilterPills } from '@/components/ui/filter-pills'
import { cn } from '@/lib/utils'
import { keys, fetchers } from '@/lib/queries'
import type { Period } from '@/lib/types'

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: '7d',    label: '7 days' },
  { id: '30d',   label: '30 days' },
] as const satisfies readonly { id: Period; label: string }[]

function isPeriod(v: string | null): v is Period {
  return v === 'today' || v === '7d' || v === '30d'
}

interface FigureProps {
  label: string
  value: number | undefined
  /** Only the count that needs a person is coloured. */
  waiting?: boolean
}

function Figure({ label, value, waiting }: FigureProps) {
  return (
    <div>
      <div className={cn('text-sm', waiting ? 'text-accent-ink' : 'text-muted-foreground')}>
        {label}
      </div>
      <div
        className={cn(
          'mt-1.5 text-2xl font-semibold tabular-nums tracking-tight',
          waiting ? 'text-accent-ink' : 'text-foreground',
        )}
      >
        {value ?? 0}
      </div>
    </div>
  )
}

export function CallStats() {
  const [params, setParams] = useSearchParams()
  const period: Period = isPeriod(params.get('period')) ? (params.get('period') as Period) : '30d'

  function setPeriod(p: Period) {
    const next = new URLSearchParams(params)
    next.set('period', p)
    setParams(next, { replace: true })
  }

  const { data: metrics, isLoading } = useQuery({
    queryKey: keys.metrics(period),
    queryFn: () => fetchers.metrics(period),
  })

  return (
    <section>
      {/* No heading. The selected pill already says which period this is —
          a title repeating it would be the same word twice. */}
      <FilterPills options={PERIODS} value={period} onChange={setPeriod} className="mb-5" label="Time period" />

      {/* No dividers. Four figures on a stage are already four figures; a rule
          between each one is a line doing work that spacing does. */}
      {isLoading ? (
        <div className="flex gap-14">
          {['Calls', 'Bookings', 'Waiting on you', 'Abandoned'].map((l) => (
            <div key={l}>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-1.5 h-8 w-10" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-14">
          <Figure label="Calls" value={metrics?.totalCalls} />
          <Figure label="Bookings" value={metrics?.confirmedBookings} />
          <Figure label="Waiting on you" value={metrics?.pendingEscalations} waiting />
          <Figure label="Abandoned" value={metrics?.abandonedCalls} />
        </div>
      )}
    </section>
  )
}
