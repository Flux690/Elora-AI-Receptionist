// Domain enums / unions

export type CallOutcome = "answered" | "booked" | "escalated" | "abandoned" | "error";
export type EscalationStatus = "pending" | "resolved";
export type AppointmentStatus = "requested" | "confirmed" | "cancelled";

// Domain value objects

/** The buffers widen the calendar block, not the appointment the caller hears. */
export type Service = {
  id: string;
  name: string;
  price: string;
  description?: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  /** Plural from day one, empty for everyone today. */
  requiredResources: string[];
};

/** A service before it exists — what the create form and onboarding send. */
export type ServiceDraft = Omit<Service, "id">;

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAYS: readonly Weekday[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

/** Local wall clock "HH:MM", never UTC, so "we open at 9" survives daylight saving. */
export type TimeInterval = { start: string; end: string };

/** Replaces the weekly pattern for one date. Empty `intervals` means shut all day. */
export type HoursException = {
  /** "YYYY-MM-DD", read in the business's timezone. */
  date: string;
  intervals: TimeInterval[];
  /** Shown in the dashboard only, e.g. "Christmas Day". */
  label?: string;
};

/** Several intervals per day, because a lunch closure is two and not one. */
export type BusinessHours = {
  weekly: Record<Weekday, TimeInterval[]>;
  exceptions: HoursException[];
};

/** `minNoticeMinutes` covers the person, not the calendar; padding covers the calendar. */
export type BookingPolicy = {
  minNoticeMinutes: number;
  maxAdvanceDays: number;
};

export const DEFAULT_BOOKING_POLICY: BookingPolicy = {
  minNoticeMinutes: 30,
  maxAdvanceDays: 60,
};

/** Mon–Fri, 9 to 5. A starting point every business will edit. */
export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  weekly: {
    mon: [{ start: "09:00", end: "17:00" }],
    tue: [{ start: "09:00", end: "17:00" }],
    wed: [{ start: "09:00", end: "17:00" }],
    thu: [{ start: "09:00", end: "17:00" }],
    fri: [{ start: "09:00", end: "17:00" }],
    sat: [],
    sun: [],
  },
  exceptions: [],
};

/** The phrases an owner controls. There is no hold phrase: speech is a queue. */
export type AgentProfile = {
  name: string;
  greeting: string;
  farewell: string;
  fallback: string;
};

/**
 * Plays before the owner's greeting and is not editable. California AB 2905 and
 * SB 243 require it before any substantive interaction, at $500 per call.
 */
export const AI_DISCLOSURE_RECORDED =
  "Just so you know, you're speaking with an AI assistant, and this call is recorded.";

/** The AI half is never optional. The recording clause is, because it is a claim. */
export const AI_DISCLOSURE_NOT_RECORDED =
  "Just so you know, you're speaking with an AI assistant.";

/** Two concurrent wordings with stable ids, stamped on every call as the audit trail. */
export const DISCLOSURE_VERSION_RECORDED = "2026-08-v1";
export const DISCLOSURE_VERSION_NOT_RECORDED = "2026-08-norec-v1";

export type Disclosure = { text: string; version: string };

/** Text and id together, so a call cannot be stamped with a wording it never heard. */
export function disclosureFor(recordCalls: boolean): Disclosure {
  return recordCalls
    ? { text: AI_DISCLOSURE_RECORDED, version: DISCLOSURE_VERSION_RECORDED }
    : { text: AI_DISCLOSURE_NOT_RECORDED, version: DISCLOSURE_VERSION_NOT_RECORDED };
}

/** A union of one, so no column has to name a vendor. */
export type CalendarProvider = "google";

/** Who sold the number. `manual` is one the operator wired up themselves. */
export type PhoneNumberProvider = "livekit" | "twilio" | "telnyx" | "manual";

/** Display data for the connected calendar. Never read on the call path. */
export type CalendarPayload = {
  /** The calendar's own name, so Settings can show "Bookings", not a raw id. */
  summary: string;
  /** The calendar's timezone as the provider reports it, for display only. */
  timeZone?: string;
};

/** One of the calendars a connected account can offer, for the picker. */
export interface CalendarOption {
  id: string;
  summary: string;
  timeZone?: string;
  primary: boolean;
}

/** A line of the conversation, as plain text. Carries no timing: chat message
 *  timestamps do not line up with the recording. */
export type TranscriptEntry = {
  role: "user" | "assistant";
  text: string;
};

// API response shapes

/** `callerPhone` is nullable throughout: a withheld ID is no identity, never a placeholder. */
export interface CallListItem {
  id: string;
  callerId: string | null;
  callerPhone: string | null;
  /** From `callers.name`. Null for a caller we have never been given a name for. */
  callerName: string | null;
  startedAt: string;
  endedAt: string | null;
  outcome: CallOutcome | null;
  summary: string | null;
}

export interface CallDetail extends CallListItem {
  roomName: string;
  transcript: TranscriptEntry[] | null;
  recordingKey: string | null;
}

export interface EscalationItem {
  id: string;
  /** The call it came from, so the dashboard can link to the recording. */
  callId: string | null;
  callerPhone: string | null;
  /** Who to ring back: the name given at escalation, else the one on the caller row. */
  callerName: string | null;
  question: string;
  status: EscalationStatus;
  answer: string | null;
  createdAt: string;
}

export interface KnowledgeItem {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

export interface AppointmentItem {
  id: string;
  callerPhone: string | null;
  /** The name given at booking. Null when the caller declined or predates this. */
  callerName: string | null;
  service: string;
  startTime: string | null;
  endTime: string | null;
  status: AppointmentStatus;
  externalEventId: string | null;
  createdAt: string;
}

export interface AvailableNumber {
  id: string;
  e164_format: string;
  locality: string;
  region: string;
}

/** Only what cannot be derived: hours are valid from creation, so nothing else says
 *  whether they have been looked at. */
export interface AgentSetup {
  checklistDismissed: boolean;
  hoursSeen: boolean;
}

export const DEFAULT_AGENT_SETUP: AgentSetup = {
  checklistDismissed: false,
  hoursSeen: false,
};

export interface DashboardMetrics {
  totalCalls: number;
  /** Calls that arrived while the business was shut. Scoped by the period. */
  afterHoursCalls: number;
  confirmedBookings: number;
  /** Every unanswered question, ignoring the period. */
  pendingEscalations: number;
  abandonedCalls: number;
}

export interface BusinessSettings {
  name: string;
  industry: string;
  timezone: string;
  description: string;
  services: Service[];
  businessHours: BusinessHours;
  bookingPolicy: BookingPolicy;
  agentProfile: AgentProfile;
  /** The owner's preference. What actually happens is this AND storageConfigured. */
  recordCalls: boolean;
  /** False when the R2_* variables are unset, which makes recording impossible. */
  storageConfigured: boolean;
  phoneNumber: string | null;
  calendarProvider: CalendarProvider | null;
  calendarExternalId: string | null;
  calendarPayload: CalendarPayload | null;
}
