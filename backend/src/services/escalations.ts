import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { escalations } from "../db/schema.js";

export type EscalationRow = typeof escalations.$inferSelect;

type CreateEscalationInput = {
  tenantId: string;
  callId?: string | null;
  clientId?: string | null;
  callerPhone: string;
  question: string;
  transcriptExcerpt?: string | null;
};

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
      question: input.question,
      transcriptExcerpt: input.transcriptExcerpt ?? null,
      status: "pending",
    })
    .returning();

  return rows[0];
}

export async function resolveEscalation(
  id: string,
  tenantId: string,
  answer: string
): Promise<EscalationRow> {
  const rows = await db
    .update(escalations)
    .set({ status: "resolved", answer, resolvedAt: new Date() })
    .where(and(eq(escalations.id, id), eq(escalations.tenantId, tenantId)))
    .returning();

  if (!rows[0]) throw new Error(`Escalation ${id} not found`);
  return rows[0];
}

export async function listEscalations(tenantId: string, status: "pending" | "resolved") {
  return db
    .select({
      id: escalations.id,
      callerPhone: escalations.callerPhone,
      question: escalations.question,
      status: escalations.status,
      answer: escalations.answer,
      createdAt: escalations.createdAt,
    })
    .from(escalations)
    .where(and(eq(escalations.tenantId, tenantId), eq(escalations.status, status)))
    .orderBy(desc(escalations.createdAt))
    .limit(100);
}

export async function getEscalationById(
  id: string,
  tenantId: string
): Promise<EscalationRow | null> {
  const rows = await db
    .select()
    .from(escalations)
    .where(and(eq(escalations.id, id), eq(escalations.tenantId, tenantId)))
    .limit(1);

  return rows[0] ?? null;
}
