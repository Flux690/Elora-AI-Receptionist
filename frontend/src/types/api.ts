export interface Metrics {
  totalCalls: number
  pendingEscalations: number
}

export interface Escalation {
  id: string
  question: string
  status: 'pending' | 'resolved'
  answer: string | null
  callerPhone: string | null
  createdAt: string
}

export interface KnowledgeItem {
  id: string
  question: string
  answer: string
  createdAt: string
}

export interface Call {
  id: string
  callerPhone: string | null
  startedAt: string
  endedAt: string | null
  outcome: 'answered' | 'booked' | 'escalated' | 'abandoned' | 'error' | null
}

export type Vertical = 'salon' | 'spa' | 'clinic' | 'home_service'

export interface Settings {
  name: string
  vertical: Vertical
  timezone: string
  additionalInstructions: string
  businessProfile: Record<string, string>
  googleCalendarId: string | null
  phoneNumber: string | null
  sipDispatchRuleId: string | null
}

export interface AvailableNumber {
  id: string
  e164_format: string
  locality: string
  region: string
}

export interface Appointment {
  id: string
  callerPhone: string
  service: string
  startTime: string | null
  endTime: string | null
  status: 'requested' | 'confirmed' | 'cancelled'
  googleEventId: string | null
  createdAt: string
}
