import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { knowledgeItems } from "../db/schema.js";
import { embedText } from "./embeddings.js";
import type { EscalationRow } from "./escalations.js";

export type KnowledgeItemRow = typeof knowledgeItems.$inferSelect;

export type KnowledgeResult = {
  question: string;
  answer: string;
  similarity: number;
};

export async function createKnowledgeFromEscalation(
  escalation: EscalationRow,
  answer: string
): Promise<void> {
  const chunkText = `Question: ${escalation.question}\nAnswer: ${answer}`;
  const embedding = await embedText(chunkText);

  if (!embedding) {
    throw new Error(
      `[knowledge] Failed to generate embedding for escalation ${escalation.id} — item not saved`
    );
  }

  await db.insert(knowledgeItems).values({
    tenantId: escalation.tenantId,
    sourceEscalationId: escalation.id,
    question: escalation.question,
    answer,
    embedding,
  });
}

export async function searchKnowledge(
  tenantId: string,
  query: string
): Promise<KnowledgeResult[]> {
  const queryEmbedding = await embedText(query);
  if (!queryEmbedding) {
    console.warn("[knowledge] Embedding unavailable — returning empty results");
    return [];
  }

  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const rows = await db.execute(sql`
    SELECT question, answer,
           1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM knowledge_items
    WHERE tenant_id = ${tenantId}
      AND embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorLiteral}::vector) > 0.5
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT 3
  `);

  return (rows.rows as Array<{ question: string; answer: string; similarity: number }>).map((r) => ({
    question: r.question,
    answer: r.answer,
    similarity: r.similarity,
  }));
}

export async function listKnowledge(tenantId: string) {
  return db
    .select({
      id: knowledgeItems.id,
      question: knowledgeItems.question,
      answer: knowledgeItems.answer,
      createdAt: knowledgeItems.createdAt,
    })
    .from(knowledgeItems)
    .where(eq(knowledgeItems.tenantId, tenantId))
    .orderBy(desc(knowledgeItems.createdAt))
    .limit(100);
}

export async function deleteKnowledge(id: string, tenantId: string): Promise<void> {
  await db
    .delete(knowledgeItems)
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.tenantId, tenantId)));
}
