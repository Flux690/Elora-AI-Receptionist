import { Plus, X } from 'lucide-react'
import type { ServiceDraft } from '@receptionist/shared'
import { emptyService } from '@/lib/service-defaults'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field } from './Field'

const INDUSTRIES = [
  'Hair salon',
  'Day spa',
  'Barbershop',
  'Nail salon',
  'Medical clinic',
  'Dental practice',
  'Chiropractic',
  'Fitness studio',
  'Massage therapy',
  'Aesthetic clinic',
  'Other',
]

export interface BusinessStepData {
  name: string
  industry: string
  description: string
  services: ServiceDraft[]
}

interface BusinessStepProps {
  data: BusinessStepData
  onChange: (data: BusinessStepData) => void
  onNext: () => void
}

export function BusinessStep({ data, onChange, onNext }: BusinessStepProps) {
  const canAdvance = data.name.trim().length > 0 && data.industry.length > 0

  function updateService(i: number, patch: Partial<ServiceDraft>) {
    onChange({
      ...data,
      services: data.services.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Business name"
        help="Your agent says this out loud when it answers."
        htmlFor="biz-name"
        required
      >
        <Input
          id="biz-name"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="Ardith Hair Co."
          className="w-full"
        />
      </Field>

      <Field label="Industry" help="Helps your agent describe what you do if a caller asks." htmlFor="industry" required>
        <Select
          value={data.industry}
          onValueChange={(v) => onChange({ ...data, industry: v ?? '' })}
        >
          <SelectTrigger id="industry" className="w-full">
            <SelectValue placeholder="Pick your industry" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((ind) => (
              <SelectItem key={ind} value={ind}>
                {ind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="Description"
        help="Anything a caller may ask that is not a service or an hour."
        htmlFor="description"
      >
        <Textarea
          id="description"
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="Parking, where to find you, how long you have been open."
          className="min-h-16 resize-none"
        />
      </Field>

      <div>
        <p className="font-medium text-foreground">Services</p>
        <p className="mt-0.5 mb-2 text-muted-foreground">
          Your agent quotes these and works out how long a booking takes. Setup and cleanup time
          come later in Settings.
        </p>

        <div className="flex flex-col gap-2">
          {data.services.map((svc, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={svc.name}
                onChange={(e) => updateService(i, { name: e.target.value })}
                placeholder="Service name"
                aria-label={`Service ${i + 1} name`}
                className="min-w-0 flex-1"
              />
              <Input
                value={svc.price}
                onChange={(e) => updateService(i, { price: e.target.value })}
                placeholder="Price"
                aria-label={`Service ${i + 1} price`}
                className="w-field-xs tabular-nums"
              />
              <Input
                value={String(svc.durationMinutes)}
                onChange={(e) =>
                  updateService(i, {
                    durationMinutes: Number(e.target.value.replace(/\D/g, '')) || 0,
                  })
                }
                inputMode="numeric"
                aria-label={`Service ${i + 1} length in minutes`}
                className="w-field-2xs text-right tabular-nums"
              />
              <span className="w-12 shrink-0 text-muted-foreground">min</span>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label={`Remove ${svc.name || 'this service'}`}
                onClick={() =>
                  onChange({ ...data, services: data.services.filter((_, idx) => idx !== i) })
                }
              >
                <X />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          type="button"
          className="mt-2"
          onClick={() => onChange({ ...data, services: [...data.services, emptyService()] })}
        >
          <Plus />
          Add service
        </Button>
      </div>

      <Button disabled={!canAdvance} onClick={onNext} className="mt-1 w-full">
        Continue
      </Button>
    </div>
  )
}
