import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/react'
import { apiClient } from '@/lib/apiClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AvailableNumber, ServiceItem, AgentProfile } from '@/types/api'


// Helpers

function formatE164(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return e164
}


// Constants

const INDUSTRIES = [
  'Hair Salon',
  'Day Spa',
  'Barbershop',
  'Nail Salon',
  'Medical Clinic',
  'Dental Practice',
  'Chiropractic',
  'Fitness Studio',
  'Massage Therapy',
  'Aesthetic Clinic',
  'Other',
]

const DEFAULT_AREA_CODE = '415'


// Progress indicator

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Business' },
    { n: 2, label: 'Agent' },
    { n: 3, label: 'Phone' },
  ] as const

  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((s, i) => {
        const done = current > s.n
        const active = current === s.n
        return (
          <div key={s.n} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-8 h-8 rounded-pill flex items-center justify-center text-sm font-semibold transition-colors duration-200"
                style={{
                  backgroundColor: done || active ? 'var(--color-accent)' : 'var(--color-bg-surface)',
                  color: done || active ? '#FFFFFF' : 'var(--color-text-2)',
                  border: done || active ? 'none' : '1.5px solid var(--color-border)',
                }}
              >
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : s.n}
              </div>
              <span
                className="text-xs font-medium"
                style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-2)' }}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-px w-16 mx-2 mb-5 transition-colors duration-200"
                style={{ backgroundColor: current > s.n ? 'var(--color-accent)' : 'var(--color-border)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}


// Service rows

function ServiceRows({
  services,
  onChange,
}: {
  services: ServiceItem[]
  onChange: (s: ServiceItem[]) => void
}) {
  function updateRow(i: number, patch: Partial<ServiceItem>) {
    const next = [...services]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  function addRow() {
    onChange([...services, { name: '', price: '', description: '' }])
  }

  function removeRow(i: number) {
    onChange(services.filter((_, j) => j !== i))
  }

  return (
    <div className="space-y-3">
      {services.map((svc, i) => (
        <div key={i} className="space-y-1.5 rounded-card p-3" style={{ backgroundColor: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Service name"
              value={svc.name}
              onChange={e => updateRow(i, { name: e.target.value })}
              className="flex-1 min-w-0"
            />
            <Input
              placeholder="Price"
              value={svc.price}
              onChange={e => updateRow(i, { price: e.target.value })}
              className="w-24 shrink-0"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="shrink-0 transition-colors duration-200"
              style={{ color: 'var(--color-text-3)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-status-escalated)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-3)')}
              aria-label="Remove service"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <Input
            placeholder="Description (optional)"
            value={svc.description ?? ''}
            onChange={e => updateRow(i, { description: e.target.value })}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-sm font-medium transition-colors duration-200"
        style={{ color: 'var(--color-accent)' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Add service
      </button>
    </div>
  )
}


interface Step1Data {
  name: string
  industry: string
  description: string
  services: ServiceItem[]
}

// Step 1 — Business

function Step1({
  data,
  onChange,
  onNext,
}: {
  data: Step1Data
  onChange: (d: Step1Data) => void
  onNext: () => void
}) {
  const canAdvance = data.name.trim().length > 0 && data.industry.length > 0

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="biz-name">
          Business name <span style={{ color: 'var(--color-status-escalated)' }}>*</span>
        </Label>
        <Input
          id="biz-name"
          value={data.name}
          onChange={e => onChange({ ...data, name: e.target.value })}
          placeholder="e.g. Luxe Hair Studio"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="industry">
          Industry <span style={{ color: 'var(--color-status-escalated)' }}>*</span>
        </Label>
        <Select value={data.industry} onValueChange={v => onChange({ ...data, industry: v ?? '' })}>
          <SelectTrigger id="industry" className="w-full">
            <SelectValue placeholder="Select your industry" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map(ind => (
              <SelectItem key={ind} value={ind}>{ind}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={data.description}
          onChange={e => onChange({ ...data, description: e.target.value })}
          placeholder="Brief overview of your business, specialties, or anything callers should know"
          rows={3}
          className="resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Services</Label>
        <p className="text-sm" style={{ color: 'var(--color-text-2)' }}>
          Add your main services so the AI can inform callers about pricing.
        </p>
        <ServiceRows
          services={data.services}
          onChange={services => onChange({ ...data, services })}
        />
      </div>

      <Button
        className="w-full mt-2"
        disabled={!canAdvance}
        onClick={onNext}
      >
        Continue
      </Button>
    </div>
  )
}


// Step 2 — Agent profile

function Step2({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: AgentProfile
  onChange: (d: AgentProfile) => void
  onNext: () => void
  onBack: () => void
}) {
  const fields: { key: keyof AgentProfile; label: string; hint: string }[] = [
    {
      key: 'name',
      label: 'Agent name',
      hint: 'What the AI introduces itself as when answering calls.',
    },
    {
      key: 'greeting',
      label: 'Greeting',
      hint: 'Said verbatim when a call is answered.',
    },
    {
      key: 'farewell',
      label: 'Farewell',
      hint: 'Said when ending the call normally.',
    },
    {
      key: 'fallback',
      label: 'Fallback message',
      hint: "Used when the AI does not know how to respond.",
    },
    {
      key: 'holdPhrase',
      label: 'Hold phrase',
      hint: 'Said while the AI is searching for information.',
    },
  ]

  return (
    <div className="space-y-5">
      {fields.map(f => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={`agent-${f.key}`}>{f.label}</Label>
          <Input
            id={`agent-${f.key}`}
            value={data[f.key]}
            onChange={e => onChange({ ...data, [f.key]: e.target.value })}
          />
          <p className="text-xs" style={{ color: 'var(--color-text-2)' }}>{f.hint}</p>
        </div>
      ))}

      <div className="flex gap-3 mt-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={onNext} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  )
}


type PhonePhase = 'loading' | 'number' | 'searching' | 'selected'

// Step 3 — Phone

function Step3({
  onBack,
  onSelect,
}: {
  onBack: () => void
  onSelect: (e164: string) => void
}) {
  const [phase, setPhase] = useState<PhonePhase>('loading')
  const [currentNumber, setCurrentNumber] = useState<AvailableNumber | null>(null)
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null)
  const [areaCode, setAreaCode] = useState(DEFAULT_AREA_CODE)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const fetchNumber = useCallback(async (code: string) => {
    setSearching(true)
    setSearchError(null)
    try {
      const res = await apiClient.get<AvailableNumber[]>(`/onboarding/phone/search?areaCode=${code}`)
      if (res.data.length > 0) {
        setCurrentNumber(res.data[0])
        setPhase('number')
      } else {
        setSearchError('No numbers available for this area code.')
        setPhase('number')
      }
    } catch {
      setSearchError('Could not fetch numbers. Try a different area code.')
      setPhase('number')
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    fetchNumber(DEFAULT_AREA_CODE)
  }, [fetchNumber])

  async function handleSearch() {
    if (areaCode.length !== 3) return
    await fetchNumber(areaCode)
    setPhase('number')
  }

  function handleClaim() {
    if (!currentNumber) return
    setSelectedNumber(currentNumber.e164_format)
    setPhase('selected')
    onSelect(currentNumber.e164_format)
  }

  return (
    <div className="space-y-4">
      {/* Fixed-height number display area */}
      <div
        className="rounded-card overflow-hidden"
        style={{
          height: '160px',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-surface)',
        }}
      >
        {phase === 'loading' && (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        )}

        {phase === 'number' && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6">
            {searching ? (
              <Spinner />
            ) : currentNumber ? (
              <>
                <p className="text-4xl font-bold tracking-tight" style={{ color: 'var(--color-text-1)' }}>
                  {formatE164(currentNumber.e164_format)}
                </p>
                <p className="text-sm" style={{ color: 'var(--color-text-2)' }}>
                  {currentNumber.locality}, {currentNumber.region}
                </p>
              </>
            ) : (
              <p className="text-sm text-center" style={{ color: 'var(--color-text-2)' }}>
                {searchError ?? 'No number found.'}
              </p>
            )}
          </div>
        )}

        {phase === 'searching' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-2)' }}>
              Enter an area code
            </p>
            <div className="flex gap-2 w-full max-w-xs">
              <Input
                value={areaCode}
                onChange={e => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="415"
                maxLength={3}
                className="w-24 text-center font-semibold text-lg"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
              />
              <Button
                variant="outline"
                onClick={handleSearch}
                disabled={areaCode.length !== 3 || searching}
                className="flex-1"
              >
                {searching ? 'Searching...' : 'Search'}
              </Button>
            </div>
            {searchError && (
              <p className="text-xs text-center" style={{ color: 'var(--color-status-escalated)' }}>{searchError}</p>
            )}
            {currentNumber && (
              <button
                type="button"
                onClick={() => setPhase('number')}
                className="text-xs transition-colors duration-150"
                style={{ color: 'var(--color-text-2)' }}
              >
                Keep current number
              </button>
            )}
          </div>
        )}

        {phase === 'selected' && selectedNumber && (
          <div
            className="flex h-full flex-col items-center justify-center gap-2 px-6"
            style={{ backgroundColor: 'var(--color-accent-light)' }}
          >
            <div
              className="w-8 h-8 rounded-pill flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7l3.5 3.5L12 3.5" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-4xl font-bold tracking-tight" style={{ color: 'var(--color-text-1)' }}>
              {formatE164(selectedNumber)}
            </p>
            <p className="text-sm font-medium" style={{ color: 'var(--color-accent)' }}>
              Number selected
            </p>
          </div>
        )}
      </div>

      {phase === 'number' && !searching && currentNumber && (
        <button
          type="button"
          onClick={() => setPhase('searching')}
          className="text-sm font-medium transition-colors duration-150 w-full text-center"
          style={{ color: 'var(--color-accent)' }}
        >
          Get a different number
        </button>
      )}

      {phase !== 'selected' && (
        <Button
          onClick={handleClaim}
          disabled={!currentNumber || phase === 'loading' || phase === 'searching'}
          className="w-full"
        >
          Claim this number
        </Button>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none"
      style={{ color: 'var(--color-accent)' }}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}


// Main

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useUser()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null)

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const [bizData, setBizData] = useState<Step1Data>({
    name: '',
    industry: '',
    description: '',
    services: [],
  })

  const [agentData, setAgentData] = useState<AgentProfile>({
    name: '',
    greeting: '',
    farewell: 'Thanks for calling. Have a wonderful day!',
    fallback: "I'm not sure about that, but someone from our team will follow up with you shortly.",
    holdPhrase: 'Just a moment while I look that up for you.',
  })

  const stepTitles = {
    1: { heading: 'Tell us about your business', sub: 'This helps the AI introduce your business correctly to callers.' },
    2: { heading: 'Customize your AI receptionist', sub: 'Set the voice and phrases your agent will use on every call.' },
    3: { heading: 'Get a phone number', sub: 'Every account gets a dedicated number that routes calls to your AI.' },
  }

  async function finish() {
    if (!selectedNumber) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await apiClient.post('/onboarding', {
        name: bizData.name,
        industry: bizData.industry,
        description: bizData.description,
        services: bizData.services.filter(s => s.name.trim()),
        timezone,
        agentProfile: agentData,
        phoneNumber: selectedNumber,
      })
      await user?.reload()
      navigate('/')
    } catch {
      setSubmitError('Setup failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const { heading, sub } = stepTitles[step]

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div
        className="w-full rounded-card shadow-md"
        style={{
          maxWidth: '600px',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="p-8">
          <StepIndicator current={step} />

          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text-1)' }}>
              {heading}
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-2)' }}>{sub}</p>
          </div>

          {step === 1 && (
            <Step1
              data={bizData}
              onChange={setBizData}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <Step2
              data={agentData}
              onChange={setAgentData}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <>
              <Step3
                onBack={() => setStep(2)}
                onSelect={num => setSelectedNumber(num)}
              />
              {selectedNumber && (
                <div className="mt-4 space-y-2">
                  {submitError && (
                    <p className="text-sm text-center" style={{ color: 'var(--color-status-escalated)' }}>
                      {submitError}
                    </p>
                  )}
                  <Button
                    className="w-full"
                    disabled={submitting}
                    onClick={finish}
                  >
                    {submitting ? 'Setting up your account...' : 'Finish setup'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs" style={{ color: 'var(--color-text-2)' }}>
        Step {step} of 3 — you can update everything later from Settings
      </p>
    </div>
  )
}
