import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { INDUSTRIES, OTHER, isCustomIndustry } from '@/lib/industries'

/**
 * The six buckets as a row, with "Something else" turning into the box itself.
 *
 * The input takes the pill's own place in the row rather than opening a nested
 * block beneath it — same slot, same height, a cross to go back to the list.
 *
 * What gets stored is what was typed, never the sentinel: `tenants.industry` is
 * free text and goes into the system prompt verbatim, so saving the word "Other"
 * told the agent the business was in the Other industry.
 *
 * Settings uses a select for the same list, because a settings row's control
 * column is too narrow for seven pills. Same list, two shapes, each matching
 * what surrounds it.
 */
export function IndustryPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  /**
   * Whether the box is open, held separately from the value.
   *
   * An empty value cannot tell "nothing chosen yet" from "Something else, still
   * typing", and those want opposite things on screen. Seeded from the value so
   * the picker is right when it mounts against a business already describing
   * itself in its own words.
   */
  const [typing, setTyping] = useState(() => isCustomIndustry(value))

  /**
   * Move focus into the box when it replaces the pill.
   *
   * Not `autoFocus`, which fires on mount and would steal focus from the top of
   * the form on a page that already has one. The pill the user just pressed is
   * removed from the document, so without this their focus is dropped onto the
   * body and a keyboard user has to tab back in from the beginning.
   */
  const box = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (typing) box.current?.focus()
  }, [typing])

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      {INDUSTRIES.map((i) => (
        <Button
          key={i}
          type="button"
          size="sm"
          variant={value === i && !typing ? 'default' : 'outline'}
          onClick={() => {
            setTyping(false)
            onChange(i)
          }}
        >
          {i}
        </Button>
      ))}

      {typing ? (
        <span className="relative inline-flex">
          <Input
            className="h-7 w-field-md border-ring pr-8"
            aria-label="Describe your business"
            placeholder="Dog grooming and boarding"
            ref={box}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Choose from the list instead"
            className="absolute top-0 right-0 size-7"
            onClick={() => {
              setTyping(false)
              onChange('')
            }}
          >
            <X />
          </Button>
        </span>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setTyping(true)
            onChange('')
          }}
        >
          {OTHER}
        </Button>
      )}
    </div>
  )
}
