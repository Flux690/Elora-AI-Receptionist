import { Plus } from 'lucide-react'
import type { ServiceItem } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ServiceRow } from '@/features/settings/ServiceRow'

const INDUSTRIES = [
  'Hair Salon',
  'Day Spa',
  'Barbershop',
  'Nail Salon',
  'Medical Clinic',
  'Dental Practice',
  'Chiropractic',
  'Fitness Studio',
  'Massage Therapy',
  'Aesthetic Clinic',
  'Other',
]

export interface BusinessStepData {
  name: string
  industry: string
  description: string
  services: ServiceItem[]
}

interface BusinessStepProps {
  data: BusinessStepData
  onChange: (data: BusinessStepData) => void
  onNext: () => void
}

export function BusinessStep({ data, onChange, onNext }: BusinessStepProps) {
  const canAdvance = data.name.trim().length > 0 && data.industry.length > 0

  function updateService(i: number, patch: Partial<ServiceItem>) {
    onChange({
      ...data,
      services: data.services.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    })
  }

  function removeService(i: number) {
    onChange({ ...data, services: data.services.filter((_, idx) => idx !== i) })
  }

  function addService() {
    onChange({
      ...data,
      services: [...data.services, { name: '', price: '', description: '' }],
    })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="biz-name">
          Business name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="biz-name"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="e.g. Luxe Hair Studio"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="industry">
          Industry <span className="text-destructive">*</span>
        </Label>
        <Select
          value={data.industry}
          onValueChange={(v) => onChange({ ...data, industry: v ?? '' })}
        >
          <SelectTrigger id="industry" className="w-full">
            <SelectValue placeholder="Select your industry" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((ind) => (
              <SelectItem key={ind} value={ind}>
                {ind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="Brief overview of your business, specialties, or anything callers should know"
          rows={3}
          className="resize-none"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Services</Label>
          <Button variant="ghost" size="sm" type="button" onClick={addService}>
            <Plus className="size-3.5" />
            Add service
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Add your main services so the AI can inform callers about pricing.
        </p>
        <div className="flex flex-col gap-3">
          {data.services.map((svc, i) => (
            <ServiceRow
              key={i}
              service={svc}
              onChange={(patch) => updateService(i, patch)}
              onRemove={() => removeService(i)}
            />
          ))}
        </div>
      </div>

      <div className="pt-2">
        <Button disabled={!canAdvance} onClick={onNext} className="w-full">
          Continue
        </Button>
      </div>
    </div>
  )
}
