import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { INDUSTRIES, OTHER, isCustomIndustry } from '@/lib/industries'

/**
 * "Something else" becomes the box in the pill's own slot. What is stored is what
 * was typed: `agents.industry` reaches the system prompt verbatim.
 */
export function IndustryPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  /** Separate from the value: an empty value cannot tell "nothing chosen" from
   *  "still typing". */
  const [typing, setTyping] = useState(() => isCustomIndustry(value))

  /** The pressed pill leaves the document, so focus needs somewhere to go.
   *  Not `autoFocus`, which would fire on mount and steal it from the form. */
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
