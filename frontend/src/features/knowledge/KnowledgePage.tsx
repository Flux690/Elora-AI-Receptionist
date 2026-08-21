import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import type { KnowledgeItem } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PageContainer } from '@/layout/PageContainer'
import { EmptyState } from '@/layout/EmptyState'
import { keys, fetchers } from '@/lib/queries'
import { apiClient } from '@/lib/apiClient'

export default function KnowledgePage() {
  const qc = useQueryClient()
  const [pendingDelete, setPendingDelete] = useState<KnowledgeItem | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: keys.knowledge,
    queryFn: fetchers.knowledge,
  })

  const del = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/knowledge/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.knowledge })
      toast.success('Knowledge entry deleted')
    },
    onError: () => toast.error('Failed to delete entry'),
  })

  const items = data ?? []

  return (
    <PageContainer size="page" className="flex flex-col flex-1">
      <div className="text-sm text-muted-foreground">Knowledge</div>
      <h1 className="mt-4 mb-2 text-xl font-semibold tracking-tight text-foreground">
        What your agent knows
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Every answer here came from an escalation you resolved. Delete one and
        that question gets escalated again next time it comes up.
      </p>

      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No knowledge entries yet"
          description="Knowledge entries are added automatically when you answer escalations. The AI will use them to answer similar questions on future calls."
        />
      )}

      {!isLoading && items.length > 0 && (
        <div className="flex flex-col gap-2">
            {items.map((item: KnowledgeItem) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-input bg-card p-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug text-foreground">
                    {item.question}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.answer}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPendingDelete(item)}
                  disabled={del.isPending}
                  aria-label="Delete entry"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title="Delete knowledge entry?"
        description="This entry will no longer be used by the AI to answer caller questions. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return
          await del.mutateAsync(pendingDelete.id)
        }}
      />
    </PageContainer>
  )
}
