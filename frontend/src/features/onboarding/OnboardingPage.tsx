import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/react'
import { toast } from 'sonner'
import type { AgentProfile } from '@receptionist/shared'
import { apiClient } from '@/lib/apiClient'
import { StepIndicator } from './StepIndicator'
import { BusinessStep, type BusinessStepData } from './BusinessStep'
import { AgentStep } from './AgentStep'
import { PhoneStep } from './PhoneStep'

const STEP_TITLES = {
  1: {
    heading: 'Tell us about your business',
    sub: 'This helps the AI introduce your business correctly to callers.',
  },
  2: {
    heading: 'Customize your AI receptionist',
    sub: 'Set the voice and phrases your agent will use on every call.',
  },
  3: {
    heading: 'Get a phone number',
    sub: 'Every account gets a dedicated number that routes calls to your AI.',
  },
} as const

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user } = useUser()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [submitting, setSubmitting] = useState(false)
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null)

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const [bizData, setBizData] = useState<BusinessStepData>({
    name: '',
    industry: '',
    description: '',
    services: [],
  })

  const [agentData, setAgentData] = useState<AgentProfile>({
    name: 'My Agent',
    greeting: 'Hello, thank you for calling! How can I help you today?',
    farewell: 'Thanks for calling. Have a wonderful day!',
    fallback: "I'm not sure about that, but someone from our team will follow up with you shortly.",
    holdPhrase: 'Just a moment while I look that up for you.',
  })

  async function finish() {
    if (!selectedNumber) return
    setSubmitting(true)
    try {
      await apiClient.post('/onboarding', {
        name: bizData.name,
        industry: bizData.industry,
        description: bizData.description,
        services: bizData.services.filter((s) => s.name.trim()),
        timezone,
        agentProfile: agentData,
        phoneNumber: selectedNumber,
      })
      await user?.reload()
      navigate('/')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Setup failed. Please try again.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const { heading, sub } = STEP_TITLES[step]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[600px] min-h-[560px] rounded-xl border border-border bg-card shadow-md flex flex-col">
        <div className="flex-1 p-8">
          <StepIndicator current={step} />

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-1">{heading}</h1>
            <p className="text-sm text-muted-foreground">{sub}</p>
          </div>

          {step === 1 && (
            <BusinessStep
              data={bizData}
              onChange={setBizData}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <AgentStep
              data={agentData}
              onChange={setAgentData}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <PhoneStep
              selectedNumber={selectedNumber}
              onSelect={setSelectedNumber}
              onBack={() => setStep(2)}
              onFinish={finish}
              submitting={submitting}
            />
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Step {step} of 3 · you can update everything later from Settings
      </p>
    </div>
  )
}
