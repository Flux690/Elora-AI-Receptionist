import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { disclosureFor, type AgentProfile } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { apiClient } from '@/lib/apiClient'
import { keys } from '@/lib/queries'
import type { AppSettings } from '@/lib/settings-types'
import { Section, Field } from './Section'

interface PhraseField {
  field: keyof AgentProfile
  label: string
  help: string
}

/** The three moments that repeat on every call. */
const PHRASES: PhraseField[] = [
  { field: 'greeting', label: 'Greeting', help: 'Said right after the disclosure above.' },
  { field: 'farewell', label: 'Farewell', help: 'Said when ending a call normally.' },
  {
    field: 'fallback',
    label: "When it doesn't know",
    help: 'Said before the question is passed to you. It lands in Escalations.',
  },
]

export function AgentTab({ settings }: { settings: AppSettings }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<AgentProfile>(settings.agent)
  const [recordCalls, setRecordCalls] = useState(settings.business.recordCalls)

  const save = useMutation({
    mutationFn: () => apiClient.patch('/admin/settings', { agent: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.settings })
      toast.success('Agent profile saved')
    },
    onError: () => toast.error('Failed to save agent profile'),
  })

  /**
   * Saves on the flip rather than waiting for a button.
   *
   * A switch reads as taking effect when it moves, and the only Save on this tab
   * sits two sections below in the phrases block — so a switch wired to it would
   * look applied while it wasn't. It is also one boolean, independently valid,
   * which is exactly the case where committing immediately is safe.
   */
  const saveRecording = useMutation({
    mutationFn: (next: boolean) =>
      apiClient.patch('/admin/settings', { business: { recordCalls: next } }),
    onSuccess: (_data, next) => {
      qc.invalidateQueries({ queryKey: keys.settings })
      toast.success(next ? 'Calls will be recorded' : 'Calls will no longer be recorded')
    },
    onError: (_err, next) => {
      // Put the switch back where it was, or it claims a state the server rejected.
      setRecordCalls(!next)
      toast.error('Could not change the recording setting. Try again.')
    },
  })

  // What this tenant's callers actually hear, derived from the same function the
  // agent uses. It was a hardcoded copy kept in step by hand — with two wordings
  // that would have been two strings to keep in step, and a dashboard quietly
  // showing the wrong one is how an owner ends up surprised by their own calls.
  const disclosure = disclosureFor(recordCalls).text

  return (
    <div>
      <Section
        title="Disclosure"
        lede="Required by law in several states, so it cannot be edited or removed."
      >
        <p className="border-l-2 border-input pl-3 text-sm leading-relaxed text-secondary-foreground">
          &ldquo;{disclosure}&rdquo;
        </p>
        <p className="text-sm text-muted-foreground">
          Your greeting is said straight after it.
        </p>

        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <span id="record-calls-label" className="text-sm font-medium text-foreground">
              Record calls
            </span>
            <p className="mt-px text-sm text-muted-foreground">
              Recordings are kept with each call so you can listen back. Turn this
              off and the sentence above stops mentioning it.
            </p>
          </div>
          <Switch
            checked={recordCalls}
            onCheckedChange={(next) => {
              setRecordCalls(next)
              saveRecording.mutate(next)
            }}
            disabled={saveRecording.isPending}
            aria-labelledby="record-calls-label"
            className="mt-0.5 shrink-0"
          />
        </div>
      </Section>

      <Section>
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
        layout="gutter"
        title="Phrases"
        lede="What it says at the three moments that repeat on every call."
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
