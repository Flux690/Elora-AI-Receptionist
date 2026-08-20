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
  /**
   * Resolves to true once the `calls` row exists, false if the insert failed or
   * was skipped (test sessions).
   *
   * DB writes are deliberately deferred until after the greeting so the caller
   * hears audio with no blocking round trip. That leaves a window where the
   * agent is live but `calls` has no row for this call, and anything writing a
   * FK to calls.id — createEscalation — would fail. Await this first rather than
   * moving the write earlier, which would put an insert on the path to first
   * audio. In the normal case it resolved seconds ago and costs nothing.
   *
   * Never rejects.
   */
  callRowReady: Promise<boolean>;
  getGoogleToken: () => Promise<string | null>;
  googleCalendarId: string | null;
  /**
   * The tenant's whole knowledge base, inlined into the system prompt at call
   * start. Replaces the searchKnowledge tool — see PLAN.md 1.5.
   */
  knowledge: KnowledgeEntry[];
  callState: CallState;
};
