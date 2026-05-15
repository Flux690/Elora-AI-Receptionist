import { apiClient } from './apiClient'
import type {
  DashboardMetrics,
  EscalationItem,
  KnowledgeItem,
  CallListItem,
  CallDetail,
  AppointmentItem,
  EscalationStatus,
} from '@receptionist/shared'
import type { Period } from './types'
import type { AppSettings } from './settings-types'

export const keys = {
  metrics: (period: Period) => ['metrics', period] as const,
  escalations: (status: EscalationStatus) => ['escalations', status] as const,
  knowledge: ['knowledge'] as const,
  calls: () => ['calls'] as const,
  call: (id: string) => ['calls', id] as const,
  callRecording: (id: string) => ['calls', id, 'recording'] as const,
  settings: ['settings'] as const,
  appointments: ['appointments'] as const,
}

export const fetchers = {
  metrics: (period: Period) =>
    apiClient.get<DashboardMetrics>(`/admin/metrics?period=${period}`).then((r) => r.data),

  escalations: (status: EscalationStatus) =>
    apiClient.get<EscalationItem[]>(`/admin/escalations?status=${status}`).then((r) => r.data),

  knowledge: () =>
    apiClient.get<KnowledgeItem[]>('/admin/knowledge').then((r) => r.data),

  calls: ({ limit = 25, offset = 0 }: { limit?: number; offset?: number } = {}) =>
    apiClient.get<CallListItem[]>(`/admin/calls?limit=${limit}&offset=${offset}`).then((r) => r.data),

  call: (id: string) =>
    apiClient.get<CallDetail>(`/admin/calls/${id}`).then((r) => r.data),

  callRecording: (id: string) =>
    apiClient.get<{ url: string }>(`/admin/calls/${id}/recording`).then((r) => r.data),

  settings: () =>
    apiClient.get<AppSettings>('/admin/settings').then((r) => r.data),

  appointments: () =>
    apiClient.get<AppointmentItem[]>('/admin/appointments').then((r) => r.data),
}
