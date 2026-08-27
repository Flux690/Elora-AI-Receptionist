import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import type { KnowledgeItem } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PageContainer } from '@/layout/PageContainer'
import { PageHeader } from '@/layout/PageHeader'
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
      <PageHeader
        title="Knowledge"
        description="Answers your agent gives without asking you. Each one came from an escalation you resolved."
      />

      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No knowledge entries yet"
          description="Knowledge entries are added automatically when you answer escalations. The AI will use them to answer similar questions on future calls."
        />
      )}

      {!isLoading && items.length > 0 && (
        /* A list, not a table: these rows have no columns of comparable values,
           just an item and the one thing you can do to it. `<ul>` is the right
           element and no component is needed to get it. */
        <ul className="flex flex-col">
            {items.map((item: KnowledgeItem) => (
              <li
                key={item.id}
                className="group flex items-start gap-4 border-t border-border py-4 first:border-t-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug text-foreground">
                    {item.question}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.answer}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPendingDelete(item)}
                  disabled={del.isPending}
                  aria-label="Delete entry"
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
        </ul>
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
