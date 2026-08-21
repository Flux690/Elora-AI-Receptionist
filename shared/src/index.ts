// Domain enums / unions

export type CallOutcome = "answered" | "booked" | "escalated" | "abandoned" | "error";
export type EscalationStatus = "pending" | "resolved";
export type AppointmentStatus = "requested" | "confirmed" | "cancelled";

// Domain value objects

export type ServiceItem = {
  name: string;
  price: string;
  description?: string;
};

export type AgentProfile = {
  name: string;
  greeting: string;
  farewell: string;
  fallback: string;
  holdPhrase: string;
};

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

export interface CallListItem {
  id: string;
  clientId: string | null;
  callerPhone: string;
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
  callerPhone: string;
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
  callerPhone: string;
  service: string;
  startTime: string | null;
  endTime: string | null;
  status: AppointmentStatus;
  googleEventId: string | null;
  createdAt: string;
}

export interface AvailableNumber {
  id: string;
  e164_format: string;
  locality: string;
  region: string;
}

export interface DashboardMetrics {
  totalCalls: number;
  confirmedBookings: number;
  pendingEscalations: number;
  abandonedCalls: number;
}

export interface BusinessSettings {
  name: string;
  industry: string;
  timezone: string;
  description: string;
  services: ServiceItem[];
  agentProfile: AgentProfile;
  phoneNumber: string | null;
  googleCalendarId: string | null;
}
