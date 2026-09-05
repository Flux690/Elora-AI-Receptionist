import { db } from "../db/client.js";
import { and, eq } from "drizzle-orm";
import { clients } from "../db/schema.js";

export type ClientRow = typeof clients.$inferSelect;

/**
 * Records that this caller was seen. Returns `null` when the caller withheld
 * their number — an anonymous caller has no identity to key a client row on.
 *
 * `clients.phone_number` stays NOT NULL precisely because of this: rather than
 * storing a nullable or placeholder identity that later reads as "the anonymous
 * caller", we store no row at all. See PLAN.md 1.8.1.
 */
export async function upsertClient(
  tenantId: string,
  callerPhone: string | null
): Promise<ClientRow | null> {
  if (!callerPhone) return null;

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

  return rows[0]!;
}

/**
 * Records the caller's name against their client row.
 *
 * `clients.name` existed but nothing ever wrote it, so the prompt's "returning
 * client" branch was unreachable and calendar events were always titled with a
 * phone number (PLAN.md 1.8.4).
 *
 * The Python SDK has GetNameTask for this; in Node the agent asks and calls a
 * tool. Scoped by tenant so one tenant cannot rename another's client.
 */
export async function setClientName(
  tenantId: string,
  clientId: string,
  name: string
): Promise<ClientRow | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const rows = await db
    .update(clients)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(and(eq(clients.id, clientId), eq(clients.tenantId, tenantId)))
    .returning();

  return rows[0] ?? null;
}
