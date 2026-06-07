import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { calls } from "../db/schema.js";
import type { TranscriptEntry, CallOutcome } from "../db/schema.js";

export type CallRow = typeof calls.$inferSelect;

type CreateCallInput = {
  id?: string;          // caller-generated UUID — omit to let Postgres generate one
  tenantId: string;
  clientId?: string | null;
  callerPhone: string;
  livekitRoomName: string;
};

export async function createCall(input: CreateCallInput): Promise<CallRow> {
  const rows = await db
    .insert(calls)
    .values({
      ...(input.id ? { id: input.id } : {}),
      tenantId: input.tenantId,
      clientId: input.clientId ?? null,
      callerPhone: input.callerPhone,
      livekitRoomName: input.livekitRoomName,
    })
    .returning();

  return rows[0];
}

type FinishCallData = {
  outcome: CallOutcome;
  transcript: TranscriptEntry[];
  summary: string | null;
  recordingUrl: string | null;
};

export async function finishCall(
  callId: string,
  data: FinishCallData
): Promise<void> {
  await db
    .update(calls)
    .set({
      endedAt: new Date(),
      outcome: data.outcome,
      transcript: data.transcript,
      summary: data.summary,
      recordingUrl: data.recordingUrl,
    })
    .where(eq(calls.id, callId));
}

export async function listCalls(
  tenantId: string,
  limit = 50,
  offset = 0
) {
  return db
    .select({
      id: calls.id,
      clientId: calls.clientId,
      callerPhone: calls.callerPhone,
      startedAt: calls.startedAt,
      endedAt: calls.endedAt,
      outcome: calls.outcome,
      summary: calls.summary,
    })
    .from(calls)
    .where(eq(calls.tenantId, tenantId))
    .orderBy(desc(calls.startedAt))
    .limit(limit)
    .offset(offset);
}

export async function getCallById(callId: string, tenantId: string) {
  const rows = await db
    .select({
      id: calls.id,
      clientId: calls.clientId,
      callerPhone: calls.callerPhone,
      livekitRoomName: calls.livekitRoomName,
      startedAt: calls.startedAt,
      endedAt: calls.endedAt,
      outcome: calls.outcome,
      transcript: calls.transcript,
      summary: calls.summary,
      recordingUrl: calls.recordingUrl,
    })
    .from(calls)
    .where(and(eq(calls.id, callId), eq(calls.tenantId, tenantId)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Returns the IDs of all calls for a tenant that have a recording stored in R2.
 * Must be called BEFORE deleteTenant() so the cascade doesn't wipe the rows first.
 */
export async function getCallIdsWithRecordings(tenantId: string): Promise<string[]> {
  const rows = await db
    .select({ id: calls.id })
    .from(calls)
    .where(and(eq(calls.tenantId, tenantId), isNotNull(calls.recordingUrl)));

  return rows.map((r) => r.id);
}
