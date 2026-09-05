import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { INDUSTRIES, OTHER, isCustomIndustry } from '@/lib/industries'

/**
 * Six buckets, and a box for everything else.
 *
 * The box appears in place of nothing — it opens under the picker only once
 * "Something else" is chosen, and what gets stored is what was typed. The value
 * is interpolated straight into the system prompt, so storing the sentinel would
 * tell the agent the business is in the Something Else industry.
 *
 * A row's control column is narrow, which is why this is a select rather than
 * the pill row onboarding uses for the same list. Same list, two shapes, each
 * matching what is around it.
 */
export function IndustryField({
  value,
  onChange,
  id,
}: {
  value: string
  onChange: (value: string) => void
  id?: string
}) {
  const custom = isCustomIndustry(value)

  return (
    <div className="flex flex-col items-end gap-2">
      <Select
        value={custom ? OTHER : value}
        onValueChange={(v) => {
          if (!v) return
          // Choosing the sentinel clears the field rather than storing the word,
          // so the box below opens empty and waiting.
          onChange(v === OTHER ? '' : v)
        }}
      >
        <SelectTrigger id={id} className="w-field-md">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          {INDUSTRIES.map((i) => (
            <SelectItem key={i} value={i}>
              {i}
            </SelectItem>
          ))}
          <SelectItem value={OTHER}>{OTHER}</SelectItem>
        </SelectContent>
      </Select>

      {(custom || value === '') && (
        <Input
          className="w-field-md"
          aria-label="Describe your business"
          placeholder="Dog grooming and boarding"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
