import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { keys, fetchers } from '@/lib/queries'
import type { Period } from '@/lib/types'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d',    label: '7 days' },
  { id: '30d',   label: '30 days' },
]

function isPeriod(v: string | null): v is Period {
  return v === 'today' || v === '7d' || v === '30d'
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

  const KPI_LABELS = ['Total Calls', 'Bookings', 'Escalations', 'Abandoned']

  if (isLoading) {
    return (
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-52" />
          </div>
          <Skeleton className="h-7 w-36" />
        </div>
        <div className="flex items-stretch divide-x divide-border">
          {KPI_LABELS.map((label, i) => (
            <div key={label} className={cn('flex flex-1 flex-col gap-1.5', i === 0 ? 'pr-6' : 'px-6')}>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-14" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  const kpis = [
    { label: 'Total Calls',  value: metrics?.totalCalls },
    { label: 'Bookings',     value: metrics?.confirmedBookings },
    { label: 'Escalations',  value: metrics?.pendingEscalations },
    { label: 'Abandoned',    value: metrics?.abandonedCalls },
  ]

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Call Stats</h2>
          <p className="text-sm text-muted-foreground">All calls handled by our AI receptionist</p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => {
            const active = period === p.id
            return (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-stretch divide-x divide-border">
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className={cn('flex flex-1 flex-col gap-1', i === 0 ? 'pr-6' : 'px-6')}
          >
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="text-3xl font-bold tabular-nums text-foreground">
              {k.value ?? 0}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
