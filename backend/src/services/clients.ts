import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { clients } from "../db/schema.js";

export type ClientRow = typeof clients.$inferSelect;

export async function resolveClientByPhone(
  tenantId: string,
  callerPhone: string
): Promise<ClientRow | null> {
  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.tenantId, tenantId), eq(clients.phoneNumber, callerPhone)))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertClient(
  tenantId: string,
  callerPhone: string
): Promise<ClientRow> {
  const now = new Date();

  const rows = await db
    .insert(clients)
    .values({
      tenantId,
      phoneNumber: callerPhone,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [clients.tenantId, clients.phoneNumber],
      set: { lastSeenAt: now, updatedAt: now },
    })
    .returning();

  return rows[0];
}
