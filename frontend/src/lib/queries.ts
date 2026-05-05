import { apiClient } from './apiClient'
import type { Metrics, Escalation, KnowledgeItem, Call, Settings, Appointment } from '@/types/api'

export const keys = {
  metrics: ['metrics'] as const,
  escalations: (status: string) => ['escalations', status] as const,
  knowledge: ['knowledge'] as const,
  calls: ['calls'] as const,
  settings: ['settings'] as const,
  appointments: ['appointments'] as const,
}

export const fetchers = {
  metrics: () =>
    apiClient.get<Metrics>('/admin/metrics').then((r) => r.data),
  escalations: (status: string) =>
    apiClient.get<Escalation[]>(`/admin/escalations?status=${status}`).then((r) => r.data),
  knowledge: () =>
    apiClient.get<KnowledgeItem[]>('/admin/knowledge').then((r) => r.data),
  calls: () =>
    apiClient.get<Call[]>('/admin/calls').then((r) => r.data),
  settings: () =>
    apiClient.get<Settings>('/admin/settings').then((r) => r.data),
  appointments: () =>
    apiClient.get<Appointment[]>('/admin/appointments').then((r) => r.data),
}
