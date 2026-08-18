import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { knowledgeItems, escalations } from "../db/schema.js";
import { env } from "../env.js";
import { openrouter } from "../llm.js";
import type { EscalationRow } from "./escalations.js";

async function embedText(text: string): Promise<number[] | null> {
  try {
    const response = await openrouter.embeddings.create({
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
  // Embed the question alone. Queries are questions, so storing a
  // question+answer blob put stored and query vectors in different regions of
  // the space and systematically depressed recall. The answer rides along as a
  // payload column, not as part of the embedded text.
  const embedding = await embedText(escalation.question);

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

/**
 * Resolves an escalation and files its answer as knowledge, atomically.
 *
 * These were two sequential awaits in the controller (PLAN.md 1.8.5). If the
 * status update failed after the knowledge insert succeeded, the tenant was left
 * with an orphan knowledge row and an escalation still showing as pending — the
 * same answer would then be filed again on the next attempt.
 *
 * The embedding call deliberately happens BEFORE the transaction opens: it is a
 * network round trip, and holding a Postgres transaction open across it would
 * pin a connection for the duration.
 */
export async function resolveEscalationWithKnowledge(
  escalation: EscalationRow,
  tenantId: string,
  answer: string
): Promise<void> {
  const embedding = await embedText(escalation.question);
  if (!embedding) {
    throw new Error(
      `[knowledge] Failed to generate embedding for escalation ${escalation.id} — nothing saved`
    );
  }

  await db.transaction(async (tx) => {
    await tx.insert(knowledgeItems).values({
      tenantId: escalation.tenantId,
      sourceEscalationId: escalation.id,
      question: escalation.question,
      answer,
      embedding,
    });

    const updated = await tx
      .update(escalations)
      .set({ status: "resolved", answer, resolvedAt: new Date() })
      .where(and(eq(escalations.id, escalation.id), eq(escalations.tenantId, tenantId)))
      .returning({ id: escalations.id });

    if (!updated[0]) {
      // Rolls back the knowledge insert above.
      throw new Error(`Escalation ${escalation.id} not found`);
    }
  });
}

/**
 * Vector similarity search over the knowledge base.
 *
 * CURRENTLY UNUSED. The searchKnowledge *tool* was deleted in favour of inlining
 * the whole knowledge base into the system prompt (PLAN.md 1.5), which removed
 * two LLM round trips and an embedding call from every knowledge question.
 *
 * Kept because embeddings are still written on every escalation resolve and the
 * HNSW index is still maintained, so the data path is live even though this read
 * is not. This is the Tier 2 path: above ~300 knowledge items the prompt stops
 * being the right home, and the lookup moves into an on-user-turn hook — not
 * back into a tool.
 */
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

/**
 * The tenant's whole knowledge base, shaped for inlining into the system prompt.
 *
 * Deliberately projects only question/answer — the embedding column is ~16KB per
 * row and nothing here needs it. Ordered oldest-first so the prompt prefix stays
 * stable as new items are added, which is what makes it cacheable.
 *
 * Capped: above roughly 300 items the prompt stops being the right home for this
 * and the lookup should move into an on-turn hook instead (PLAN.md 1.5, Tier 2).
 */
export const KNOWLEDGE_PROMPT_LIMIT = 300;

export async function listKnowledgeForPrompt(
  tenantId: string
): Promise<Array<{ question: string; answer: string }>> {
  return db
    .select({ question: knowledgeItems.question, answer: knowledgeItems.answer })
    .from(knowledgeItems)
    .where(eq(knowledgeItems.tenantId, tenantId))
    .orderBy(knowledgeItems.createdAt)
    .limit(KNOWLEDGE_PROMPT_LIMIT);
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

/**
 * Deletes a knowledge item and reopens the escalation it came from.
 *
 * Without the reopen, deleting an item left its escalation `resolved` forever:
 * the agent could no longer answer that question, and the (call_id, question)
 * dedup index could stop it being re-escalated. The question became permanently
 * unanswerable, with nothing surfaced anywhere (PLAN.md 1.8.5).
 *
 * Both statements run in one transaction — a delete that does not reopen is
 * exactly the broken state this exists to prevent.
 */
export async function deleteKnowledge(id: string, tenantId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(knowledgeItems)
      .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.tenantId, tenantId)))
      .returning({ sourceEscalationId: knowledgeItems.sourceEscalationId });

    const sourceEscalationId = deleted[0]?.sourceEscalationId;
    if (!sourceEscalationId) return;

    await tx
      .update(escalations)
      .set({ status: "pending", answer: null, resolvedAt: null })
      .where(
        and(eq(escalations.id, sourceEscalationId), eq(escalations.tenantId, tenantId))
      );
  });
}
