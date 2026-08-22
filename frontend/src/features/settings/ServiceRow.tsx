import { X } from 'lucide-react'
import type { ServiceDraft } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface PriceInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * Input with a non-editable "$" adornment baked in.
 * User types the numeric portion only.
 */
export function PriceInput({ value, onChange, className }: PriceInputProps) {
  return (
    <div className={cn('relative w-36', className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        $
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        inputMode="decimal"
        className="pl-7"
      />
    </div>
  )
}

interface MinutesInputProps {
  id?: string
  value: number
  onChange: (value: number) => void
}

/**
 * Whole minutes, with the unit shown rather than left to a placeholder.
 *
 * Empty parses to 0 instead of NaN — a half-typed field should not put the
 * form into a state that fails validation with an incomprehensible message.
 */
function MinutesInput({ id, value, onChange }: MinutesInputProps) {
  return (
    <div className="relative">
      <Input
        id={id}
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
        inputMode="numeric"
        className="pr-12"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        min
      </span>
    </div>
  )
}

interface ServiceRowProps {
  service: ServiceDraft
  onChange: (patch: Partial<ServiceDraft>) => void
  onRemove: () => void
  /**
   * Onboarding collects name, price and length only. Padding is a refinement
   * nobody can answer sensibly before they have taken a single booking, and
   * three extra fields per service is how a setup form starts feeling like tax
   * paperwork.
   */
  showBuffers?: boolean
}

/**
 * A single service, used in both Settings and Onboarding.
 *
 * Length is the field that makes booking correct: without it every appointment
 * was assumed to take an hour, so a two-hour colour and a fifteen-minute fringe
 * trim blocked exactly the same slot.
 */
export function ServiceRow({
  service,
  onChange,
  onRemove,
  showBuffers = false,
}: ServiceRowProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Service
        </Label>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label="Remove service"
          type="button"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          value={service.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Service name"
          className="flex-1"
        />
        <PriceInput value={service.price} onChange={(price) => onChange({ price })} />
      </div>

      <Input
        value={service.description ?? ''}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Description (optional)"
      />

      <div className={cn('grid gap-3', showBuffers ? 'grid-cols-3' : 'grid-cols-1')}>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">How long it takes</Label>
          <MinutesInput
            value={service.durationMinutes}
            onChange={(durationMinutes) => onChange({ durationMinutes })}
          />
        </div>

        {showBuffers && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Setup before</Label>
              <MinutesInput
                value={service.bufferBeforeMinutes}
                onChange={(bufferBeforeMinutes) => onChange({ bufferBeforeMinutes })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cleanup after</Label>
              <MinutesInput
                value={service.bufferAfterMinutes}
                onChange={(bufferAfterMinutes) => onChange({ bufferAfterMinutes })}
              />
            </div>
          </>
        )}
      </div>

      {showBuffers && (
        <p className="text-xs text-muted-foreground">
          Setup and cleanup block your calendar but are never mentioned to the caller.
        </p>
      )}
    </div>
  )
}

/** A new service, with the defaults the backend would apply anyway. */
export const emptyService = (): ServiceDraft => ({
  name: '',
  price: '',
  description: '',
  durationMinutes: 60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  requiredResources: [],
})
