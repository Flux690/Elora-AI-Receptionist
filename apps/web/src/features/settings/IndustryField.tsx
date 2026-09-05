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
 * A select rather than onboarding's pill row, because a settings row's control
 * column is narrow. What is stored is what was typed, never the sentinel.
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
