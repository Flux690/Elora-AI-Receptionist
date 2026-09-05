import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { clients, escalations } from "../db/schema.js";

export type EscalationRow = typeof escalations.$inferSelect;

type CreateEscalationInput = {
  tenantId: string;
  callId?: string | null;
  clientId?: string | null;
  callerPhone: string | null;
  callerName?: string | null;
  question: string;
  transcriptExcerpt?: string | null;
};

/**
 * Escalate a question, at most once per (call, question) pair.
 *
 * Insert-first rather than check-then-act. SELECT-then-INSERT is a race: two
 * tool calls in one turn both miss the SELECT, both INSERT, and the partial
 * unique index on (call_id, lower(question)) makes the second one throw — out of
 * the tool, mid-call (PLAN.md 1.7.4).
 *
 * The race is not theoretical, and the warm pool in db/client.ts makes it more
 * likely rather than less: a cold pool staggers the SELECTs behind connection
 * latency and hides it (8 concurrent calls, 0 failures), while a warm one turns
 * the same 8 calls into 7 unique-violation failures.
 *
 * `onConflictDoNothing` returns an empty result when the row already existed, so
 * the SELECT below is the fallback that fetches the winner's row — not a guard.
 */
export async function createEscalation(
  input: CreateEscalationInput
): Promise<EscalationRow> {
  const rows = await db
    .insert(escalations)
    .values({
      tenantId: input.tenantId,
      callId: input.callId ?? null,
      clientId: input.clientId ?? null,
      callerPhone: input.callerPhone,
      callerName: input.callerName ?? null,
      question: input.question,
      transcriptExcerpt: input.transcriptExcerpt ?? null,
      status: "pending",
    })
    .onConflictDoNothing()
    .returning();

  if (rows[0]) return rows[0];

  // Lost the race (or a duplicate within the same call). Fetch the row that won.
  // Only reachable when callId is set — the unique index is partial on
  // call_id IS NOT NULL, so a null callId can never conflict.
  const existing = await db
    .select()
    .from(escalations)
    .where(
      and(
        eq(escalations.callId, input.callId!),
        sql`lower(${escalations.question}) = lower(${input.question})`
      )
    )
    .limit(1);

  if (!existing[0]) {
    throw new Error(
      `[escalations] insert conflicted but no existing row found for call ${input.callId}`
    );
  }
  return existing[0];
}

export async function listEscalations(tenantId: string, status: "pending" | "resolved") {
  return db
    .select({
      id: escalations.id,
      callId: escalations.callId,
      callerPhone: escalations.callerPhone,
      // The name given at escalation wins; the stored client name is the
      // fallback for a caller we already knew.
      callerName: sql<string | null>`coalesce(${escalations.callerName}, ${clients.name})`,
      question: escalations.question,
      status: escalations.status,
      answer: escalations.answer,
      createdAt: escalations.createdAt,
    })
    .from(escalations)
    .leftJoin(clients, eq(escalations.clientId, clients.id))
    .where(and(eq(escalations.tenantId, tenantId), eq(escalations.status, status)))
    .orderBy(desc(escalations.createdAt))
    .limit(100);
}

export async function getEscalationById(
  id: string,
  tenantId: string
): Promise<EscalationRow | null> {
  // Full row, not a projection. A narrower select cast to `EscalationRow` leaves
  // the missing fields undefined at runtime while the type claims otherwise, and
  // there is no wide column here to save anything by omitting.
  const rows = await db
    .select()
    .from(escalations)
    .where(and(eq(escalations.id, id), eq(escalations.tenantId, tenantId)))
    .limit(1);

  return rows[0] ?? null;
}
