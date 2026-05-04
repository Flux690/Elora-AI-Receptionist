import { Fragment, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { keys, fetchers } from '@/lib/queries'
import { apiClient } from '@/lib/apiClient'

function formatPhone(raw: string | null): string {
  if (!raw) return 'Private number'
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function Inbox() {
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const { data: pending = [], isLoading: loadingPending } = useQuery({
    queryKey: keys.escalations('pending'),
    queryFn: () => fetchers.escalations('pending'),
  })

  const { data: answered = [], isLoading: loadingAnswered } = useQuery({
    queryKey: keys.knowledge,
    queryFn: fetchers.knowledge,
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: string }) =>
      apiClient.post(`/admin/escalations/${id}/resolve`, { answer }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.escalations('pending') })
      queryClient.invalidateQueries({ queryKey: keys.knowledge })
      queryClient.invalidateQueries({ queryKey: keys.metrics })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/admin/knowledge/${id}`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.knowledge })
    },
  })

  function handleSubmit(id: string) {
    const answer = answers[id]?.trim()
    if (!answer) return
    resolveMutation.mutate({ id, answer }, {
      onSuccess: () => {
        setExpandedId(null)
        setAnswers(prev => { const n = { ...prev }; delete n[id]; return n })
      },
    })
  }

  return (
    <div className="p-8">
      <h1 className="font-heading text-2xl font-semibold mb-6">Inbox</h1>

      <Tabs defaultValue="pending">
        <TabsList className="mb-6">
          <TabsTrigger value="pending">
            Pending
            {pending.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{pending.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="answered">Answered</TabsTrigger>
        </TabsList>

        {/* Pending tab */}
        <TabsContent value="pending">
          <div className="rounded-lg border bg-card">
            {loadingPending && (
              <div className="text-center text-muted-foreground py-10">Loading…</div>
            )}
            {!loadingPending && pending.length === 0 && (
              <div className="text-center text-muted-foreground py-10">
                No pending questions — you're all caught up.
              </div>
            )}
            {pending.map(esc => (
              <Fragment key={esc.id}>
                <div className="flex items-start gap-4 px-5 py-4 border-b last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">{esc.question}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{formatPhone(esc.callerPhone)}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(esc.createdAt)}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedId(id => id === esc.id ? null : esc.id)}
                  >
                    {expandedId === esc.id ? 'Cancel' : 'Answer'}
                  </Button>
                </div>

                {expandedId === esc.id && (
                  <div className="px-5 py-4 bg-muted/40 border-b">
                    <Textarea
                      placeholder="Type the answer for the AI to remember…"
                      rows={3}
                      value={answers[esc.id] ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [esc.id]: e.target.value }))}
                      className="bg-background"
                    />
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={() => handleSubmit(esc.id)}
                        disabled={resolveMutation.isPending || !answers[esc.id]?.trim()}
                      >
                        {resolveMutation.isPending ? 'Saving…' : 'Save answer'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </TabsContent>

        {/* Answered tab — knowledge base */}
        <TabsContent value="answered">
          <div className="rounded-lg border bg-card">
            {loadingAnswered && (
              <div className="text-center text-muted-foreground py-10">Loading…</div>
            )}
            {!loadingAnswered && answered.length === 0 && (
              <div className="text-center text-muted-foreground py-10">
                No answered questions yet. Answer a pending question to build your knowledge base.
              </div>
            )}
            {answered.map(item => (
              <div key={item.id} className="px-5 py-4 border-b last:border-b-0">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium">{item.question}</p>
                    <p className="text-sm text-muted-foreground">{item.answer}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(item.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
