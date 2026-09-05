import { db } from "../db/client.js";
import { and, eq } from "drizzle-orm";
import { callers } from "../db/schema.js";

export type CallerRow = typeof callers.$inferSelect;

/**
 * Records that this caller was seen. Returns `null` when the caller withheld
 * their number — an anonymous caller has no identity to key a caller row on.
 *
 * `callers.phone_number` stays NOT NULL precisely because of this: rather than
 * storing a nullable or placeholder identity that later reads as "the anonymous
 * caller", we store no row at all. See PLAN.md 1.8.1.
 */
export async function upsertCaller(
  agentId: string,
  callerPhone: string | null
): Promise<CallerRow | null> {
  if (!callerPhone) return null;

  const now = new Date();

  const rows = await db
    .insert(callers)
    .values({
      agentId,
      phoneNumber: callerPhone,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [callers.agentId, callers.phoneNumber],
      set: { lastSeenAt: now, updatedAt: now },
    })
    .returning();

  return rows[0]!;
}

/**
 * Records the caller's name against their client row.
 *
 * `callers.name` existed but nothing ever wrote it, so the prompt's "returning
 * client" branch was unreachable and calendar events were always titled with a
 * phone number (PLAN.md 1.8.4).
 *
 * The Python SDK has GetNameTask for this; in Node the agent asks and calls a
 * tool. Scoped by agent so one agent cannot rename another's client.
 */
export async function setCallerName(
  agentId: string,
  callerId: string,
  name: string
): Promise<CallerRow | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const rows = await db
    .update(callers)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(and(eq(callers.id, callerId), eq(callers.agentId, agentId)))
    .returning();

  return rows[0] ?? null;
}
