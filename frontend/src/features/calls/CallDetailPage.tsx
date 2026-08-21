import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import type { CallDetail } from '@receptionist/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { PageContainer } from '@/layout/PageContainer'
import { keys, fetchers } from '@/lib/queries'
import { callOutcomeConfig } from '@/lib/status-config'
import { formatPhone, formatDateTime, formatDuration } from '@/lib/formatters'
import AudioPlayer from './AudioPlayer'

/**
 * A call, on its own page rather than in a drawer.
 *
 * It was a Sheet reached through a `?call=` search param, which meant a call
 * could not be linked to, opened in a tab, or arrived at from anywhere but the
 * table. A call is a record with a URL; a drawer is for something transient.
 */
export default function CallDetailPage() {
  const { id = '' } = useParams()

  const { data: call, isLoading } = useQuery<CallDetail>({
    queryKey: keys.call(id),
    queryFn: () => fetchers.call(id),
    enabled: !!id,
  })

  return (
    <PageContainer size="page">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        Home
      </Link>

      {isLoading || !call ? (
        <div className="mt-5 flex flex-col gap-4">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      ) : (
        <div className="mt-5 flex gap-10">
          <div className="w-[540px] shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  {call.callerPhone ? formatPhone(call.callerPhone) : 'Caller ID withheld'}
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {formatDateTime(call.startedAt)}
                  {formatDuration(call.startedAt, call.endedAt) && (
                    <> · {formatDuration(call.startedAt, call.endedAt)}</>
                  )}
                </p>
              </div>
              <StatusBadge value={call.outcome} config={callOutcomeConfig} />
            </div>

            <div className="mt-5">
              <AudioPlayer callId={id} hasRecording={!!call.recordingUrl} />
            </div>

            <h2 className="mt-7 text-base font-semibold tracking-tight text-foreground">
              Transcript
            </h2>
            {/* Plain text. These were buttons that seeked the audio; they are
                not focusable and not announced as interactive any more. */}
            <div className="mt-2 flex flex-col">
              {call.transcript?.length ? (
                call.transcript.map((entry, i) => (
                  <div key={i} className="grid grid-cols-[58px_1fr] gap-4 py-2">
                    <span className="text-sm text-muted-foreground">
                      {entry.role === 'user' ? 'Caller' : 'Agent'}
                    </span>
                    <span
                      className={
                        entry.role === 'user'
                          ? 'text-sm leading-relaxed text-foreground'
                          : 'text-sm leading-relaxed text-secondary-foreground'
                      }
                    >
                      {entry.text}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No transcript was captured for this call.
                </p>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Summary
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary-foreground">
              {call.summary || (
                <span className="text-muted-foreground">
                  This call was too short to summarise.
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
