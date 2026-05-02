import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "./db/client.js";
import { escalations, knowledgeItems, knowledgeChunks } from "./db/schema.js";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

type EscalationRow = {
  id: string;
  tenantId: string;
  callerPhone: string;
  question: string;
  transcriptExcerpt: string | null;
  status: "Pending" | "Resolved";
  answer: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
};

function toLegacyRequestShape(row: EscalationRow) {
  return {
    id: row.id,
    question: row.question,
    callerId: row.callerPhone,
    customerPhone: row.callerPhone,
    status: row.status,
    answer: row.answer,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  };
}

async function getPendingRequests() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(escalations)
    .where(
      and(
        eq(escalations.tenantId, DEFAULT_TENANT_ID),
        eq(escalations.status, "Pending"),
        gte(escalations.createdAt, oneDayAgo)
      )
    )
    .orderBy(desc(escalations.createdAt));

  return rows.map((row) => toLegacyRequestShape(row as EscalationRow));
}

async function getResolvedRequests() {
  const rows = await db
    .select()
    .from(escalations)
    .where(
      and(
        eq(escalations.tenantId, DEFAULT_TENANT_ID),
        eq(escalations.status, "Resolved")
      )
    )
    .orderBy(desc(escalations.resolvedAt), desc(escalations.createdAt));

  return rows.map((row) => toLegacyRequestShape(row as EscalationRow));
}

async function getUnresolvedRequests() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(escalations)
    .where(
      and(
        eq(escalations.tenantId, DEFAULT_TENANT_ID),
        eq(escalations.status, "Pending"),
        lt(escalations.createdAt, oneDayAgo)
      )
    )
    .orderBy(desc(escalations.createdAt));

  return rows.map((row) => toLegacyRequestShape(row as EscalationRow));
}

async function getKnowledgeBase() {
  const rows = await db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.tenantId, DEFAULT_TENANT_ID))
    .orderBy(desc(knowledgeItems.createdAt));

  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    createdAt: row.createdAt,
  }));
}

async function resolveRequest(id: string, answer: string) {
  const now = new Date();
  const existing = await db
    .select()
    .from(escalations)
    .where(
      and(
        eq(escalations.id, id),
        eq(escalations.tenantId, DEFAULT_TENANT_ID)
      )
    )
    .limit(1);

  if (!existing[0]) {
    throw new Error("Request not found");
  }

  const escalation = existing[0];

  await db
    .update(escalations)
    .set({
      status: "Resolved",
      answer,
      resolvedAt: now,
    })
    .where(eq(escalations.id, id));

  const insertedKnowledge = await db
    .insert(knowledgeItems)
    .values({
      tenantId: DEFAULT_TENANT_ID,
      sourceEscalationId: escalation.id,
      question: escalation.question,
      answer,
    })
    .returning({ id: knowledgeItems.id, question: knowledgeItems.question });

  const knowledge = insertedKnowledge[0];
  const chunkText = `Question: ${knowledge.question}\nAnswer: ${answer}`;

  await db.insert(knowledgeChunks).values({
    tenantId: DEFAULT_TENANT_ID,
    knowledgeItemId: knowledge.id,
    chunkText,
    embedding: null,
  });

  // Placeholder transport during migration; SMS integration lands in a dedicated phase.
  console.log(`Request resolved for callerId: ${escalation.callerPhone}`);
  console.log(`Question: ${escalation.question}`);
  console.log(`Answer: ${answer}`);
  console.log(`Texting ${escalation.callerPhone}:\n"${escalation.question}\n${answer}"`);

  return { id, status: "Resolved" };
}

async function createPendingRequest(question: string, callerId: string) {
  const inserted = await db
    .insert(escalations)
    .values({
      tenantId: DEFAULT_TENANT_ID,
      callerPhone: callerId,
      question,
      status: "Pending",
    })
    .returning();

  const row = inserted[0] as EscalationRow;
  return toLegacyRequestShape(row);
}

export default {
  getPendingRequests,
  getResolvedRequests,
  getUnresolvedRequests,
  getKnowledgeBase,
  resolveRequest,
  createPendingRequest,
};
