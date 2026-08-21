import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox } from 'lucide-react'
import { toast } from 'sonner'
import type { EscalationItem, EscalationStatus } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/layout/PageContainer'
import { EmptyState } from '@/layout/EmptyState'
import { apiClient } from '@/lib/apiClient'
import { keys, fetchers } from '@/lib/queries'
import { formatPhone, formatDateTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const STATUSES: EscalationStatus[] = ['pending', 'resolved']
const STATUS_LABEL: Record<EscalationStatus, string> = {
  pending: 'Waiting',
  resolved: 'Answered',
}

function isStatus(v: string | null): v is EscalationStatus {
  return v === 'pending' || v === 'resolved'
}

interface AnswerFormProps {
  escalation: EscalationItem
}

function AnswerForm({ escalation }: AnswerFormProps) {
  const [answer, setAnswer] = useState('')
  const qc = useQueryClient()

  // Reset the draft when switching between escalations.
  useEffect(() => setAnswer(''), [escalation.id])

  const resolve = useMutation({
    mutationFn: (ans: string) =>
      apiClient.post(`/admin/escalations/${escalation.id}/resolve`, { answer: ans }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['escalations'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
      qc.invalidateQueries({ queryKey: keys.knowledge })
      setAnswer('')
      toast.success('Saved — the next caller who asks will get it')
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to resolve escalation. Try again.'
      toast.error(message)
    },
  })

  return (
    <div className="mt-7">
      <h2 className="text-base font-semibold tracking-tight text-foreground">Your answer</h2>
      {/* A border and no fill. The card underneath is already white; a second
          fill here would be a surface for something that is not an object. */}
      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer here…"
        className="mt-2 min-h-24 resize-none bg-transparent"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button
          onClick={() => resolve.mutate(answer)}
          disabled={!answer.trim() || resolve.isPending}
        >
          {resolve.isPending ? 'Saving…' : 'Save & teach Zen'}
        </Button>
        <p className="text-sm text-muted-foreground">
          Answering this adds it to your agent&rsquo;s knowledge.
        </p>
      </div>
    </div>
  )
}

export default function EscalationsPage() {
  const [params, setParams] = useSearchParams()
  const status: EscalationStatus = isStatus(params.get('status'))
    ? (params.get('status') as EscalationStatus)
    : 'pending'

  const { data, isLoading } = useQuery({
    queryKey: keys.escalations(status),
    queryFn: () => fetchers.escalations(status),
    /* Hold the previous list while the new filter loads. Without this, each
       toggle is a fresh query key with no cache, so `isLoading` flips true and
       the whole view — including the panel explaining what the page is for —
       is torn down and replaced by skeletons for a beat. Switching a filter
       should narrow a list, not empty the screen. */
    placeholderData: (prev) => prev,
  })
  const escalations = data ?? []

  const selectedId = params.get('escalation')
  const selected = escalations.find((e) => e.id === selectedId) ?? escalations[0]

  function update(next: URLSearchParams) {
    setParams(next, { replace: true })
  }

  function setStatus(s: EscalationStatus) {
    const next = new URLSearchParams(params)
    next.set('status', s)
    next.delete('escalation')
    update(next)
  }

  function select(id: string) {
    const next = new URLSearchParams(params)
    next.set('escalation', id)
    update(next)
  }

  return (
    <PageContainer size="page" className="flex flex-1 flex-col">
      <div className="text-sm text-muted-foreground">Escalations</div>

      <div className="mt-4 flex items-end justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Questions your agent could not answer
        </h1>
        <div className="flex gap-0.5 rounded-lg bg-sunk p-0.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'rounded-md px-3 py-1 text-sm transition-colors',
                status === s
                  ? 'bg-card font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : escalations.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={status === 'pending' ? 'Nothing waiting on you' : 'Nothing answered yet'}
          description={
            status === 'pending'
              ? 'When your agent does not know how to answer something, it appears here.'
              : 'Answers you give will be listed here once you save them.'
          }
        />
      ) : (
        /* List and detail. Selection is carried by a fill, not a border or a
           chevron — the list stays a list and the answer gets room to be read. */
        <div className="mt-6 flex flex-1 gap-8">
          <div className="flex w-[330px] shrink-0 flex-col gap-0.5">
            {escalations.map((e: EscalationItem) => (
              <button
                key={e.id}
                onClick={() => select(e.id)}
                className={cn(
                  'rounded-lg p-3 text-left transition-colors',
                  selected?.id === e.id ? 'bg-sunk' : 'hover:bg-hover',
                )}
              >
                <div className="flex items-center gap-2">
                  {e.status === 'pending' && (
                    <span className="size-1.5 shrink-0 rounded-full bg-accent-ink" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {formatDateTime(e.createdAt)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">
                  {e.question}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {e.callerPhone ? formatPhone(e.callerPhone) : 'Caller ID withheld'}
                </p>
              </button>
            ))}
          </div>

          {selected && (
            /* The one card on this screen. An escalation genuinely is an
               object: it arrives, it waits, and you act on it. */
            <div className="min-w-0 flex-1">
              <div className="max-w-[660px] rounded-lg border border-input bg-card p-6">
                <div className="flex items-center gap-2">
                  {selected.status === 'pending' && (
                    <span className="size-1.5 shrink-0 rounded-full bg-accent-ink" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {formatDateTime(selected.createdAt)} ·{' '}
                    {selected.callerPhone
                      ? formatPhone(selected.callerPhone)
                      : 'caller ID withheld'}
                  </span>
                </div>

                <h2 className="mt-3 text-lg font-semibold leading-snug tracking-tight text-foreground">
                  {selected.question}
                </h2>

                {selected.status === 'resolved' && selected.answer ? (
                  <div className="mt-6">
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      Your answer
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-secondary-foreground">
                      {selected.answer}
                    </p>
                  </div>
                ) : (
                  <AnswerForm escalation={selected} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  )
}
