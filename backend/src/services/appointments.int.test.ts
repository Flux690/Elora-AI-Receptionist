import { describe, it, expect } from "vitest";
import { getUpcomingByPhone } from "./appointments.js";
import { upsertClient } from "./clients.js";
import { db } from "../db/client.js";
import { clients } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { makeTenant, makeAppointment } from "../test/factories.js";

/**
 * PLAN.md 1.8.1 — the caller-ID leak.
 *
 * The proof that the *identity* is wrong lives in `agent/caller.test.ts`, which
 * is where the "unknown" fallback was. These tests cover the other half: the
 * mechanism that made that fallback dangerous, and the service contracts that
 * have to hold once the identity can be null.
 */
describe("getUpcomingByPhone", () => {
  /**
   * A characterisation test: it documents *why* the identity must be null rather
   * than a placeholder. Any non-null placeholder is a real, shared lookup key,
   * and this shows exactly what that means — a booking made by one anonymous
   * caller is returned to the next one.
   *
   * This stays green after the fix, because the fix is upstream: nothing ever
   * writes a placeholder identity again. It exists so that anyone tempted to
   * reintroduce one can see the consequence in a single assertion.
   */
  it("returns any booking stored under a shared placeholder identity", async () => {
    const tenant = await makeTenant();
    await makeAppointment(tenant.id, { callerPhone: "unknown", service: "Colour" });

    const whatTheNextAnonymousCallerWouldHear = await getUpcomingByPhone(
      tenant.id,
      "unknown"
    );

    expect(whatTheNextAnonymousCallerWouldHear).toHaveLength(1);
    expect(whatTheNextAnonymousCallerWouldHear[0]!.service).toBe("Colour");
  });

  it("returns appointments for a caller who did share their number", async () => {
    const tenant = await makeTenant();
    const phone = "+14155550123";
    await makeAppointment(tenant.id, { callerPhone: phone, service: "Haircut" });

    const found = await getUpcomingByPhone(tenant.id, phone);

    expect(found).toHaveLength(1);
    expect(found[0]!.service).toBe("Haircut");
  });

  it("scopes lookups to the tenant", async () => {
    const [a, b] = await Promise.all([makeTenant(), makeTenant()]);
    const phone = "+14155550123";
    await makeAppointment(a.id, { callerPhone: phone });

    expect(await getUpcomingByPhone(b.id, phone)).toEqual([]);
  });
});

describe("upsertClient", () => {
  it("creates no client row when caller ID is withheld", async () => {
    const tenant = await makeTenant();

    const result = await upsertClient(tenant.id, null);

    expect(result).toBeNull();
    const rows = await db.select().from(clients).where(eq(clients.tenantId, tenant.id));
    expect(rows).toEqual([]);
  });

  it("upserts on repeat calls from the same number rather than duplicating", async () => {
    const tenant = await makeTenant();
    const phone = "+14155550123";

    const first = await upsertClient(tenant.id, phone);
    const second = await upsertClient(tenant.id, phone);

    expect(first).not.toBeNull();
    expect(second!.id).toBe(first!.id);

    const rows = await db.select().from(clients).where(eq(clients.tenantId, tenant.id));
    expect(rows).toHaveLength(1);
  });
});
