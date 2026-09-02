import { useSearchParams } from 'react-router-dom'
import type { DashboardMetrics } from '@receptionist/shared'
import { FilterPills } from '@/components/ui/filter-pills'
import type { Period } from '@/lib/types'

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
] as const satisfies readonly { id: Period; label: string }[]

function Figure({ value, label, waiting }: { value: number; label: string; waiting?: boolean }) {
  const tone = waiting ? 'text-accent-ink' : 'text-foreground'
  return (
    <>
      <span className={`font-medium ${tone}`}>{value}</span>{' '}
      <span className={waiting ? 'text-accent-ink' : undefined}>{label}</span>
    </>
  )
}

/** One line of figures and the period they cover. */
export function CallStats({ period, metrics }: { period: Period; metrics: DashboardMetrics }) {
  const [params, setParams] = useSearchParams()

  function setPeriod(next: Period) {
    const p = new URLSearchParams(params)
    p.set('period', next)
    setParams(p, { replace: true })
  }

  return (
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <p className="min-w-0 truncate text-lg text-muted-foreground tabular-nums">
        <Figure value={metrics.totalCalls} label="calls" />
        {' · '}
        <Figure value={metrics.confirmedBookings} label="booked" />
        {' · '}
        <Figure value={metrics.pendingEscalations} label="waiting on you" waiting />
        {' · '}
        <Figure value={metrics.abandonedCalls} label="abandoned" />
      </p>
      <FilterPills
        options={PERIODS}
        value={period}
        onChange={setPeriod}
        label="Time period"
        className="shrink-0"
      />
    </div>
  )
}
