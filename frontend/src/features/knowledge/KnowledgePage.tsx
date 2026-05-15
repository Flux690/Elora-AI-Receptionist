import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import type { KnowledgeItem } from '@receptionist/shared'
import { Card } from '@/components/ui/card'
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
    <PageContainer size="md" className="flex flex-col flex-1">
      <h1 className="mb-6 text-lg font-semibold text-foreground">Knowledge</h1>

      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No knowledge entries yet"
          description="Knowledge entries are added automatically when you answer escalations. The AI will use them to answer similar questions on future calls."
        />
      )}

      {!isLoading && items.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col divide-y divide-border">
            {items.map((item: KnowledgeItem) => (
              <div key={item.id} className="flex items-start gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-foreground leading-snug">
                    {item.question}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
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
        </Card>
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
