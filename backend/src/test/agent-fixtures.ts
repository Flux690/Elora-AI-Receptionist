import type { AgentDeps } from "../agent/types.js";
import type { WorkerTenant } from "../services/tenants.js";
import { AGENT_PROFILE, SERVICES } from "./factories.js";

/**
 * Pure fixtures for agent-level unit tests. Deliberately touches no database —
 * `factories.ts` is for integration tests; this is for `buildSystemPrompt` and
 * friends, which are pure functions.
 */

export function makeWorkerTenant(overrides: Partial<WorkerTenant> = {}): WorkerTenant {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Test Salon",
    industry: "salon",
    timezone: "America/New_York",
    description: "A test salon.",
    services: SERVICES,
    agentProfile: AGENT_PROFILE,
    phoneNumber: "+15550000000",
    clerkUserId: "user_test",
    googleCalendarId: null,
    ...overrides,
  };
}

export function makeAgentDeps(overrides: Partial<AgentDeps> = {}): AgentDeps {
  return {
    tenant: makeWorkerTenant(),
    client: null,
    callerPhone: "+14155550123",
    callId: "22222222-2222-2222-2222-222222222222",
    getGoogleToken: async () => null,
    googleCalendarId: null,
    knowledge: [],
    // Fixtures default to the row already existing, which is the normal case.
    callRowReady: Promise.resolve(true),
    callState: { wasBooked: false, wasEscalated: false },
    ...overrides,
  };
}
