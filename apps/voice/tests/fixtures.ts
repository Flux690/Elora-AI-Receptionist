import type { AgentDeps } from "../src/types.js";
import type { AgentConfig } from "@receptionist/core/repositories/agents.js";
import { AGENT_PROFILE, SERVICES } from "@receptionist/core/tests/factories.js";
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_BOOKING_POLICY,
  DEFAULT_AGENT_SETUP,
} from "@receptionist/shared";

/** Pure fixtures, no database. `factories.ts` is the integration equivalent. */

export function makeAgentConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    businessName: "Test Business",
    industry: "Pet services",
    timezone: "America/New_York",
    description: "A test business.",
    personaName: AGENT_PROFILE.name,
    greeting: AGENT_PROFILE.greeting,
    farewell: AGENT_PROFILE.farewell,
    fallback: AGENT_PROFILE.fallback,
    businessHours: DEFAULT_BUSINESS_HOURS,
    minNoticeMinutes: DEFAULT_BOOKING_POLICY.minNoticeMinutes,
    maxAdvanceDays: DEFAULT_BOOKING_POLICY.maxAdvanceDays,
    // Matches the column default: recording on unless an agent turns it off.
    recordCalls: true,
    checklistDismissed: DEFAULT_AGENT_SETUP.checklistDismissed,
    hoursSeen: DEFAULT_AGENT_SETUP.hoursSeen,
    clerkUserId: "user_test",
    calendarProvider: null,
    calendarExternalId: null,
    calendarPayload: null,
    ...overrides,
  };
}

export function makeAgentDeps(overrides: Partial<AgentDeps> = {}): AgentDeps {
  return {
    agent: makeAgentConfig(),
    services: SERVICES,
    caller: null,
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
