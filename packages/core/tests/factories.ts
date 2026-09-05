import { db } from "../src/db/client.js";
import { tenants, clients, calls, escalations, appointments, services } from "../src/db/schema.js";
import type { AgentProfile, Service } from "@receptionist/shared";

/**
 * Fixture builders for integration tests. Every one takes overrides so a test
 * states only the fields it actually cares about — the rest is plausible noise.
 */

let seq = 0;
const uniq = () => `${Date.now()}-${++seq}`;

export const AGENT_PROFILE: AgentProfile = {
  name: "Riley",
  greeting: "Thanks for calling Test Business, this is Riley.",
  farewell: "Thanks for calling, goodbye.",
  fallback: "Let me check with the team and get back to you.",
};

/**
 * Two services with deliberately different shapes: a short one with no padding,
 * and a long one with cleanup either side. Slot generation behaves differently
 * for each, so a fixture where both were 60 minutes would hide most bugs.
 */
export const SERVICES: Service[] = [
  {
    id: "33333333-3333-3333-3333-333333333331",
    name: "Haircut",
    price: "$45",
    description: "Wash, cut and style",
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    requiredResources: [],
  },
  {
    id: "33333333-3333-3333-3333-333333333332",
    name: "Colour",
    price: "$120",
    durationMinutes: 120,
    bufferBeforeMinutes: 10,
    bufferAfterMinutes: 15,
    requiredResources: [],
  },
];

export async function makeTenant(overrides: Partial<typeof tenants.$inferInsert> = {}) {
  const rows = await db
    .insert(tenants)
    .values({
      name: "Test Business",
      industry: "Pet services",
      timezone: "America/New_York",
      description: "A test business.",
      agentProfile: AGENT_PROFILE,
      phoneNumber: `+1555${uniq().slice(-7)}`,
      clerkUserId: `user_${uniq()}`,
      ...overrides,
    })
    .returning();
  return rows[0]!;
}

export async function makeClient(
  tenantId: string,
  overrides: Partial<typeof clients.$inferInsert> = {}
) {
  const rows = await db
    .insert(clients)
    .values({
      tenantId,
      phoneNumber: `+1555${uniq().slice(-7)}`,
      lastSeenAt: new Date(),
      ...overrides,
    })
    .returning();
  return rows[0]!;
}

export async function makeCall(
  tenantId: string,
  overrides: Partial<typeof calls.$inferInsert> = {}
) {
  const rows = await db
    .insert(calls)
    .values({
      tenantId,
      callerPhone: `+1555${uniq().slice(-7)}`,
      livekitRoomName: `call-${uniq()}`,
      ...overrides,
    })
    .returning();
  return rows[0]!;
}

export async function makeEscalation(
  tenantId: string,
  overrides: Partial<typeof escalations.$inferInsert> = {}
) {
  const rows = await db
    .insert(escalations)
    .values({
      tenantId,
      callerPhone: `+1555${uniq().slice(-7)}`,
      question: "Do you have parking?",
      status: "pending",
      ...overrides,
    })
    .returning();
  return rows[0]!;
}

export async function makeAppointment(
  tenantId: string,
  overrides: Partial<typeof appointments.$inferInsert> = {}
) {
  const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const rows = await db
    .insert(appointments)
    .values({
      tenantId,
      callerPhone: `+1555${uniq().slice(-7)}`,
      service: "Haircut",
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
      status: "confirmed",
      ...overrides,
    })
    .returning();
  return rows[0]!;
}

export async function makeService(
  tenantId: string,
  overrides: Partial<typeof services.$inferInsert> = {}
) {
  const rows = await db
    .insert(services)
    .values({
      tenantId,
      name: `Haircut ${uniq()}`,
      price: "$45",
      durationMinutes: 30,
      ...overrides,
    })
    .returning();
  return rows[0]!;
}
