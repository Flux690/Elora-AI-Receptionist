import { X } from 'lucide-react'
import type { ServiceItem } from '@receptionist/shared'
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

interface ServiceRowProps {
  service: ServiceItem
  onChange: (patch: Partial<ServiceItem>) => void
  onRemove: () => void
}

/**
 * Single service row used in BOTH Settings BusinessTab and Onboarding BusinessStep.
 *
 * Layout: name (full-width) → price (narrow with $ prefix) → description (full-width).
 * Three stacked rows. Description gets its own row so users can write
 * proper descriptions without cramming.
 */
export function ServiceRow({ service, onChange, onRemove }: ServiceRowProps) {
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
    </div>
  )
}
