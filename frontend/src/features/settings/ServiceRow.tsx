import { X } from 'lucide-react'
import type { ServiceDraft } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** The one place the column widths are stated. Captions and rows share it. */
export const SERVICE_GRID = 'grid grid-cols-[1fr_92px_76px_76px_76px_28px] items-center gap-2'

interface MinutesInputProps {
  value: number
  onChange: (value: number) => void
  label: string
}

/**
 * Whole minutes. Empty parses to 0 rather than NaN, so a half-typed field does
 * not put the form into a state that fails validation with no explanation.
 */
function MinutesInput({ value, onChange, label }: MinutesInputProps) {
  return (
    <Input
      value={String(value)}
      onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
      inputMode="numeric"
      aria-label={label}
      className="text-right tabular-nums"
    />
  )
}

/**
 * Column captions, said once above the rows.
 *
 * The unit lives here rather than in every cell: five rows of "30 min" repeats
 * the word four times more than it needs saying.
 */
export function ServiceCaptions() {
  return (
    <div className={cn(SERVICE_GRID, 'pb-2 text-sm text-muted-foreground')}>
      <span>Service</span>
      <span>Price</span>
      <span className="text-right">Takes</span>
      <span className="text-right">Setup</span>
      <span className="text-right">Cleanup</span>
      <span />
    </div>
  )
}

interface ServiceRowProps {
  service: ServiceDraft
  onChange: (patch: Partial<ServiceDraft>) => void
  onRemove: () => void
}

/**
 * One service, as a row in a table.
 *
 * This used to be a bordered card per service, stacking name and price on one
 * line and three numbers on another. Five services meant five boxes and ten
 * rows, and no two values in the same column ever lined up — which is the whole
 * reason to have columns. A service is a record in a list, not an object with
 * its own surface.
 */
export function ServiceRow({ service, onChange, onRemove }: ServiceRowProps) {
  return (
    <div className={cn(SERVICE_GRID, 'py-1')}>
      <Input
        value={service.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Service name"
        aria-label="Service name"
      />
      <Input
        value={service.price}
        onChange={(e) => onChange({ price: e.target.value })}
        placeholder="$0"
        aria-label="Price"
        className="tabular-nums"
      />
      <MinutesInput
        label="Minutes it takes"
        value={service.durationMinutes}
        onChange={(durationMinutes) => onChange({ durationMinutes })}
      />
      <MinutesInput
        label="Setup minutes before"
        value={service.bufferBeforeMinutes}
        onChange={(bufferBeforeMinutes) => onChange({ bufferBeforeMinutes })}
      />
      <MinutesInput
        label="Cleanup minutes after"
        value={service.bufferAfterMinutes}
        onChange={(bufferAfterMinutes) => onChange({ bufferAfterMinutes })}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        aria-label={`Remove ${service.name || 'service'}`}
        type="button"
        className="text-muted-foreground hover:text-destructive"
      >
        <X className="size-4" />
      </Button>
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
