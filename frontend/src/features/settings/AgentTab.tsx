import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { toast } from 'sonner'
import type { AgentProfile } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { apiClient } from '@/lib/apiClient'
import { keys } from '@/lib/queries'
import type { AppSettings } from '@/lib/settings-types'

interface AgentField {
  field: keyof AgentProfile
  label: string
  hint: string
}

const FIELDS: AgentField[] = [
  { field: 'name',       label: 'Agent Name',  hint: 'How your agent introduces itself on calls' },
  { field: 'greeting',   label: 'Greeting',    hint: 'First thing the agent says when picking up a call' },
  { field: 'farewell',   label: 'Farewell',    hint: 'Closing message before ending a call' },
  { field: 'fallback',   label: 'Fallback',    hint: 'What the agent says when it cannot answer a question' },
  { field: 'holdPhrase', label: 'Hold Phrase', hint: 'Said while the agent is searching for information' },
]

export function AgentTab({ settings }: { settings: AppSettings }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<AgentProfile>(settings.agent)

  const save = useMutation({
    mutationFn: () => apiClient.patch('/admin/settings', { agent: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.settings })
      toast.success('Agent profile saved')
    },
    onError: () => toast.error('Failed to save agent profile'),
  })

  return (
    <div className="flex flex-col gap-5">
      {FIELDS.map(({ field, label, hint }) => (
        <div key={field} className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={`agent-${field}`}>{label}</Label>
            <Tooltip>
              <TooltipTrigger>
                <Info className="size-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>{hint}</TooltipContent>
            </Tooltip>
          </div>
          <Input
            id={`agent-${field}`}
            value={form[field]}
            onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
          />
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
