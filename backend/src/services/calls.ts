import { desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { calls } from "../db/schema.js";

export type CallRow = typeof calls.$inferSelect;
export type CallOutcome = "answered" | "booked" | "escalated" | "abandoned" | "error";

type CreateCallInput = {
  tenantId: string;
  clientId?: string | null;
  callerPhone: string;
  livekitRoomName: string;
};

export async function createCall(input: CreateCallInput): Promise<CallRow> {
  const rows = await db
    .insert(calls)
    .values({
      tenantId: input.tenantId,
      clientId: input.clientId ?? null,
      callerPhone: input.callerPhone,
      livekitRoomName: input.livekitRoomName,
    })
    .returning();

  return rows[0];
}

export async function finishCall(
  callId: string,
  outcome: CallOutcome,
  transcript?: string,
  summary?: string
): Promise<void> {
  await db
    .update(calls)
    .set({ endedAt: new Date(), outcome, transcript, summary })
    .where(eq(calls.id, callId));
}

export async function listCalls(tenantId: string) {
  return db
    .select({
      id: calls.id,
      callerPhone: calls.callerPhone,
      startedAt: calls.startedAt,
      endedAt: calls.endedAt,
      outcome: calls.outcome,
    })
    .from(calls)
    .where(eq(calls.tenantId, tenantId))
    .orderBy(desc(calls.startedAt))
    .limit(100);
}
