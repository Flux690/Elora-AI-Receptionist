import { Info } from 'lucide-react'
import type { AgentProfile } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface AgentField {
  key: keyof AgentProfile
  label: string
  hint: string
}

const FIELDS: AgentField[] = [
  { key: 'name',       label: 'Agent name',      hint: 'What the AI introduces itself as when answering calls.' },
  { key: 'greeting',   label: 'Greeting',         hint: 'Said verbatim when a call is answered.' },
  { key: 'farewell',   label: 'Farewell',         hint: 'Said when ending the call normally.' },
  { key: 'fallback',   label: 'Fallback message', hint: 'Used when the AI does not know how to respond.' },
  { key: 'holdPhrase', label: 'Hold phrase',      hint: 'Said while the AI is searching for information.' },
]

interface AgentStepProps {
  data: AgentProfile
  onChange: (data: AgentProfile) => void
  onNext: () => void
  onBack: () => void
}

export function AgentStep({ data, onChange, onNext, onBack }: AgentStepProps) {
  return (
    <div className="space-y-5">
      {FIELDS.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={`agent-${f.key}`}>
              {f.label} <span className="text-destructive">*</span>
            </Label>
            <Tooltip>
              <TooltipTrigger>
                <Info className="size-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>{f.hint}</TooltipContent>
            </Tooltip>
          </div>
          <Input
            id={`agent-${f.key}`}
            value={data[f.key]}
            onChange={(e) => onChange({ ...data, [f.key]: e.target.value })}
          />
        </div>
      ))}

      <div className="flex gap-3 pt-2">
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
