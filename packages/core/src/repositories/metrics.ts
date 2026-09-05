import { and, count, eq, gte } from "drizzle-orm";
import type { BusinessHours } from "@receptionist/shared";
import { db } from "../db/client.js";
import { calls, escalations, appointments, tenants } from "../db/schema.js";
import { isAfterHours } from "../domain/business-hours.js";

/**
 * Counted in memory because opening hours are jsonb read in the tenant's own
 * zone, and `isAfterHours` already carries that logic under test.
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

export async function countCalls(tenantId: string, since: Date): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(calls)
    .where(and(eq(calls.tenantId, tenantId), gte(calls.startedAt, since)));
  return Number(rows[0]!.count);
}

export async function countAbandonedCalls(tenantId: string, since: Date): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(calls)
    .where(
      and(
        eq(calls.tenantId, tenantId),
        eq(calls.outcome, "abandoned"),
        gte(calls.startedAt, since)
      )
    );
  return Number(rows[0]!.count);
}

export async function countConfirmedBookings(tenantId: string, since: Date): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.status, "confirmed"),
        gte(appointments.createdAt, since)
      )
    );
  return Number(rows[0]!.count);
}

/** Every pending escalation, ignoring the period: an unanswered question does not age out. */
export async function countPendingEscalations(tenantId: string): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(escalations)
    .where(and(eq(escalations.tenantId, tenantId), eq(escalations.status, "pending")));
  return Number(rows[0]!.count);
}

export async function getHoursAndZone(tenantId: string) {
  const rows = await db
    .select({ businessHours: tenants.businessHours, timezone: tenants.timezone })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return rows[0] ?? null;
}
