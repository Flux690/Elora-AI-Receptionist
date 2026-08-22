import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AgentProfile } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/apiClient'
import { keys } from '@/lib/queries'
import type { AppSettings } from '@/lib/settings-types'
import { Section, Field } from './Section'


/**
 * Kept in step with `backend/src/agent/disclosure.ts` by hand.
 *
 * Deliberately not served from the API: this is shown so the owner knows what
 * plays, not so anything can change it. If it drifts, the dashboard is wrong —
 * the call is still compliant, which is the failure direction to prefer.
 */
const AI_DISCLOSURE =
  "Just so you know, you're speaking with an AI assistant, and this call is recorded."

interface PhraseField {
  field: keyof AgentProfile
  label: string
  help: string
}

/** The four moments that repeat on every call. */
const PHRASES: PhraseField[] = [
  { field: 'greeting', label: 'Greeting', help: 'Said right after the disclosure above.' },
  { field: 'farewell', label: 'Farewell', help: 'Said when ending a call normally.' },
  {
    field: 'fallback',
    label: "When it doesn't know",
    help: 'Said before the question is passed to you. It lands in Escalations.',
  },
  {
    field: 'holdPhrase',
    label: 'While it looks something up',
    help: 'Fills the pause while it checks your calendar.',
  },
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
    <div>
      <Section
        title="Disclosure"
        lede="Required by law in several states, so it cannot be edited or removed."
      >
        <p className="border-l-2 border-input pl-3 text-sm leading-relaxed text-secondary-foreground">
          &ldquo;{AI_DISCLOSURE}&rdquo;
        </p>
        <p className="text-sm text-muted-foreground">
          Your greeting is said straight after it.
        </p>
      </Section>

      <Section title="Voice" lede="How your agent introduces itself on a call.">
        <Field label="Agent name" help="How it introduces itself." htmlFor="agent-name">
          <Input
            id="agent-name"
            className="w-52"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
      </Section>

      <Section
        title="Phrases"
        lede="What it says at the four moments that repeat on every call."
      >
        {PHRASES.map(({ field, label, help }) => (
          <Field key={field} label={label} help={help} htmlFor={`agent-${field}`}>
            <Input
              id={`agent-${field}`}
              value={form[field]}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
            />
          </Field>
        ))}
        <div className="flex justify-start pt-1">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </Section>
    </div>
  )
}
