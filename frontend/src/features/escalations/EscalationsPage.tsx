import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox } from 'lucide-react'
import { toast } from 'sonner'
import type { EscalationItem, EscalationStatus } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { FilterPills } from '@/components/ui/filter-pills'
import { PageContainer } from '@/layout/PageContainer'
import { PageHeader } from '@/layout/PageHeader'
import { EmptyState } from '@/layout/EmptyState'
import { apiClient } from '@/lib/apiClient'
import { keys, fetchers } from '@/lib/queries'
import { formatPhone, formatDateTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const STATUSES = [
  { id: 'pending', label: 'Waiting' },
  { id: 'resolved', label: 'Answered' },
] as const satisfies readonly { id: EscalationStatus; label: string }[]

function isStatus(v: string | null): v is EscalationStatus {
  return v === 'pending' || v === 'resolved'
}

function AnswerForm({ escalation }: { escalation: EscalationItem }) {
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
      toast.success('Answered — the next caller who asks will get it')
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not save that answer. Try again.'
      toast.error(message)
    },
  })

  return (
    <div className="mt-7">
      <label
        htmlFor="answer"
        className="text-sm font-medium text-foreground"
      >
        Your answer
      </label>
      <p className="mt-px text-sm text-muted-foreground">
        Saved to your knowledge base, so the agent can answer it on the next call.
      </p>
      <Textarea
        id="answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer here…"
        className="mt-2.5 min-h-28 resize-none"
      />
      <div className="mt-3">
        <Button
          onClick={() => resolve.mutate(answer)}
          disabled={!answer.trim() || resolve.isPending}
        >
          {resolve.isPending ? 'Saving…' : 'Save answer'}
        </Button>
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
    /* Hold the previous list while the new filter loads. Switching a filter
       should narrow a list, not empty the screen. */
    placeholderData: (prev) => prev,
  })
  const escalations = data ?? []

  const selectedId = params.get('escalation')
  const selected = escalations.find((e) => e.id === selectedId) ?? escalations[0]

  function setStatus(s: EscalationStatus) {
    const next = new URLSearchParams(params)
    next.set('status', s)
    next.delete('escalation')
    setParams(next, { replace: true })
  }

  function select(id: string) {
    const next = new URLSearchParams(params)
    next.set('escalation', id)
    setParams(next, { replace: true })
  }

  return (
    <PageContainer size="page" className="flex flex-1 flex-col">
      <PageHeader
        title="Escalations"
        description="Questions your agent could not answer. Answer one and it never has to ask you again."
      />

      <FilterPills options={STATUSES} value={status} onChange={setStatus} />

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
              ? 'When a caller asks something your agent has no answer for, it lands here.'
              : 'Answers you give show up here, and in your knowledge base.'
          }
        />
      ) : (
        /* A list and the one you are reading. Selection is a fill, so the list
           stays a list and the answer gets room to be read. */
        <div className="mt-5 flex flex-1 gap-10">
          {/* The same 2px the sidebar rows use. Without it two hovered rows
               touch and you read the edge of the fill as a border. */}
          <div className="flex w-[320px] shrink-0 flex-col gap-0.5">
            {escalations.map((e: EscalationItem) => (
              <button
                key={e.id}
                onClick={() => select(e.id)}
                aria-current={selected?.id === e.id}
                className={cn(
                  // Everything else on the page uses the 8px radius; a square
                  // fill here was the one thing that did not.
                  'group rounded-lg px-3 py-2.5 text-left transition-colors',
                  selected?.id === e.id ? 'bg-sunk-1' : 'hover:bg-hover',
                )}
              >
                <p className="text-sm font-medium leading-snug text-foreground">
                  {e.question}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  {e.status === 'pending' && (
                    <span className="size-1.5 shrink-0 rounded-full bg-accent-ink" />
                  )}
                  <span className="tabular-nums">{formatDateTime(e.createdAt)}</span>
                </p>
              </button>
            ))}
          </div>

          {selected && (
            <div className="min-w-0 flex-1">
              <div className="max-w-[620px]">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  {selected.status === 'pending' && (
                    <span className="size-1.5 shrink-0 rounded-full bg-accent-ink" />
                  )}
                  <span className="tabular-nums">{formatDateTime(selected.createdAt)}</span>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">
                    {selected.callerPhone
                      ? formatPhone(selected.callerPhone)
                      : 'Caller ID withheld'}
                  </span>
                </p>

                <h2 className="mt-2 text-lg font-semibold leading-snug tracking-tight text-foreground">
                  {selected.question}
                </h2>

                {selected.status === 'resolved' && selected.answer ? (
                  <div className="mt-7">
                    <h3 className="text-sm font-medium text-foreground">Your answer</h3>
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
