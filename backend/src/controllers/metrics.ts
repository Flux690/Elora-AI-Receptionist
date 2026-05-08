import type { AppContext } from "../types.js";
import { db } from "../db/client.js";
import { calls, escalations, appointments } from "../db/schema.js";
import { and, count, eq, gte } from "drizzle-orm";

function periodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case "today": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

export async function getMetrics(c: AppContext) {
  const tenantId = c.get("tenantId");
  const since = periodStart(c.req.query("period") ?? "30d");

  const [
    [{ count: total }],
    [{ count: booked }],
    [{ count: pending }],
    [{ count: abandoned }],
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(calls)
      .where(and(eq(calls.tenantId, tenantId), gte(calls.startedAt, since))),
    db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          eq(appointments.status, "confirmed"),
          gte(appointments.createdAt, since)
        )
      ),
    // Pending escalations always show all — no date filter
    db
      .select({ count: count() })
      .from(escalations)
      .where(
        and(eq(escalations.tenantId, tenantId), eq(escalations.status, "pending"))
      ),
    db
      .select({ count: count() })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          eq(calls.outcome, "abandoned"),
          gte(calls.startedAt, since)
        )
      ),
  ]);

  return c.json({
    totalCalls: Number(total),
    confirmedBookings: Number(booked),
    pendingEscalations: Number(pending),
    abandonedCalls: Number(abandoned),
  });
}
