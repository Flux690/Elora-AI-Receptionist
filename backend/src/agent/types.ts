import type { WorkerTenant } from "../services/tenants.js";
import type { ClientRow } from "../services/clients.js";
import type { KnowledgeEntry } from "./prompt.js";

export type CallState = {
  wasBooked: boolean;
  wasEscalated: boolean;
};

export type AgentDeps = {
  tenant: WorkerTenant;
  client: ClientRow | null; // null briefly during greeting; populated before any tool can fire
  /** null when the caller withheld their number — see agent/caller.ts. */
  callerPhone: string | null;
  callId: string;           // generated locally via crypto.randomUUID() — never empty
  getGoogleToken: () => Promise<string | null>;
  googleCalendarId: string | null;
  /**
   * The tenant's whole knowledge base, inlined into the system prompt at call
   * start. Replaces the searchKnowledge tool — see PLAN.md 1.5.
   */
  knowledge: KnowledgeEntry[];
  callState: CallState;
};
