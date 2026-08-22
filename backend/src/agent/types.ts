import type { Service } from "@receptionist/shared";
import type { Slot } from "./scheduling.js";
import type { WorkerTenant } from "../services/tenants.js";
import type { ClientRow } from "../services/clients.js";
import type { KnowledgeEntry } from "./prompt.js";

export type CallState = {
  wasBooked: boolean;
  wasEscalated: boolean;
};

/** A slot the agent offered, with the service it was computed for. */
export type HeldSlot = { slot: Slot; service: Service };

/**
 * Slots offered during this call, keyed by the short handle the model was given.
 *
 * The model never sees or invents a timestamp: `checkAvailability` computes real
 * slots and hands back opaque ids, and `bookAppointment` takes one of those ids
 * back. That closes several defects at once — no date arithmetic in the model,
 * no invented times, and nothing bookable that was never offered.
 *
 * In memory and per call. These die with the call, which is correct: an offer is
 * only good while the conversation lasts, and the calendar is re-checked at
 * booking time anyway.
 */
export type SlotStore = {
  held: Map<string, HeldSlot>;
  nextId: number;
};

export type AgentDeps = {
  tenant: WorkerTenant;
  /**
   * The tenant's bookable services, read alongside the tenant and cached with
   * it. Off the tenant row since they became their own table — the agent needs
   * their durations to compute slots, not just their names and prices.
   */
  services: Service[];
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
  /**
   * The connected calendar's id in its provider's system, or null when no
   * calendar has been chosen. The provider is on `tenant.calendarProvider`.
   */
  calendarExternalId: string | null;
  /**
   * The tenant's whole knowledge base, inlined into the system prompt at call
   * start. Replaces the searchKnowledge tool — see PLAN.md 1.5.
   */
  knowledge: KnowledgeEntry[];
  callState: CallState;
  slots: SlotStore;
};
