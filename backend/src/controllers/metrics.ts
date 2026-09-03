import type { AppContext } from "../types.js";
import type { BusinessHours } from "@receptionist/shared";
import { db } from "../db/client.js";
import { calls, escalations, appointments, tenants } from "../db/schema.js";
import { and, count, eq, gte } from "drizzle-orm";
import {
  intervalsForDate,
  localDateIso,
  zonedWallClockToUtc,
} from "../agent/scheduling.js";

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

/**
 * Whether a call arrived while the business was shut.
 *
 * Counted here rather than in SQL because opening hours are jsonb — a weekly
 * pattern plus date exceptions that replace it outright — and the comparison has
 * to happen in the tenant's own zone. `intervalsForDate` already knows all of
 * that and is covered by the scheduling tests; a second implementation in SQL
 * would be a second thing to keep right.
 *
 * A day with no intervals is shut all day, which is how weekends and holidays
 * fall out without a special case.
 */
function isAfterHours(started: Date, hours: BusinessHours, timeZone: string): boolean {
  const dateIso = localDateIso(started, timeZone);
  const intervals = intervalsForDate(hours, dateIso);
  if (intervals.length === 0) return true;

  return !intervals.some((i) => {
    const opens = zonedWallClockToUtc(dateIso, i.start, timeZone);
    const closes = zonedWallClockToUtc(dateIso, i.end, timeZone);
    return started >= opens && started < closes;
  });
}

/**
 * How many of a tenant's calls in the window arrived out of hours.
 *
 * Selects one narrow column and counts in memory. The alternative is unpacking
 * the hours jsonb in SQL, which is the same logic written twice in two languages
 * and only one of them tested.
 */
export async function countAfterHoursCalls(
  tenantId: string,
  since: Date,
  hours: BusinessHours,
  timeZone: string
): Promise<number> {
  const rows = await db
    .select({ startedAt: calls.startedAt })
    .from(calls)
    .where(and(eq(calls.tenantId, tenantId), gte(calls.startedAt, since)));

  return rows.reduce((n, r) => n + (isAfterHours(r.startedAt, hours, timeZone) ? 1 : 0), 0);
}

export async function getMetrics(c: AppContext) {
  const tenantId = c.get("tenantId");
  const since = periodStart(c.req.query("period") ?? "30d");

  const [
    [{ count: total }],
    [{ count: booked }],
    [{ count: pending }],
    [{ count: abandoned }],
    [tenant],
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
    db
      .select({ businessHours: tenants.businessHours, timezone: tenants.timezone })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1),
  ]);

  const afterHours = tenant
    ? await countAfterHoursCalls(tenantId, since, tenant.businessHours, tenant.timezone)
    : 0;

  return c.json({
    totalCalls: Number(total),
    afterHoursCalls: afterHours,
    confirmedBookings: Number(booked),
    pendingEscalations: Number(pending),
    abandonedCalls: Number(abandoned),
  });
}
