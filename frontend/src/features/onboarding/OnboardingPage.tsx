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
    sub: 'Your agent uses this to introduce you to callers.',
  },
  2: {
    heading: 'Set what your agent says',
    sub: 'The phrases it repeats on every call. You can change them later.',
  },
  3: {
    heading: 'Pick a phone number',
    sub: 'The number your customers call, answered by your agent.',
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
        'Setup failed. Try again.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const { heading, sub } = STEP_TITLES[step]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-[600px] flex-col rounded-xl bg-card shadow-control">
        <div className="flex-1 p-8">
          <StepIndicator current={step} />

          <div className="mb-6">
            <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">{heading}</h1>
            <p className="text-muted-foreground">{sub}</p>
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

      <p className="mt-6 text-muted-foreground">
        Step {step} of 3. Everything here can be changed later in Settings.
      </p>
    </div>
  )
}
