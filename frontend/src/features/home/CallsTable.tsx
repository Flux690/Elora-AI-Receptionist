import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CallListItem } from '@receptionist/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useCallsQuery } from '@/hooks/useCallsQuery'
import { formatPhone, formatTime, formatDuration } from '@/lib/formatters'
import { callOutcomeConfig } from '@/lib/status-config'

/** Time · what happened · caller · length · outcome. */
const COLS = 'grid grid-cols-[72px_1fr_150px_84px_96px] items-center gap-5'

export function CallsTable() {
  const navigate = useNavigate()
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useCallsQuery()

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasNextPage) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: '200px' },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const calls = data?.pages.flat() ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (calls.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">No calls yet.</p>
  }

  return (
    <div>
      {/* Column headings are labels, not a heading — so no rule beneath them.
          The rules in here separate rows, which is the one job they have. */}
      <div className={`${COLS} px-2.5 pb-2 text-sm text-muted-foreground`}>
        <div>Time</div>
        <div>What happened</div>
        <div>Caller</div>
        <div>Length</div>
        <div className="justify-self-end">Outcome</div>
      </div>

      {calls.map((call: CallListItem) => (
        <button
          key={call.id}
          onClick={() => navigate(`/calls/${call.id}`)}
          className={`${COLS} h-12 w-full cursor-pointer rounded-lg border-t border-border px-2.5 text-left transition-colors hover:bg-hover active:bg-active`}
        >
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatTime(call.startedAt)}
          </span>
          <span className="truncate text-sm text-secondary-foreground">
            {call.summary || <span className="text-muted-foreground">—</span>}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {call.callerPhone ? formatPhone(call.callerPhone) : 'Withheld'}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatDuration(call.startedAt, call.endedAt) ?? '—'}
          </span>
          <span className="justify-self-end">
            <StatusBadge value={call.outcome} config={callOutcomeConfig} />
          </span>
        </button>
      ))}

      {hasNextPage && (
        <div ref={sentinelRef} className="flex items-center justify-center py-3">
          {isFetchingNextPage && <Skeleton className="h-4 w-24" />}
        </div>
      )}
    </div>
  )
}
