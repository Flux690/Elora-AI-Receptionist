export interface Metrics {
  totalCalls: number
  pendingEscalations: number
}

export interface Escalation {
  id: string
  question: string
  status: 'pending' | 'resolved'
  answer: string | null
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
  callerId: string | null
  startedAt: string
  endedAt: string | null
  status: string
}

export interface Settings {
  name: string
  timezone: string
  systemPrompt: string
  businessProfile: Record<string, unknown>
}
