import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { knowledgeItems, knowledgeChunks } from "../db/schema.js";
import { embedText } from "./embeddings.js";
import type { EscalationRow } from "./escalations.js";

export type KnowledgeItemRow = typeof knowledgeItems.$inferSelect;

export type KnowledgeResult = {
  chunkText: string;
  similarity: number;
};

export async function createKnowledgeFromEscalation(
  escalation: EscalationRow,
  answer: string
): Promise<void> {
  const inserted = await db
    .insert(knowledgeItems)
    .values({
      tenantId: escalation.tenantId,
      sourceEscalationId: escalation.id,
      question: escalation.question,
      answer,
    })
    .returning({ id: knowledgeItems.id });

  const itemId = inserted[0].id;
  const chunkText = `Question: ${escalation.question}\nAnswer: ${answer}`;
  const embedding = await embedText(chunkText);

  await db.insert(knowledgeChunks).values({
    tenantId: escalation.tenantId,
    knowledgeItemId: itemId,
    chunkText,
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

  // Cosine similarity search filtered by tenant. Returns top 3 matches above 0.5 threshold.
  const rows = await db.execute(sql`
    SELECT chunk_text,
           1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM knowledge_chunks
    WHERE tenant_id = ${tenantId}
      AND embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorLiteral}::vector) > 0.5
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT 3
  `);

  return (rows.rows as Array<{ chunk_text: string; similarity: number }>).map((r) => ({
    chunkText: r.chunk_text,
    similarity: r.similarity,
  }));
}

export async function listKnowledge(tenantId: string): Promise<KnowledgeItemRow[]> {
  return db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.tenantId, tenantId))
    .orderBy(desc(knowledgeItems.createdAt));
}

export async function deleteKnowledge(id: string, tenantId: string): Promise<void> {
  await db
    .delete(knowledgeItems)
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.tenantId, tenantId)));
}
