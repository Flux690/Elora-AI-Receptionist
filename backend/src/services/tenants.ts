import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants } from "../db/schema.js";

export type TenantRow = typeof tenants.$inferSelect;

const tenantFields = {
  id: tenants.id,
  name: tenants.name,
  industry: tenants.industry,
  timezone: tenants.timezone,
  description: tenants.description,
  businessHours: tenants.businessHours,
  bookingPolicy: tenants.bookingPolicy,
  agentProfile: tenants.agentProfile,
  // Read on the call path: it selects which disclosure plays and whether egress
  // starts at all, so the worker needs it on every call.
  recordCalls: tenants.recordCalls,
  phoneNumber: tenants.phoneNumber,
  clerkUserId: tenants.clerkUserId,
  calendarProvider: tenants.calendarProvider,
  calendarExternalId: tenants.calendarExternalId,
  calendarPayload: tenants.calendarPayload,
} as const;

export type WorkerTenant = {
  [K in keyof typeof tenantFields]: TenantRow[K];
};

export async function resolveTenantByClerkUserId(
  clerkUserId: string
): Promise<WorkerTenant | null> {
  const rows = await db
    .select(tenantFields)
    .from(tenants)
    .where(eq(tenants.clerkUserId, clerkUserId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getTenantById(id: string): Promise<WorkerTenant | null> {
  const rows = await db
    .select(tenantFields)
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function getTenantByPhoneNumber(phoneNumber: string): Promise<WorkerTenant | null> {
  const rows = await db
    .select(tenantFields)
    .from(tenants)
    .where(eq(tenants.phoneNumber, phoneNumber))
    .limit(1);

  return rows[0] ?? null;
}

export async function createTenant(input: {
  name: string;
  industry: string;
  timezone: string;
  clerkUserId: string;
  phoneNumber: string;
  description?: string;
  businessHours?: import("@receptionist/shared").BusinessHours;
  bookingPolicy?: import("@receptionist/shared").BookingPolicy;
  agentProfile?: import("@receptionist/shared").AgentProfile;
}): Promise<WorkerTenant> {
  const rows = await db
    .insert(tenants)
    .values({
      description: "",
      agentProfile: { name: "", greeting: "", farewell: "", fallback: "" },
      ...input,
    })
    .returning(tenantFields);
  return rows[0];
}

export async function deleteTenant(id: string): Promise<void> {
  await db.delete(tenants).where(eq(tenants.id, id));
}

export async function updateTenant(
  id: string,
  patch: Partial<Pick<TenantRow,
    | "name" | "industry" | "description" | "agentProfile"
    | "businessHours" | "bookingPolicy" | "recordCalls"
    | "timezone" | "phoneNumber"
    | "calendarProvider" | "calendarExternalId" | "calendarPayload"
  >>
): Promise<void> {
  await db
    .update(tenants)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(tenants.id, id));
}
