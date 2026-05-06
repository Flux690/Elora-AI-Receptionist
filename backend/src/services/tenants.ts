import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants } from "../db/schema.js";

export type TenantRow = typeof tenants.$inferSelect;

export async function resolveTenantByCalledNumber(
  calledNumber: string
): Promise<TenantRow | null> {
  const rows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.phoneNumber, calledNumber))
    .limit(1);

  return rows[0] ?? null;
}

export async function resolveTenantByClerkUserId(
  clerkUserId: string
): Promise<TenantRow | null> {
  const rows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.clerkUserId, clerkUserId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getTenantById(id: string): Promise<TenantRow | null> {
  const rows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function createTenant(input: {
  name: string;
  vertical: "salon" | "spa" | "clinic" | "home_service";
  timezone: string;
  clerkUserId: string;
}): Promise<TenantRow> {
  const rows = await db
    .insert(tenants)
    .values({
      ...input,
      additionalInstructions: "",
      businessProfile: {},
    })
    .returning();
  return rows[0];
}

export async function deleteTenant(id: string): Promise<void> {
  await db.delete(tenants).where(eq(tenants.id, id));
}

export async function updateTenant(
  id: string,
  patch: Partial<Pick<TenantRow, "name" | "vertical" | "additionalInstructions" | "businessProfile" | "timezone" | "googleCalendarId" | "phoneNumber" | "sipDispatchRuleId">>
): Promise<void> {
  await db
    .update(tenants)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(tenants.id, id));
}
