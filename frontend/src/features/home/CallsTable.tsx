import { useEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import type { CallListItem } from '@receptionist/shared'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useCallsQuery } from '@/hooks/useCallsQuery'
import { formatPhone, formatDate, formatDuration } from '@/lib/formatters'
import { callOutcomeConfig } from '@/lib/status-config'

interface CallsTableProps {
  onSelectCall: (id: string) => void
}

export function CallsTable({ onSelectCall }: CallsTableProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useCallsQuery()

  // Auto-load next page when sentinel scrolls into view.
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasNextPage) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const calls = data?.pages.flat() ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (calls.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">No calls yet.</p>
    )
  }

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Caller</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call: CallListItem) => {
            const duration = formatDuration(call.startedAt, call.endedAt)
            return (
              <TableRow
                key={call.id}
                onClick={() => onSelectCall(call.id)}
                className="cursor-pointer"
              >
                <TableCell className="text-sm font-medium text-foreground">
                  {formatPhone(call.callerPhone)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(call.startedAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {duration ?? <Skeleton className="h-3 w-10" />}
                </TableCell>
                <TableCell>
                  <StatusBadge value={call.outcome} config={callOutcomeConfig} />
                </TableCell>
                <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                  {call.summary || <span className="text-muted-foreground/60">—</span>}
                </TableCell>
                <TableCell>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {hasNextPage && (
        <div ref={sentinelRef} className="flex items-center justify-center border-t border-border/40 py-3">
          {isFetchingNextPage && <Skeleton className="h-4 w-24" />}
        </div>
      )}
    </Card>
  )
}
