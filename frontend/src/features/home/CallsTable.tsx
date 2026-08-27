import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { CallListItem } from '@receptionist/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCallsQuery } from '@/hooks/useCallsQuery'
import { formatPhone, formatTime, formatDuration } from '@/lib/formatters'
import { callOutcomeConfig } from '@/lib/status-config'
import { cn } from '@/lib/utils'

/** Time · what happened · caller · length · outcome. Widths said once. */
const COLUMNS = [
  { label: 'Time', className: 'w-[72px]' },
  { label: 'What happened', className: '' },
  { label: 'Caller', className: 'w-[150px]' },
  { label: 'Length', className: 'w-[84px]' },
  { label: 'Outcome', className: 'w-[96px] text-right' },
]

export function CallsTable() {
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
      <Table>
        {/* Column headings are labels, not a heading — so no rule beneath them.
            The rules in here separate rows, which is the one job they have. */}
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="border-b-0 hover:bg-transparent">
            {COLUMNS.map((c) => (
              <TableHead key={c.label} className={cn('h-auto px-2.5 pb-2', c.className)}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call: CallListItem) => (
            <TableRow
              key={call.id}
              className="relative h-12 border-t border-b-0 border-border hover:bg-hover has-[a:active]:bg-active"
            >
              <TableCell className="px-2.5 py-0 text-muted-foreground tabular-nums">
                {/* A real link, stretched over the row. The row used to be a
                    <button> calling navigate(), which cannot be opened in a new
                    tab, copied, or read as a destination by a screen reader. */}
                <Link
                  to={`/calls/${call.id}`}
                  className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
                >
                  {formatTime(call.startedAt)}
                  <span className="sr-only">
                    {` — ${call.summary || 'call detail'}`}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="max-w-0 truncate px-2.5 py-0 text-secondary-foreground">
                {call.summary || <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="px-2.5 py-0 text-muted-foreground tabular-nums">
                {call.callerPhone ? formatPhone(call.callerPhone) : 'Withheld'}
              </TableCell>
              <TableCell className="px-2.5 py-0 text-muted-foreground tabular-nums">
                {formatDuration(call.startedAt, call.endedAt) ?? '—'}
              </TableCell>
              <TableCell className="px-2.5 py-0 text-right">
                <StatusBadge value={call.outcome} config={callOutcomeConfig} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {hasNextPage && (
        <div ref={sentinelRef} className="flex items-center justify-center py-3">
          {isFetchingNextPage && <Skeleton className="h-4 w-24" />}
        </div>
      )}
    </div>
  )
}
