import { X } from 'lucide-react'
import type { ServiceDraft } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

/**
 * The one place the columns are stated.
 *
 * The unit lives in the heading rather than in every cell: five rows of "30 min"
 * repeats the word four times more than it needs saying.
 */
export const SERVICE_COLUMNS = [
  { label: 'Service', className: '' },
  { label: 'Price', className: 'w-[92px]' },
  { label: 'Takes', className: 'w-[76px] text-right' },
  { label: 'Setup', className: 'w-[76px] text-right' },
  { label: 'Cleanup', className: 'w-[76px] text-right' },
  { label: '', className: 'w-[28px]' },
]

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

/** Column captions, said once above the rows. */
export function ServiceCaptions() {
  return (
    <TableHeader className="[&_tr]:border-b-0">
      <TableRow className="border-b-0 hover:bg-transparent">
        {SERVICE_COLUMNS.map((c, i) => (
          <TableHead
            key={c.label || `spacer-${i}`}
            className={cn('h-auto px-0 pb-2 font-normal', c.className)}
          >
            {c.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
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
    <TableRow className="border-b-0 hover:bg-transparent">
      <TableCell className="px-0 py-1 pr-2">
        <Input
          value={service.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Service name"
          aria-label="Service name"
        />
      </TableCell>
      <TableCell className="px-0 py-1 pr-2">
        <Input
          value={service.price}
          onChange={(e) => onChange({ price: e.target.value })}
          placeholder="$0"
          aria-label="Price"
          className="tabular-nums"
        />
      </TableCell>
      <TableCell className="px-0 py-1 pr-2">
        <MinutesInput
          label="Minutes it takes"
          value={service.durationMinutes}
          onChange={(durationMinutes) => onChange({ durationMinutes })}
        />
      </TableCell>
      <TableCell className="px-0 py-1 pr-2">
        <MinutesInput
          label="Setup minutes before"
          value={service.bufferBeforeMinutes}
          onChange={(bufferBeforeMinutes) => onChange({ bufferBeforeMinutes })}
        />
      </TableCell>
      <TableCell className="px-0 py-1 pr-2">
        <MinutesInput
          label="Cleanup minutes after"
          value={service.bufferAfterMinutes}
          onChange={(bufferAfterMinutes) => onChange({ bufferAfterMinutes })}
        />
      </TableCell>
      <TableCell className="px-0 py-1">
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
      </TableCell>
    </TableRow>
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
