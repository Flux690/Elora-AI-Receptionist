import { db } from "../db/client.js";
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
