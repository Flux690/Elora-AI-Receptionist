import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * PLAN.md 1.6.2 — the vector column width must not depend on the environment.
 *
 * `schema.ts` currently builds the column type from `env.EMBEDDING_DIMENSIONS`,
 * so the same schema file emits different DDL depending on which environment
 * runs the migration. That already caused real data loss: migration 0003 created
 * `vector(2048)`, migration 0008 dropped the column and recreated it as
 * `vector(1536)`, silently destroying every stored embedding. Because
 * `searchKnowledge` filters on `embedding IS NOT NULL`, the knowledge base would
 * have gone quiet with no error surfaced anywhere.
 *
 * The dimension belongs in the schema. The env var stays only as the runtime
 * assertion in services/knowledge.ts, which checks the model's actual output.
 */
describe("knowledge_items.embedding", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is vector(1536) regardless of EMBEDDING_DIMENSIONS", async () => {
    // Modules must be reset first: env.ts snapshots process.env at import time.
    vi.resetModules();
    vi.stubEnv("EMBEDDING_DIMENSIONS", "999");

    const { knowledgeItems } = await import("./schema.js");
    const { getTableConfig } = await import("drizzle-orm/pg-core");

    const embedding = getTableConfig(knowledgeItems).columns.find(
      (c) => c.name === "embedding"
    );

    expect(embedding).toBeDefined();
    expect(embedding!.getSQLType()).toBe("vector(1536)");
  });
});
