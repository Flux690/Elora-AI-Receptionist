import { useState, useRef } from 'react'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { keys, fetchers } from '@/lib/queries'
import { apiClient } from '@/lib/apiClient'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import type {
  Period,
  EscalationStatus,
  CallListItem,
  CallDetail,
  EscalationItem,
  AppointmentItem,
  KnowledgeItem,
} from '@/types/api'

// ── Helpers ──────────────────────────────────────────────────────

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return '—'
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m === 0) return `${sec}s`
  return `${m}m ${sec}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  }
  return phone
}

// ── Status badges ─────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-xs text-text-3">—</span>
  const map: Record<string, { label: string; color: string }> = {
    booked:    { label: 'Booked',    color: 'text-status-booked' },
    escalated: { label: 'Escalated', color: 'text-status-escalated' },
    answered:  { label: 'Answered',  color: 'text-status-answered' },
    abandoned: { label: 'Abandoned', color: 'text-status-abandoned' },
    error:     { label: 'Error',     color: 'text-status-error' },
  }
  const s = map[outcome] ?? { label: outcome, color: 'text-text-2' }
  return <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
}

function AppointmentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    confirmed: { label: 'Confirmed', color: 'text-status-confirmed' },
    requested: { label: 'Requested', color: 'text-status-requested' },
    cancelled: { label: 'Cancelled', color: 'text-status-cancelled' },
  }
  const s = map[status] ?? { label: status, color: 'text-text-2' }
  return <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
}

// ── Audio player ──────────────────────────────────────────────────

function AudioPlayer({ callId, callDetail }: { callId: string; callDetail: CallDetail }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [activeIdx, setActiveIdx] = useState(-1)

  const { data: recording, isLoading } = useQuery({
    queryKey: keys.callRecording(callId),
    queryFn: () => fetchers.callRecording(callId),
    enabled: !!callDetail.recordingUrl,
    staleTime: 50 * 60 * 1000,
  })

  const callStartMs = new Date(callDetail.startedAt).getTime()

  function handleTimeUpdate() {
    const a = audioRef.current
    if (!a) return
    setCurrentTime(a.currentTime)
    if (callDetail.transcript) {
      let idx = -1
      for (let i = 0; i < callDetail.transcript.length; i++) {
        const entry = callDetail.transcript[i]
        if (entry.startTime == null) continue
        const offset = (entry.startTime - callStartMs) / 1000
        if (a.currentTime >= offset) idx = i
      }
      setActiveIdx(idx)
    }
  }

  function handleSeekToEntry(startTime: number | undefined) {
    const a = audioRef.current
    if (!a || startTime == null) return
    const offset = (startTime - callStartMs) / 1000
    a.currentTime = Math.max(0, offset)
    a.play().then(() => setPlaying(true)).catch(() => {})
  }

  function togglePlay() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play().then(() => setPlaying(true)).catch(() => {}) }
  }

  function handleSeekBar(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current
    if (!a) return
    a.currentTime = Number(e.target.value)
    setCurrentTime(Number(e.target.value))
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  if (!callDetail.recordingUrl) {
    return (
      <div className="rounded-card border border-border bg-bg px-4 py-3 text-xs text-text-2">
        No recording available for this call.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-card border border-border bg-bg px-4 py-3 text-xs text-text-2 animate-pulse">
        Loading recording…
      </div>
    )
  }

  return (
    <div className="rounded-card border border-border bg-bg-surface p-4">
      {recording?.url && (
        <audio
          ref={audioRef}
          src={recording.url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
          onEnded={() => setPlaying(false)}
          preload="metadata"
        />
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-all duration-150 ease-out hover:bg-accent-hover active:scale-95"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
              <rect x="0" y="0" width="4" height="14" rx="1"/>
              <rect x="8" y="0" width="4" height="14" rx="1"/>
            </svg>
          ) : (
            <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
              <path d="M1 1l10 6-10 6V1z"/>
            </svg>
          )}
        </button>
        <div className="flex flex-1 flex-col gap-1">
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-accent transition-none"
              style={{ width: `${pct}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={handleSeekBar}
              className="absolute inset-0 w-full cursor-pointer opacity-0"
              aria-label="Seek"
            />
          </div>
          <div className="flex justify-between text-xs text-text-3">
            <span>{fmtTime(currentTime)}</span>
            <span>{fmtTime(duration)}</span>
          </div>
        </div>
      </div>

      {callDetail.transcript && callDetail.transcript.length > 0 && (
        <div className="mt-4 flex flex-col gap-1.5">
          {callDetail.transcript.map((entry, i) => (
            <button
              key={i}
              onClick={() => handleSeekToEntry(entry.startTime)}
              className={`w-full rounded-button px-3 py-2 text-left text-xs transition-colors duration-100 ${
                i === activeIdx ? 'bg-accent-light text-text-1' : 'text-text-2 hover:bg-bg-hover'
              } ${entry.role === 'assistant' ? 'pl-6' : ''}`}
            >
              <span className={`mr-2 font-semibold ${entry.role === 'assistant' ? 'text-accent' : 'text-text-1'}`}>
                {entry.role === 'assistant' ? 'Elora' : 'Caller'}
              </span>
              {entry.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Call detail drawer ────────────────────────────────────────────

function CallDetailDrawer({
  callId,
  open,
  onClose,
}: {
  callId: string | null
  open: boolean
  onClose: () => void
}) {
  const { data: call, isLoading } = useQuery({
    queryKey: keys.call(callId ?? ''),
    queryFn: () => fetchers.call(callId!),
    enabled: !!callId,
  })

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto border-l border-border bg-bg p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="text-sm font-semibold text-text-1">
            {call ? formatPhone(call.callerPhone) : 'Call Detail'}
          </SheetTitle>
          {call && (
            <p className="text-xs text-text-2">
              {formatDate(call.startedAt)} · {formatTime(call.startedAt)} · {formatDuration(call.startedAt, call.endedAt)}
            </p>
          )}
        </SheetHeader>

        <div className="flex flex-col gap-6 p-6">
          {isLoading && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-card bg-bg-hover" />
              ))}
            </div>
          )}

          {call && (
            <>
              <div className="flex items-center justify-between">
                <OutcomeBadge outcome={call.outcome} />
              </div>
              <AudioPlayer callId={call.id} callDetail={call} />
              {call.summary && (
                <div className="rounded-card border border-border-subtle bg-bg-surface p-4">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-text-3">Summary</p>
                  <p className="text-sm leading-relaxed text-text-1">{call.summary}</p>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Escalation drawer ─────────────────────────────────────────────

function EscalationDrawer({
  escalation,
  open,
  onClose,
  onResolved,
}: {
  escalation: EscalationItem | null
  open: boolean
  onClose: () => void
  onResolved: () => void
}) {
  const [answer, setAnswer] = useState('')
  const qc = useQueryClient()

  const resolve = useMutation({
    mutationFn: (ans: string) =>
      apiClient.post(`/admin/escalations/${escalation!.id}/resolve`, { answer: ans }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.escalations('pending') })
      qc.invalidateQueries({ queryKey: keys.escalations('resolved') })
      qc.invalidateQueries({ queryKey: keys.metrics('30d') })
      setAnswer('')
      onResolved()
      onClose()
    },
  })

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 border-l border-border bg-bg p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="text-sm font-semibold text-text-1">Answer Escalation</SheetTitle>
          {escalation && (
            <p className="text-xs text-text-2">
              {formatPhone(escalation.callerPhone)} · {formatDate(escalation.createdAt)}
            </p>
          )}
        </SheetHeader>

        {escalation && (
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
            <div className="rounded-card border border-border bg-bg-surface p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-3">Question</p>
              <p className="text-sm leading-normal text-text-1">{escalation.question}</p>
            </div>

            {escalation.status === 'resolved' && escalation.answer ? (
              <div className="rounded-card border border-border bg-bg-surface p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-status-resolved">Answer</p>
                <p className="text-sm leading-normal text-text-1">{escalation.answer}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer here…"
                  className="min-h-32 resize-none rounded-card border-border bg-bg-surface text-sm text-text-1 placeholder:text-text-3 focus-visible:ring-accent"
                  autoFocus
                />
                <button
                  onClick={() => resolve.mutate(answer)}
                  disabled={!answer.trim() || resolve.isPending}
                  className="self-end rounded-button bg-accent px-4 py-2 text-xs font-semibold text-white transition-all duration-150 ease-out hover:bg-accent-hover disabled:opacity-40 active:scale-95"
                >
                  {resolve.isPending ? 'Saving…' : 'Save Answer'}
                </button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Calls tab ─────────────────────────────────────────────────────

function CallsTab({ onSelectCall }: { onSelectCall: (id: string) => void }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: keys.calls(),
    queryFn: ({ pageParam }) => fetchers.calls({ limit: 25, offset: pageParam as number }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => lastPage.length === 25 ? pages.length * 25 : undefined,
  })

  const calls = data?.pages.flat() ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <div className="h-3 w-32 animate-pulse rounded-full bg-bg-hover" />
            <div className="h-3 w-20 animate-pulse rounded-full bg-bg-hover" />
            <div className="h-3 w-12 animate-pulse rounded-full bg-bg-hover" />
            <div className="h-3 w-16 animate-pulse rounded-full bg-bg-hover" />
          </div>
        ))}
      </div>
    )
  }

  if (calls.length === 0) {
    return <p className="py-8 text-center text-xs text-text-2">No calls yet.</p>
  }

  return (
    <div>
      <div className="flex flex-col divide-y divide-border">
        {calls.map((call: CallListItem) => (
          <button
            key={call.id}
            onClick={() => onSelectCall(call.id)}
            className="flex w-full items-center gap-4 py-3 text-left transition-colors duration-100 hover:bg-bg-hover rounded-button"
          >
            <span className="w-36 shrink-0 text-sm font-medium text-text-1">{formatPhone(call.callerPhone)}</span>
            <span className="w-28 shrink-0 text-xs text-text-2">{formatDate(call.startedAt)}</span>
            <span className="w-16 shrink-0 text-xs text-text-2">{formatDuration(call.startedAt, call.endedAt)}</span>
            <span className="flex-1"><OutcomeBadge outcome={call.outcome} /></span>
            <svg className="shrink-0 text-text-3" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ))}
      </div>
      {hasNextPage && (
        <div className="mt-4 flex justify-center pb-2">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-button border border-border px-4 py-2 text-xs font-medium text-text-2 hover:bg-bg-hover transition-colors duration-150 disabled:opacity-40"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Escalations tab ───────────────────────────────────────────────

function EscalationsTab({ onSelectEscalation }: { onSelectEscalation: (e: EscalationItem) => void }) {
  const [status, setStatus] = useState<EscalationStatus>('pending')

  const { data, isLoading } = useQuery({
    queryKey: keys.escalations(status),
    queryFn: () => fetchers.escalations(status),
  })

  const escalations = data ?? []

  return (
    <div>
      <div className="flex gap-1 mb-5">
        {(['pending', 'resolved'] as EscalationStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-pill px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              status === s ? 'bg-accent text-white' : 'text-text-2 hover:bg-bg-hover'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-card bg-bg-hover" />
          ))}
        </div>
      )}

      {!isLoading && escalations.length === 0 && (
        <p className="py-8 text-center text-xs text-text-2">
          {status === 'pending' ? 'No pending escalations.' : 'No resolved escalations.'}
        </p>
      )}

      {!isLoading && (
        <div className="flex flex-col divide-y divide-border">
          {escalations.map((e: EscalationItem) => (
            <button
              key={e.id}
              onClick={() => onSelectEscalation(e)}
              className="flex w-full items-start gap-3 py-3 text-left transition-colors duration-100 hover:bg-bg-hover rounded-button"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-1 leading-snug truncate">{e.question}</p>
                <p className="mt-0.5 text-xs text-text-2">{formatPhone(e.callerPhone)} · {formatDate(e.createdAt)}</p>
              </div>
              <svg className="mt-0.5 shrink-0 text-text-3" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Appointments tab ──────────────────────────────────────────────

function AppointmentsTab() {
  const { data, isLoading } = useQuery({
    queryKey: keys.appointments,
    queryFn: fetchers.appointments,
  })

  const appointments = data ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-card bg-bg-hover" />
        ))}
      </div>
    )
  }

  if (appointments.length === 0) {
    return <p className="py-8 text-center text-xs text-text-2">No appointments yet.</p>
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {appointments.map((a: AppointmentItem) => (
        <div key={a.id} className="flex items-center gap-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-1">{a.service}</p>
            <p className="text-xs text-text-2">
              {formatPhone(a.callerPhone)} · {a.startTime ? `${formatDate(a.startTime)} at ${formatTime(a.startTime)}` : 'Time TBD'}
            </p>
          </div>
          <AppointmentBadge status={a.status} />
        </div>
      ))}
    </div>
  )
}

// ── Knowledge tab ─────────────────────────────────────────────────

function KnowledgeTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: keys.knowledge,
    queryFn: fetchers.knowledge,
  })

  const del = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/knowledge/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.knowledge }),
  })

  const items = data ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-card bg-bg-hover" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="py-8 text-center text-xs text-text-2">No knowledge entries yet. They are created automatically when you answer escalations.</p>
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {items.map((item: KnowledgeItem) => (
        <div key={item.id} className="flex items-start gap-3 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-1 leading-snug">{item.question}</p>
            <p className="mt-1 text-xs text-text-2 leading-relaxed">{item.answer}</p>
          </div>
          <button
            onClick={() => { if (confirm('Delete this entry?')) del.mutate(item.id) }}
            disabled={del.isPending}
            className="mt-0.5 shrink-0 text-xs text-text-3 hover:text-status-escalated transition-colors duration-150 disabled:opacity-40"
            aria-label="Delete"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────

type TabId = 'calls' | 'escalations' | 'appointments' | 'knowledge'

export default function Dashboard({ tab }: { tab: TabId }) {
  const [period, setPeriod] = useState<Period>('30d')
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [selectedEscalation, setSelectedEscalation] = useState<EscalationItem | null>(null)

  const { data: metrics } = useQuery({
    queryKey: keys.metrics(period),
    queryFn: () => fetchers.metrics(period),
  })

  const kpis = [
    { label: 'Total Calls',  value: metrics?.totalCalls ?? '—' },
    { label: 'Bookings',     value: metrics?.confirmedBookings ?? '—' },
    { label: 'Escalations',  value: metrics?.pendingEscalations ?? '—' },
    { label: 'Abandoned',    value: metrics?.abandonedCalls ?? '—' },
  ]

  const periods: Array<{ id: Period; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: '7d',    label: '7 days' },
    { id: '30d',   label: '30 days' },
  ]

  const heading: Record<TabId, string> = {
    calls:        'Calls',
    escalations:  'Escalations',
    appointments: 'Appointments',
    knowledge:    'Knowledge',
  }

  return (
    <div className="flex flex-col px-8 py-6 min-h-full">

      {/* Page heading + period filter */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-text-1">{heading[tab]}</h1>
        {tab === 'calls' && (
          <div className="flex gap-0.5 rounded-pill border border-border bg-bg-surface p-0.5">
            {periods.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                  period === p.id ? 'bg-accent text-white' : 'text-text-2 hover:bg-bg-hover'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI cards — calls tab only */}
      {tab === 'calls' && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {kpis.map(k => (
            <div
              key={k.label}
              className="rounded-card border border-border bg-bg-surface px-5 py-4 shadow-sm"
            >
              <p className="text-3xl font-bold leading-tight text-text-1">{k.value}</p>
              <p className="mt-1 text-xs text-text-2">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab content — wrapped in a card */}
      <div className="rounded-card border border-border bg-bg-surface shadow-sm">
        {tab === 'calls' && (
          <>
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-text-1">Recent Calls</h2>
            </div>
            <div className="px-5 py-1">
              <CallsTab onSelectCall={id => setSelectedCallId(id)} />
            </div>
          </>
        )}

        {tab === 'escalations' && (
          <div className="px-5 py-5">
            <EscalationsTab onSelectEscalation={e => setSelectedEscalation(e)} />
          </div>
        )}

        {tab === 'appointments' && (
          <div className="px-5 py-1">
            <AppointmentsTab />
          </div>
        )}

        {tab === 'knowledge' && (
          <div className="px-5 py-1">
            <KnowledgeTab />
          </div>
        )}
      </div>

      {/* Drawers */}
      <CallDetailDrawer
        callId={selectedCallId}
        open={!!selectedCallId}
        onClose={() => setSelectedCallId(null)}
      />
      <EscalationDrawer
        escalation={selectedEscalation}
        open={!!selectedEscalation}
        onClose={() => setSelectedEscalation(null)}
        onResolved={() => {}}
      />
    </div>
  )
}
