import type {
  CallOutcome,
  EscalationStatus,
  AppointmentStatus,
} from '@receptionist/shared'

/**
 * Status has four roles and colour appears for two of them.
 *
 *   fact     something happened. Ink, carried in weight.
 *   waiting  something needs a person. The accent, and the only place it appears
 *            in a list, so it is findable by colour alone.
 *   quiet    an outcome you read rather than act on. Muted ink.
 *   failed   an error. Red, which is used for nothing else.
 */
export type StatusTone = 'fact' | 'waiting' | 'quiet' | 'failed'

const toneClasses: Record<StatusTone, string> = {
  fact: 'text-foreground font-medium',
  waiting: 'text-accent-ink font-medium',
  quiet: 'text-muted-foreground',
  failed: 'text-destructive font-medium',
}

export function toneToClasses(tone: StatusTone): string {
  return toneClasses[tone]
}

export type StatusEntry = { label: string; tone: StatusTone }

export const callOutcomeConfig: Record<CallOutcome, StatusEntry> = {
  booked:    { label: 'Booked',    tone: 'fact' },
  escalated: { label: 'Escalated', tone: 'waiting' },
  answered:  { label: 'Answered',  tone: 'quiet' },
  abandoned: { label: 'Abandoned', tone: 'quiet' },
  error:     { label: 'Error',     tone: 'failed' },
}

export const appointmentStatusConfig: Record<AppointmentStatus, StatusEntry> = {
  confirmed: { label: 'Confirmed', tone: 'fact' },
  requested: { label: 'Requested', tone: 'waiting' },
  cancelled: { label: 'Cancelled', tone: 'quiet' },
}

export const escalationStatusConfig: Record<EscalationStatus, StatusEntry> = {
  pending:  { label: 'Pending',  tone: 'waiting' },
  resolved: { label: 'Resolved', tone: 'quiet' },
}
