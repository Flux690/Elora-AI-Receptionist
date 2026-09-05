import { Hono } from "hono";
import type { AppEnv } from "../../types.js";
import { periodStart } from "@receptionist/core/domain/business-hours.js";
import {
  countAfterHoursCalls,
  countCalls,
  countAbandonedCalls,
  countConfirmedBookings,
  countPendingEscalations,
  getHoursAndZone,
} from "@receptionist/core/repositories/metrics.js";

export const metrics = new Hono<AppEnv>().get("/", async (c) => {
  const tenantId = c.get("tenantId");
  const since = periodStart(c.req.query("period") ?? "30d");

  const [totalCalls, confirmedBookings, pendingEscalations, abandonedCalls, tenant] =
    await Promise.all([
      countCalls(tenantId, since),
      countConfirmedBookings(tenantId, since),
      countPendingEscalations(tenantId),
      countAbandonedCalls(tenantId, since),
      getHoursAndZone(tenantId),
    ]);

  const afterHoursCalls = tenant
    ? await countAfterHoursCalls(tenantId, since, tenant.businessHours, tenant.timezone)
    : 0;

  return c.json({
    totalCalls,
    afterHoursCalls,
    confirmedBookings,
    pendingEscalations,
    abandonedCalls,
  });
});
