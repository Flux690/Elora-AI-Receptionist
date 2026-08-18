import { sql } from "drizzle-orm";
import { beforeAll, beforeEach } from "vitest";
import { db } from "../db/client.js";

/**
 * Integration-test lifecycle against the throwaway Postgres in docker-compose.yml.
 *
 * Migrations are NOT run here. `src/db/migrations.int.test.ts` owns that, because
 * it needs to assert the chain runs cleanly against a genuinely empty database —
 * which is the whole point of that test (PLAN.md 1.6.1). Running migrations here
 * would poison it. That test migrates into its own scratch database and leaves
 * this one alone; everything else relies on `pnpm test:int` having applied the
 * schema first via the `pretest:int` script.
 */

const TABLES = [
  "appointments",
  "knowledge_items",
  "escalations",
  "calls",
  "clients",
  "tenants",
] as const;

beforeAll(async () => {
  try {
    await db.execute(sql`SELECT 1`);
  } catch (err) {
    throw new Error(
      "Cannot reach the test database. Start it with `docker compose up -d` " +
        "from the repo root, then re-run.\n" +
        `Underlying error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
});

// One TRUNCATE ... CASCADE per test. Faster than per-table DELETE and it resets
// nothing else, so tests stay order-independent.
beforeEach(async () => {
  await db.execute(sql.raw(`TRUNCATE TABLE ${TABLES.join(", ")} CASCADE`));
});
