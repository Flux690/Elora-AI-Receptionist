import type { AppContext } from "../types.js";
import { db } from "../db/client.js";
import { calls, escalations as escalationsTable } from "../db/schema.js";
import { and, count, eq } from "drizzle-orm";

export async function getMetrics(c: AppContext) {
  const tenantId = c.get("tenantId");

  const [[totalCalls], [pendingEscalations]] = await Promise.all([
    db.select({ count: count() }).from(calls).where(eq(calls.tenantId, tenantId)),
    db
      .select({ count: count() })
      .from(escalationsTable)
      .where(
        and(
          eq(escalationsTable.tenantId, tenantId),
          eq(escalationsTable.status, "pending")
        )
      ),
  ]);

  return c.json({
    totalCalls: Number(totalCalls.count),
    pendingEscalations: Number(pendingEscalations.count),
  });
}
