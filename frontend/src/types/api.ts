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

export interface Settings {
  name: string
  timezone: string
  systemPrompt: string
  businessProfile: Record<string, string>
}
