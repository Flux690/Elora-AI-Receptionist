import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface Props {
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
}

export default function BusinessProfileForm({ value, onChange }: Props) {
  const [raw, setRaw] = useState(() => JSON.stringify(value, null, 2))
  const [error, setError] = useState<string | null>(null)

  function handleChange(text: string) {
    setRaw(text)
    try {
      const parsed = JSON.parse(text)
      setError(null)
      onChange(parsed)
    } catch {
      setError('Invalid JSON')
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="business-profile">Business Profile (JSON)</Label>
      <Textarea
        id="business-profile"
        rows={8}
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        className="font-mono text-xs"
        placeholder="{}"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
