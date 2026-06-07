import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { knowledgeItems } from "../db/schema.js";
import OpenAI from "openai";
import { env } from "../env.js";
import type { EscalationRow } from "./escalations.js";

const openai = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: env.OPENROUTER_BASE_URL,
});

async function embedText(text: string): Promise<number[] | null> {
  try {
    const response = await openai.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: text,
      encoding_format: "float",
    });
    const embedding = response.data?.[0]?.embedding;
    if (!embedding?.length) {
      console.warn("[embeddings] empty embedding returned. model:", env.EMBEDDING_MODEL);
      console.warn("[embeddings] full response:", JSON.stringify(response, null, 2));
      return null;
    }
    if (embedding.length !== env.EMBEDDING_DIMENSIONS) {
      console.error(
        `[embeddings] dimension mismatch: model returned ${embedding.length} but EMBEDDING_DIMENSIONS=${env.EMBEDDING_DIMENSIONS}. ` +
        `Update EMBEDDING_DIMENSIONS to match the model or change EMBEDDING_MODEL.`
      );
      return null;
    }
    return embedding;
  } catch (err) {
    console.error("[embeddings] API call failed:", err);
    return null;
  }
}

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
      AND 1 - (embedding <=> ${vectorLiteral}::vector) > 0.65
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
