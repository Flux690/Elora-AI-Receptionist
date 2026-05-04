import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/apiClient'
import { keys } from '@/lib/queries'
import type { Escalation } from '@/types/api'

interface Props {
  escalation: Escalation
  open: boolean
  onClose: () => void
}

export default function ResolveDialog({ escalation, open, onClose }: Props) {
  const [answer, setAnswer] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (ans: string) =>
      apiClient.post(`/admin/escalations/${escalation.id}/resolve`, { answer: ans }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.escalations('pending') })
      qc.invalidateQueries({ queryKey: keys.escalations('resolved') })
      setAnswer('')
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (answer.trim()) mutation.mutate(answer.trim())
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve Escalation</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{escalation.question}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="answer">Answer</Label>
            <Textarea
              id="answer"
              rows={4}
              placeholder="Write the answer for this question…"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!answer.trim() || mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save answer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
