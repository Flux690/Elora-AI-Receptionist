import { describe, it, expect, afterEach } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * PLAN.md 1.6.1 — the migration chain must run against a genuinely empty database.
 *
 * No migration contains `CREATE EXTENSION vector`. The extension was enabled by
 * hand in the Neon console, so the repo alone cannot stand up a working database:
 * the first migration declaring a `vector` column dies with
 * `type "vector" does not exist`.
 *
 * This is the one test that cannot be written against Neon — the extension is
 * already there, so the chain passes for the wrong reason. It needs a throwaway
 * database, which is why docker-compose.yml exists.
 *
 * Each run migrates into its own freshly created database and drops it after, so
 * it never touches the shared test database the other integration tests use.
 */

const ADMIN_URL = process.env.DATABASE_URL!;
const MIGRATIONS_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle"
);

let scratchDb: string | null = null;

async function withAdmin<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: ADMIN_URL, max: 1 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

afterEach(async () => {
  if (!scratchDb) return;
  const name = scratchDb;
  scratchDb = null;
  await withAdmin(async (pool) => {
    await pool.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  });
});

describe("migration chain", () => {
  it("runs to completion against an empty database", async () => {
    const name = `migration_check_${Date.now()}`;
    await withAdmin((pool) => pool.query(`CREATE DATABASE "${name}"`));
    scratchDb = name;

    const url = new URL(ADMIN_URL);
    url.pathname = `/${name}`;
    const pool = new Pool({ connectionString: url.toString(), max: 1 });

    try {
      // The pgvector image ships the extension but does not create it, exactly
      // like a fresh Neon project. Prove that before migrating, so a failure
      // below is unambiguously the chain's fault.
      const pre = await pool.query(
        `SELECT 1 FROM pg_extension WHERE extname = 'vector'`
      );
      expect(pre.rowCount, "extension must not pre-exist").toBe(0);

      await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });

      // The chain is responsible for enabling the extension it depends on.
      const post = await pool.query(
        `SELECT 1 FROM pg_extension WHERE extname = 'vector'`
      );
      expect(post.rowCount, "chain must enable the vector extension").toBe(1);

      // And the vector column must actually exist afterwards.
      const col = await drizzle(pool).execute(sql`
        SELECT format_type(a.atttypid, a.atttypmod) AS type
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        WHERE c.relname = 'knowledge_items' AND a.attname = 'embedding'
      `);
      expect((col.rows[0] as { type: string } | undefined)?.type).toBe("vector(1536)");
    } finally {
      await pool.end();
    }
  }, 60_000);
});
