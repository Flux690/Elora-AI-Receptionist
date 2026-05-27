import type { WorkerTenant } from "../services/tenants.js";
import type { ClientRow } from "../services/clients.js";

export type CallState = {
  wasBooked: boolean;
  wasEscalated: boolean;
};

export type AgentDeps = {
  tenant: WorkerTenant;
  client: ClientRow | null; // null briefly during greeting; populated before any tool can fire
  callerPhone: string;
  callId: string;           // generated locally via crypto.randomUUID() — never empty
  getGoogleToken: () => Promise<string | null>;
  googleCalendarId: string | null;
  callState: CallState;
};
