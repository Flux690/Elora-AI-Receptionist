import type { WorkerTenant } from "../services/tenants.js";

export type CallState = {
  wasBooked: boolean;
  wasEscalated: boolean;
};

export type AgentDeps = {
  tenant: WorkerTenant;
  client: { id: string; name: string | null; phoneNumber: string; lastSeenAt: Date | null };
  callerPhone: string;
  callId: string;
  getGoogleToken: () => Promise<string | null>;
  googleCalendarId: string | null;
  callState: CallState;
};
