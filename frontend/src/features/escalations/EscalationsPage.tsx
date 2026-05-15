import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Inbox } from 'lucide-react'
import { toast } from 'sonner'
import type { EscalationItem, EscalationStatus } from '@receptionist/shared'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PageContainer } from '@/layout/PageContainer'
import { EmptyState } from '@/layout/EmptyState'
import { apiClient } from '@/lib/apiClient'
import { keys, fetchers } from '@/lib/queries'
import { formatPhone, formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const STATUSES: EscalationStatus[] = ['pending', 'resolved']
const STATUS_LABEL: Record<EscalationStatus, string> = {
  pending:  'Pending',
  resolved: 'Resolved',
}

function isStatus(v: string | null): v is EscalationStatus {
  return v === 'pending' || v === 'resolved'
}

interface FilterPillProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function FilterPill({ active, onClick, children }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

interface EscalationAnswerFormProps {
  escalation: EscalationItem
  onCancel: () => void
}

function EscalationAnswerForm({ escalation, onCancel }: EscalationAnswerFormProps) {
  const [answer, setAnswer] = useState('')
  const qc = useQueryClient()

  // Reset draft when switching between escalations.
  useEffect(() => {
    setAnswer('')
  }, [escalation.id])

  const resolve = useMutation({
    mutationFn: (ans: string) =>
      apiClient.post(`/admin/escalations/${escalation.id}/resolve`, { answer: ans }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['escalations'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
      qc.invalidateQueries({ queryKey: keys.knowledge })
      setAnswer('')
      onCancel()
      toast.success('Escalation resolved')
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to resolve escalation. Try again.'
      toast.error(message)
    },
  })

  return (
    <div className="flex flex-col gap-3 pt-2">
      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer here…"
        className="min-h-28 resize-none"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={resolve.isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => resolve.mutate(answer)}
          disabled={!answer.trim() || resolve.isPending}
        >
          {resolve.isPending ? 'Saving…' : 'Save Answer'}
        </Button>
      </div>
    </div>
  )
}

export default function EscalationsPage() {
  const [params, setParams] = useSearchParams()
  const status: EscalationStatus = isStatus(params.get('status')) ? (params.get('status') as EscalationStatus) : 'pending'
  const selectedId = params.get('escalation')

  function setStatus(s: EscalationStatus) {
    const next = new URLSearchParams(params)
    next.set('status', s)
    next.delete('escalation')
    setParams(next, { replace: true })
  }

  function toggleExpanded(id: string) {
    const next = new URLSearchParams(params)
    if (selectedId === id) next.delete('escalation')
    else next.set('escalation', id)
    setParams(next, { replace: true })
  }

  const { data, isLoading } = useQuery({
    queryKey: keys.escalations(status),
    queryFn: () => fetchers.escalations(status),
  })

  const escalations = data ?? []

  return (
    <PageContainer size="md" className="flex flex-col flex-1">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Escalations</h1>
        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <FilterPill key={s} active={status === s} onClick={() => setStatus(s)}>
              {STATUS_LABEL[s]}
            </FilterPill>
          ))}
        </div>
      </div>

      {!isLoading && escalations.length === 0 && (
        <EmptyState
          icon={Inbox}
          title={status === 'pending' ? 'No pending escalations' : 'No resolved escalations'}
          description={
            status === 'pending'
              ? 'When the AI does not know how to answer something, it will appear here for you to resolve.'
              : 'Resolved escalations will appear here once you answer them.'
          }
        />
      )}

      {!isLoading && escalations.length > 0 && (
        <Card className="overflow-hidden p-0">
          <ul className="flex flex-col divide-y divide-border">
            {escalations.map((e: EscalationItem) => {
              const expanded = selectedId === e.id
              return (
                <li key={e.id}>
                  <button
                    onClick={() => toggleExpanded(e.id)}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted cursor-pointer"
                    aria-expanded={expanded}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-foreground leading-snug">
                        {e.question}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatPhone(e.callerPhone)} · {formatDate(e.createdAt)}
                      </p>
                    </div>
                    <ChevronRight
                      className={cn(
                        'size-4 shrink-0 text-muted-foreground transition-transform',
                        expanded && 'rotate-90',
                      )}
                    />
                  </button>

                  {expanded && (
                    <div className="border-t border-border/40 bg-muted/40 px-5 py-4">
                      {e.status === 'resolved' && e.answer ? (
                        <div className="rounded-lg border border-border bg-card p-4">
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                            Answer
                          </p>
                          <p className="text-sm leading-normal text-foreground whitespace-pre-wrap">
                            {e.answer}
                          </p>
                        </div>
                      ) : (
                        <EscalationAnswerForm
                          escalation={e}
                          onCancel={() => toggleExpanded(e.id)}
                        />
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </PageContainer>
  )
}
