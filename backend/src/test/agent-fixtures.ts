import type { AgentDeps } from "../agent/types.js";
import type { WorkerTenant } from "../services/tenants.js";
import { AGENT_PROFILE, SERVICES } from "./factories.js";
import { DEFAULT_BUSINESS_HOURS, DEFAULT_BOOKING_POLICY } from "@receptionist/shared";

/**
 * Pure fixtures for agent-level unit tests. Deliberately touches no database —
 * `factories.ts` is for integration tests; this is for `buildSystemPrompt` and
 * friends, which are pure functions.
 */

export function makeWorkerTenant(overrides: Partial<WorkerTenant> = {}): WorkerTenant {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Test Business",
    industry: "Pet services",
    timezone: "America/New_York",
    description: "A test business.",
    businessHours: DEFAULT_BUSINESS_HOURS,
    bookingPolicy: DEFAULT_BOOKING_POLICY,
    agentProfile: AGENT_PROFILE,
    // Matches the column default: recording on unless a tenant turns it off.
    recordCalls: true,
    phoneNumber: "+15550000000",
    clerkUserId: "user_test",
    calendarProvider: null,
    calendarExternalId: null,
    calendarPayload: null,
    ...overrides,
  };
}

export function makeAgentDeps(overrides: Partial<AgentDeps> = {}): AgentDeps {
  return {
    tenant: makeWorkerTenant(),
    services: SERVICES,
    client: null,
    callerPhone: "+14155550123",
    callId: "22222222-2222-2222-2222-222222222222",
    getGoogleToken: async () => null,
    calendarExternalId: null,
    knowledge: [],
    // Fixtures default to the row already existing, which is the normal case.
    callRowReady: Promise.resolve(true),
    callState: { wasBooked: false, wasEscalated: false },
    slots: { held: new Map(), nextId: 1 },
    ...overrides,
  };
}
