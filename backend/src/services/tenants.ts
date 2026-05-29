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
  services: tenants.services,
  agentProfile: tenants.agentProfile,
  phoneNumber: tenants.phoneNumber,
  clerkUserId: tenants.clerkUserId,
  googleCalendarId: tenants.googleCalendarId,
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
  services?: import("@receptionist/shared").ServiceItem[];
  agentProfile?: import("@receptionist/shared").AgentProfile;
}): Promise<WorkerTenant> {
  const rows = await db
    .insert(tenants)
    .values({
      description: "",
      services: [],
      agentProfile: { name: "", greeting: "", farewell: "", fallback: "", holdPhrase: "" },
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
    | "name" | "industry" | "description" | "services" | "agentProfile"
    | "timezone" | "googleCalendarId" | "phoneNumber"
  >>
): Promise<void> {
  await db
    .update(tenants)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(tenants.id, id));
}
