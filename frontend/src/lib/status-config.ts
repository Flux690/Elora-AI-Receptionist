import type {
  CallOutcome,
  EscalationStatus,
  AppointmentStatus,
} from '@receptionist/shared'

/**
 * Tailwind class strings keyed by visual tone.
 * The "neutral" tone is the fallback used by StatusBadge for unknown values.
 */
export type StatusTone = 'success' | 'warning' | 'neutral' | 'muted' | 'danger'

const toneClasses: Record<StatusTone, string> = {
  success: 'bg-status-booked/10 text-status-booked',
  warning: 'bg-status-pending/10 text-status-pending',
  danger: 'bg-status-error/10 text-status-error',
  neutral: 'bg-status-answered/10 text-status-answered',
  muted: 'bg-muted text-muted-foreground',
}

export function toneToClasses(tone: StatusTone): string {
  return toneClasses[tone]
}

export type StatusEntry = { label: string; tone: StatusTone }

export const callOutcomeConfig: Record<CallOutcome, StatusEntry> = {
  booked:    { label: 'Booked',    tone: 'success' },
  escalated: { label: 'Escalated', tone: 'warning' },
  answered:  { label: 'Answered',  tone: 'neutral' },
  abandoned: { label: 'Abandoned', tone: 'muted' },
  error:     { label: 'Error',     tone: 'danger' },
}

export const appointmentStatusConfig: Record<AppointmentStatus, StatusEntry> = {
  confirmed: { label: 'Confirmed', tone: 'success' },
  requested: { label: 'Requested', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

export const escalationStatusConfig: Record<EscalationStatus, StatusEntry> = {
  pending:  { label: 'Pending',  tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
}
