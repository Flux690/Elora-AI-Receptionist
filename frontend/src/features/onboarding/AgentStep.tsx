import type { AgentProfile } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from './Field'

interface AgentField {
  key: keyof AgentProfile
  label: string
  help: string
}

const FIELDS: AgentField[] = [
  { key: 'name', label: 'Agent name', help: 'What it calls itself when it answers a call.' },
  { key: 'greeting', label: 'Greeting', help: 'The first thing it says once a call connects.' },
  { key: 'farewell', label: 'Farewell', help: 'What it says as a call ends normally.' },
  {
    key: 'fallback',
    label: 'If it cannot answer',
    help: 'Said before the question is handed to you.',
  },
]

interface AgentStepProps {
  data: AgentProfile
  onChange: (data: AgentProfile) => void
  onNext: () => void
  onBack: () => void
}

export function AgentStep({ data, onChange, onNext, onBack }: AgentStepProps) {
  return (
    <div className="flex flex-col gap-5">
      {FIELDS.map((f) => (
        <Field key={f.key} label={f.label} help={f.help} htmlFor={`agent-${f.key}`} required>
          <Input
            id={`agent-${f.key}`}
            value={data[f.key]}
            onChange={(e) => onChange({ ...data, [f.key]: e.target.value })}
            className="w-full"
          />
        </Field>
      ))}

      <div className="mt-1 flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={onNext} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  )
}
