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

export async function updateTenant(
  id: string,
  patch: Partial<Pick<TenantRow, "name" | "systemPrompt" | "businessProfile" | "timezone">>
): Promise<void> {
  await db
    .update(tenants)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(tenants.id, id));
}
