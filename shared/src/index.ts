// Domain enums / unions

export type CallOutcome = "answered" | "booked" | "escalated" | "abandoned" | "error";
export type EscalationStatus = "pending" | "resolved";
export type AppointmentStatus = "requested" | "confirmed" | "cancelled";

// Domain value objects

/**
 * A bookable service.
 *
 * `durationMinutes` is what makes booking correct: before it existed every
 * appointment was assumed to take exactly an hour, so a two-hour colour and a
 * fifteen-minute fringe trim blocked the same slot.
 *
 * The two buffers are time the calendar must hold but the caller never hears
 * about — cleaning a chair, writing notes, driving to the next job. They widen
 * the block, not the appointment.
 */
export type Service = {
  id: string;
  name: string;
  price: string;
  description?: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  /**
   * Plural from day one, and always empty today.
   *
   * A deliberate hedge (PLAN.md 2.5): when multi-staff booking arrives it
   * becomes additive rather than a schema change and a rewrite of every row.
   */
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

/**
 * An open period, as local wall-clock "HH:MM" in the business's own timezone.
 *
 * **Never UTC.** "We open at 9" has to stay 9 o'clock through a daylight-saving
 * change; storing an instant would silently shift it to 8 or 10 twice a year.
 */
export type TimeInterval = { start: string; end: string };

/**
 * A specific date that replaces the weekly pattern — a holiday, or a one-off
 * late opening. An empty `intervals` array means closed all day.
 */
export type HoursException = {
  /** "YYYY-MM-DD", read in the business's timezone. */
  date: string;
  intervals: TimeInterval[];
  /** Shown in the dashboard only, e.g. "Christmas Day". */
  label?: string;
};

/**
 * When the business is open.
 *
 * Multiple intervals per day from the start, because a lunch closure is two
 * intervals and not one — a single open/close pair cannot express it, and
 * retrofitting that means rewriting every row already saved.
 */
export type BusinessHours = {
  weekly: Record<Weekday, TimeInterval[]>;
  exceptions: HoursException[];
};

/**
 * Limits on when a caller may book.
 *
 * `minNoticeMinutes` is not about the calendar being busy — padding covers that.
 * It covers the person: a booking made for twenty minutes from now is one the
 * plumber cannot drive to, and one the stylist will not see until they next look
 * at their phone. Defaults to 30, and 0 is a legitimate setting.
 */
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

/**
 * The phrases an owner controls. There is no hold phrase: speech is a queue, so
 * a phrase spoken during a slow tool call stands in front of that tool's own
 * answer and the reply is discarded. See `agent/tools.ts`.
 */
export type AgentProfile = {
  name: string;
  greeting: string;
  farewell: string;
  fallback: string;
};

/**
 * The sentence every caller hears before the tenant's own greeting.
 *
 * Platform-owned and not editable from the dashboard, deliberately. California
 * AB 2905 and SB 243 require a caller to be told they are speaking to an AI
 * *before any substantive interaction*, at $500 per call, and `agentProfile.greeting`
 * is entirely tenant-authored free text — so a tenant could and would write a
 * greeting with no disclosure at all. The platform built the system that omits
 * it, so the platform carries the exposure.
 *
 * It lives here rather than in the agent because the dashboard has to show the
 * owner what plays. That was a hand-copied string in `AgentTab.tsx` with a
 * comment promising to keep it in step; a second wording would have doubled the
 * drift.
 */
export const AI_DISCLOSURE_RECORDED =
  "Just so you know, you're speaking with an AI assistant, and this call is recorded.";

/**
 * The same disclosure minus the recording clause, for a tenant who has turned
 * recording off. The AI half is never optional; only the recording half is,
 * because only the recording half describes something we are actually doing.
 */
export const AI_DISCLOSURE_NOT_RECORDED =
  "Just so you know, you're speaking with an AI assistant.";

/**
 * Which wording played, recorded against every call.
 *
 * The recorded id keeps its original value: rows written before the toggle
 * existed heard exactly this sentence, so re-labelling them would make the audit
 * trail lie. The new wording gets a new id rather than a version bump — these
 * are two concurrent wordings, not an old one and its replacement.
 */
export const DISCLOSURE_VERSION_RECORDED = "2026-08-v1";
export const DISCLOSURE_VERSION_NOT_RECORDED = "2026-08-norec-v1";

export type Disclosure = { text: string; version: string };

/** The wording and its id, together — so nothing can stamp a call with an id
 *  that does not match what the caller actually heard. */
export function disclosureFor(recordCalls: boolean): Disclosure {
  return recordCalls
    ? { text: AI_DISCLOSURE_RECORDED, version: DISCLOSURE_VERSION_RECORDED }
    : { text: AI_DISCLOSURE_NOT_RECORDED, version: DISCLOSURE_VERSION_NOT_RECORDED };
}

/**
 * Which system holds the tenant's calendar.
 *
 * A union of one today. It exists so the schema stops naming a vendor in a
 * column name — `google_calendar_id` was the one place the design foreclosed
 * ever supporting Outlook, Apple, or a real booking system (PLAN.md 2.5).
 */
export type CalendarProvider = "google";

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

/**
 * A line of the conversation, as plain text.
 *
 * `startTime` / `endTime` were dropped with click-to-seek (PLAN.md 2.8.1).
 * They held `item.createdAt` — when the chat message object was made, which is
 * after speech-to-text finalised for a caller turn and before the audio played
 * for an agent turn — so they never described the recording and nothing should
 * be tempted to use them for that again.
 */
export type TranscriptEntry = {
  role: "user" | "assistant";
  text: string;
};

// API response shapes

/**
 * `callerPhone` is nullable everywhere below, because a withheld caller ID means
 * no identity rather than a placeholder one (PLAN.md 1.8.1). These interfaces
 * previously typed it as a plain `string` while all three columns were nullable
 * and the components already branched on null — the types were the only thing
 * claiming otherwise.
 */
export interface CallListItem {
  id: string;
  clientId: string | null;
  callerPhone: string | null;
  /** From `clients.name`. Null for a caller we have never been given a name for. */
  callerName: string | null;
  startedAt: string;
  endedAt: string | null;
  outcome: CallOutcome | null;
  summary: string | null;
}

export interface CallDetail extends CallListItem {
  livekitRoomName: string;
  transcript: TranscriptEntry[] | null;
  recordingUrl: string | null;
}

export interface EscalationItem {
  id: string;
  /** The call it came from, so the dashboard can link to the recording. */
  callId: string | null;
  callerPhone: string | null;
  /**
   * Who to ring back. The name given when the question was escalated, falling
   * back to the one already on the client row.
   */
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

/**
 * What the owner has already been through, for the setup checklist on Home.
 *
 * Only what cannot be derived. Whether services exist and whether a calendar is
 * connected are both readable from the data; whether the hours have been *looked
 * at* is not, because they are valid from the moment a tenant exists.
 */
export interface TenantSetup {
  checklistDismissed: boolean;
  hoursSeen: boolean;
}

export const DEFAULT_TENANT_SETUP: TenantSetup = {
  checklistDismissed: false,
  hoursSeen: false,
};

export interface DashboardMetrics {
  totalCalls: number;
  /**
   * Calls that arrived while the business was shut.
   *
   * The figure the product exists to produce: every one of these is a customer
   * who would otherwise have reached a voicemail or rung somebody else. Scoped
   * by the same period as the rest, unlike `pendingEscalations`.
   */
  afterHoursCalls: number;
  confirmedBookings: number;
  /** Every unanswered question, ignoring the period. See controllers/metrics.ts. */
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
  /**
   * Whether calls are recorded. Changes what the disclosure says, so it is not
   * only a storage decision — see `disclosureFor`.
   */
  recordCalls: boolean;
  phoneNumber: string | null;
  calendarProvider: CalendarProvider | null;
  calendarExternalId: string | null;
  calendarPayload: CalendarPayload | null;
}
