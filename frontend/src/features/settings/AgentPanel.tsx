import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { disclosureFor, type AgentProfile } from '@receptionist/shared'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { apiClient } from '@/lib/apiClient'
import { keys } from '@/lib/queries'
import type { AppSettings } from '@/lib/settings-types'
import { Section, Row } from './SettingsList'
import { SaveBar } from './SaveBar'
import { useServerSeed } from './useServerSeed'

interface Phrase {
  field: keyof AgentProfile
  title: string
  description: string
}

const PHRASES: Phrase[] = [
  {
    field: 'greeting',
    title: 'Greeting',
    description: 'Your agent opens every call with this.',
  },
  {
    field: 'farewell',
    title: 'Farewell',
    description: 'How your agent signs off when a call ends normally.',
  },
  {
    field: 'fallback',
    title: 'When your agent cannot answer',
    description: 'Said before the question is passed to you in Escalations.',
  },
]

export function AgentPanel({ settings }: { settings: AppSettings }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<AgentProfile>(settings.agent)
  const [recordCalls, setRecordCalls] = useState(settings.business.recordCalls)

  const changes = useMemo(() => {
    const out: string[] = []
    if (form.name !== settings.agent.name) out.push('agent name')
    const phrases = PHRASES.filter((p) => form[p.field] !== settings.agent[p.field]).length
    if (phrases > 0) out.push(`${phrases} ${phrases === 1 ? 'phrase' : 'phrases'}`)
    return out
  }, [form, settings.agent])

  /* A save re-seeds. A background refetch must not: the recording switch below
     invalidates this very query, and that used to discard an unsaved phrase. */
  const expectReseed = useServerSeed(settings, changes.length > 0, () => {
    setForm(settings.agent)
    setRecordCalls(settings.business.recordCalls)
  })

  const save = useMutation({
    mutationFn: () => apiClient.patch('/admin/settings', { agent: form }),
    onSuccess: async () => {
      expectReseed()
      await qc.invalidateQueries({ queryKey: keys.settings })
      toast.success('Agent saved')
    },
    onError: () => toast.error('Could not save. Try again.'),
  })

  /* A switch reads as taking effect when it moves, and this one is a single
     boolean that is valid on its own, so it commits immediately rather than
     waiting for the bar. */
  const saveRecording = useMutation({
    mutationFn: (next: boolean) =>
      apiClient.patch('/admin/settings', { business: { recordCalls: next } }),
    onSuccess: (_data, next) => {
      qc.invalidateQueries({ queryKey: keys.settings })
      toast.success(next ? 'Calls are recorded' : 'Calls are no longer recorded')
    },
    onError: (_err, next) => {
      setRecordCalls(!next)
      toast.error('Could not change that. Try again.')
    },
  })

  /* Derived from the same function the agent uses, so the dashboard cannot show
     a wording a caller never hears. */
  const disclosure = disclosureFor(recordCalls).text

  return (
    <div>
      <Section
        title="What every caller hears first"
        lede="Required by law, so we write it and it cannot be turned off."
      >
        <li className="p-4">
          <p className="leading-relaxed text-foreground">&ldquo;{disclosure}&rdquo;</p>
        </li>
      </Section>

      <Section title="Your agent">
        <Row
          title="Name"
          description="What your agent calls itself when it answers."
          htmlFor="agent-name"
        >
          <Input
            id="agent-name"
            className="w-field-sm"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Row>
        <Row
          title="Record calls"
          description="Keeps the audio, and tells callers the call is recorded."
        >
          <Switch
            checked={recordCalls}
            onCheckedChange={(next) => {
              setRecordCalls(next)
              saveRecording.mutate(next)
            }}
            disabled={saveRecording.isPending}
            aria-label="Record calls"
          />
        </Row>
      </Section>

      <Section
        title="What your agent says"
        lede="Write them the way you would say them out loud."
      >
        {PHRASES.map(({ field, title, description }) => (
          <Row
            key={field}
            title={title}
            description={description}
            htmlFor={`agent-${field}`}
            stacked
          >
            <Textarea
              id={`agent-${field}`}
              value={form[field]}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              className="min-h-[3lh] resize-none"
            />
          </Row>
        ))}
      </Section>

      <SaveBar
        changes={changes}
        saving={save.isPending}
        onSave={() => save.mutate()}
        onDiscard={() => setForm(settings.agent)}
      />
    </div>
  )
}
