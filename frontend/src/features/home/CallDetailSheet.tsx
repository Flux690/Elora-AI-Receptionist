import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Timer } from 'lucide-react'
import type { CallDetail } from '@receptionist/shared'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { keys, fetchers } from '@/lib/queries'
import {
  formatPhone,
  formatDate,
  formatTime,
  formatDuration,
} from '@/lib/formatters'
import { callOutcomeConfig } from '@/lib/status-config'
import AudioPlayer, { type AudioPlayerHandle } from './AudioPlayer'
import { cn } from '@/lib/utils'

type DetailTab = 'summary' | 'transcript'

interface DetailTabsProps {
  call: CallDetail
  activeIdx: number
  onSeek: (startTime: number | undefined) => void
}

function DetailTabs({ call, activeIdx, onSeek }: DetailTabsProps) {
  const [tab, setTab] = useState<DetailTab>('summary')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(['summary', 'transcript'] as DetailTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize',
              tab === t
                ? 'bg-card text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <div>
          {call.summary ? (
            <p className="text-sm leading-relaxed text-foreground">{call.summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No summary available.</p>
          )}
        </div>
      )}

      {tab === 'transcript' && (
        <div className="flex flex-col gap-1.5">
          {call.transcript && call.transcript.length > 0 ? (
            call.transcript.map((entry, i) => {
              const isAgent = entry.role === 'assistant'
              return (
                <button
                  key={i}
                  onClick={() => onSeek(entry.startTime)}
                  className={cn(
                    'w-full text-left rounded-md px-3 py-2 text-xs transition-colors cursor-pointer',
                    i === activeIdx
                      ? 'bg-primary-subtle text-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'mr-2 font-semibold',
                      isAgent ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {isAgent ? 'Agent' : 'Caller'}
                  </span>
                  {entry.text}
                </button>
              )
            })
          ) : (
            <p className="text-sm text-muted-foreground">No transcript available.</p>
          )}
        </div>
      )}
    </div>
  )
}

interface CallDetailSheetProps {
  callId: string | null
  open: boolean
  onClose: () => void
}

export function CallDetailSheet({ callId, open, onClose }: CallDetailSheetProps) {
  const [activeIdx, setActiveIdx] = useState(-1)
  const playerRef = useRef<AudioPlayerHandle>(null)

  const { data: call, isLoading } = useQuery({
    queryKey: keys.call(callId ?? ''),
    queryFn: () => fetchers.call(callId as string),
    enabled: !!callId,
  })

  const duration = call ? formatDuration(call.startedAt, call.endedAt) : null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto border-l border-border bg-background p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {call ? formatPhone(call.callerPhone) : 'Call Detail'}
          </SheetTitle>
          {call && (
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {formatDate(call.startedAt)} at {formatTime(call.startedAt)}
              </span>
              {duration && (
                <span className="inline-flex items-center gap-1">
                  <Timer className="size-3" />
                  {duration}
                </span>
              )}
              <StatusBadge value={call.outcome} config={callOutcomeConfig} />
            </div>
          )}
        </SheetHeader>

        <div className="flex flex-col gap-6 p-6">
          {isLoading && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {call && (
            <>
              <AudioPlayer
                ref={playerRef}
                callId={call.id}
                callDetail={call}
                onActiveIdxChange={setActiveIdx}
              />
              <DetailTabs
                call={call}
                activeIdx={activeIdx}
                onSeek={(st) => playerRef.current?.seekToEntry(st)}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
