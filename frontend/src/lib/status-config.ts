import type {
  CallOutcome,
  EscalationStatus,
  AppointmentStatus,
} from '@receptionist/shared'

/**
 * Status has three roles, and colour only appears for one of them.
 *
 *   fact      a booking happened. Ink, carried in weight — a completed booking
 *             is not a celebration, and a green chip for every one of them
 *             spends the loudest thing on screen on the least urgent news.
 *   waiting   something needs a person. The accent, and the only place it
 *             appears in a list, so it is findable by colour alone.
 *   quiet     answered, abandoned, resolved, cancelled. Muted ink; these are
 *             outcomes you read, not ones you act on.
 *   failed    an error. Red, and red is used for nothing else in the product,
 *             so it still means what people expect it to.
 *
 * Green and amber are gone on purpose. An escalation is not a failure, and
 * amber said it was.
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
