import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/apiClient'
import type { Vertical } from '@/types/api'

const TIMEZONES = Intl.supportedValuesOf('timeZone')

const VERTICALS: { value: Vertical; label: string }[] = [
  { value: 'salon', label: 'Salon' },
  { value: 'spa', label: 'Spa' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'home_service', label: 'Home Service' },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user } = useUser()

  const [step, setStep] = useState<1 | 2>(1)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [vertical, setVertical] = useState<Vertical>('salon')
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone
  )

  async function submit(payload: { name: string; vertical: Vertical; timezone: string }) {
    setSubmitting(true)
    try {
      await apiClient.patch('/onboarding', payload)
      await user?.reload()
      navigate('/')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSkip() {
    submit({
      name: '',
      vertical: 'salon',
      timezone,
    })
  }

  function handleStep1Next() {
    setStep(2)
  }

  function handleStep2Submit() {
    submit({ name, vertical, timezone })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">

        {/* Header */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Step {step} of 2
          </p>
          <h1 className="font-heading text-2xl font-semibold">
            {step === 1 ? "Tell us about your business" : "Where are you located?"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === 1
              ? "This helps the AI introduce itself correctly to callers."
              : "Used for scheduling and showing the right times to callers."}
          </p>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Business Name</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Bloom Day Spa"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vertical">Business Type</Label>
              <Select value={vertical} onValueChange={v => setVertical(v as Vertical)}>
                <SelectTrigger id="vertical">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VERTICALS.map(v => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleStep1Next} className="flex-1">
                Continue
              </Button>
              <Button variant="ghost" onClick={handleSkip} disabled={submitting}>
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={v => setTimezone(v ?? '')}>
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleStep2Submit} disabled={submitting} className="flex-1">
                {submitting ? 'Setting up…' : 'Finish setup'}
              </Button>
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
