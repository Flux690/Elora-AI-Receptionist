export type CallOutcome = 'answered' | 'booked' | 'escalated' | 'abandoned' | 'error'
export type EscalationStatus = 'pending' | 'resolved'
export type AppointmentStatus = 'requested' | 'confirmed' | 'cancelled'
export type Period = 'today' | '7d' | '30d'

export interface ServiceItem {
  name: string
  price: string
  description?: string
}

export interface AgentProfile {
  name: string
  greeting: string
  farewell: string
  fallback: string
  holdPhrase: string
}

export interface TranscriptEntry {
  role: 'user' | 'assistant'
  text: string
  startTime?: number
}

export interface DashboardMetrics {
  totalCalls: number
  confirmedBookings: number
  pendingEscalations: number
  abandonedCalls: number
}

export interface CallListItem {
  id: string
  clientId: string | null
  callerPhone: string
  startedAt: string
  endedAt: string | null
  outcome: CallOutcome | null
  summary: string | null
}

export interface CallDetail extends CallListItem {
  livekitRoomName: string
  transcript: TranscriptEntry[] | null
  recordingUrl: string | null
}

export interface EscalationItem {
  id: string
  callerPhone: string
  question: string
  status: EscalationStatus
  answer: string | null
  createdAt: string
}

export interface KnowledgeItem {
  id: string
  question: string
  answer: string
  createdAt: string
}

export interface AppointmentItem {
  id: string
  callerPhone: string
  service: string
  startTime: string | null
  endTime: string | null
  status: AppointmentStatus
  googleEventId: string | null
  createdAt: string
}

export interface Settings {
  business: {
    name: string
    industry: string
    timezone: string
    description: string
    services: ServiceItem[]
    phoneNumber: string | null
    googleCalendarId: string | null
  }
  agent: AgentProfile
}

export interface AvailableNumber {
  id: string
  e164_format: string
  locality: string
  region: string
}
