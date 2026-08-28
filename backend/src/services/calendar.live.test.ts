import { afterAll, describe, expect, it } from "vitest";
import { and, eq, isNotNull } from "drizzle-orm";
import type { BookingPolicy, BusinessHours } from "@receptionist/shared";
import { closeDb, db } from "../db/client.js";
import { tenants } from "../db/schema.js";
import { getGoogleOAuthToken } from "./googleAuth.js";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchBusyRanges,
  listCalendars,
} from "./calendar.js";
import {
  addDays,
  describeSlot,
  filterByBusy,
  generateCandidateSlots,
  localDateIso,
  type Slot,
} from "../agent/scheduling.js";

/**
 * PLAN.md's first gate: *"Exercise the booking path against a real Google
 * Calendar… Nothing else should be built on top of booking until this has
 * happened once."*
 *
 * Everything in 2.5 and the slot interface is unit-tested only. `fetchBusyRanges`,
 * padded-block events and the calendar picker had never touched Google, so the
 * one property the whole design rests on was unverified:
 *
 *   **A calendar event must span the padded BLOCK, not the appointment.**
 *
 * If it spans only `start`→`end`, freeBusy reports the setup and cleanup free and
 * the next booking lands on top of the previous job's cleanup. That failure is
 * invisible in unit tests — they assert what our own code computes — and shows up
 * as two customers arriving at once.
 *
 * This runs against the real database and the real Google account, through the
 * exact chain a live call uses: tenant row → `clerkUserId` → Clerk-issued Google
 * token → Google. Nothing is written to the database. The one external side
 * effect is a calendar event created and deleted inside test 2, with a second
 * cleanup pass in `afterAll` so a mid-test failure cannot strand it.
 */

/** Buffers on BOTH sides, so padding is exercised whatever the tenant configured. */
const PROBE_SERVICE = {
  durationMinutes: 30,
  bufferBeforeMinutes: 10,
  bufferAfterMinutes: 15,
} as const;

/** Start far enough out that a real booking today is not disturbed. */
const SEARCH_FROM_DAYS = 2;
const SEARCH_DAYS = 7;

/** Widen the freeBusy window past the block, or Google clips the busy range to
 *  the query window and the coverage assertion becomes trivially true. */
const WINDOW_PAD_MS = 60 * 60 * 1000;

const EVENT_SUMMARY = "DeskRoute automated test — safe to delete";

type LiveContext = {
  tenantId: string;
  tenantName: string;
  calendarId: string;
  token: string;
  timeZone: string;
  hours: BusinessHours;
  policy: BookingPolicy;
};

/**
 * Resolved at module load rather than in `beforeAll`, because `describe.skipIf`
 * is evaluated at collection time and cannot see a hook's result.
 */
async function resolveContext(): Promise<{ ctx: LiveContext | null; reason?: string }> {
  const override = process.env.LIVE_TENANT_ID;

  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      timezone: tenants.timezone,
      businessHours: tenants.businessHours,
      bookingPolicy: tenants.bookingPolicy,
      clerkUserId: tenants.clerkUserId,
      calendarExternalId: tenants.calendarExternalId,
    })
    .from(tenants)
    .where(
      override
        ? eq(tenants.id, override)
        : and(isNotNull(tenants.calendarExternalId), isNotNull(tenants.clerkUserId))
    )
    .limit(1);

  const tenant = rows[0];
  if (!tenant) {
    return {
      ctx: null,
      reason: override
        ? `no tenant with id ${override}`
        : "no tenant has a connected calendar — connect one in Settings → Business first",
    };
  }
  if (!tenant.calendarExternalId || !tenant.clerkUserId) {
    return { ctx: null, reason: `tenant ${tenant.id} has no connected calendar` };
  }

  const token = await getGoogleOAuthToken(tenant.clerkUserId);
  if (!token) {
    return {
      ctx: null,
      reason: `no Google token for tenant ${tenant.id} — reconnect the calendar`,
    };
  }

  return {
    ctx: {
      tenantId: tenant.id,
      tenantName: tenant.name,
      calendarId: tenant.calendarExternalId,
      token,
      timeZone: tenant.timezone,
      hours: tenant.businessHours,
      policy: tenant.bookingPolicy,
    },
  };
}

const { ctx, reason } = await resolveContext();

if (!ctx) {
  console.warn(`\n[live] SKIPPING calendar tests: ${reason}\n`);
}

/** Tracked outside the test so `afterAll` can clean up after a mid-test failure. */
let strandedEventId: string | null = null;

afterAll(async () => {
  if (ctx && strandedEventId) {
    await deleteCalendarEvent(ctx.token, ctx.calendarId, strandedEventId).catch(
      (err: unknown) =>
        console.error(
          `[live] could not clean up event ${strandedEventId} — delete it by hand:`,
          err
        )
    );
  }
  // The pool holds live sockets on purpose (keepAlive, 30s idle), and those are
  // libuv handles, so vitest never exits without this.
  await closeDb();
});

describe.skipIf(ctx === null)("Google Calendar, for real", () => {
  const live = ctx as LiveContext;

  it("still lists the calendar the tenant chose, as writable", async () => {
    // `listCalendars` filters to minAccessRole=writer, so this also catches a
    // calendar that was deleted or un-shared after being chosen — which would
    // otherwise surface at the first booking, the worst possible moment.
    const calendars = await listCalendars(live.token);

    expect(calendars.map((c) => c.id)).toContain(live.calendarId);
  });

  it("reserves the padded block, so buffers are not offered to the next caller", async () => {
    const now = new Date();
    const fromDate = addDays(localDateIso(now, live.timeZone), SEARCH_FROM_DAYS);

    const candidates = generateCandidateSlots({
      hours: live.hours,
      policy: live.policy,
      service: PROBE_SERVICE,
      timeZone: live.timeZone,
      now,
      fromDate,
      days: SEARCH_DAYS,
    });

    expect(
      candidates.length,
      `no candidate slots in ${SEARCH_DAYS} days from ${fromDate} — check the ` +
        `tenant's opening hours, every weekday may be closed`
    ).toBeGreaterThan(0);

    const searchBusy = await fetchBusyRanges(
      live.token,
      live.calendarId,
      candidates[0]!.blockStart.toISOString(),
      candidates.at(-1)!.blockEnd.toISOString()
    );

    const free = filterByBusy(candidates, searchBusy);
    expect(free.length, "every candidate slot is already busy").toBeGreaterThan(0);

    const slot: Slot = free[0]!;

    // Widened, so the returned range reflects the event's real extent rather
    // than being clipped to the query window.
    const windowMin = new Date(slot.blockStart.getTime() - WINDOW_PAD_MS).toISOString();
    const windowMax = new Date(slot.blockEnd.getTime() + WINDOW_PAD_MS).toISOString();

    const eventId = await createCalendarEvent(live.token, live.calendarId, {
      summary: EVENT_SUMMARY,
      startIso: slot.blockStart.toISOString(),
      endIso: slot.blockEnd.toISOString(),
      timezone: live.timeZone,
      description: "Written by calendar.live.test.ts. Deleted automatically.",
    });
    strandedEventId = eventId;

    try {
      const busyAfter = await fetchBusyRanges(
        live.token,
        live.calendarId,
        windowMin,
        windowMax
      );

      // THE CONTRACT. If the event had been written over start→end instead of
      // blockStart→blockEnd, the busy range would begin 10 minutes late and end
      // 15 minutes early, and this fails.
      const covers = busyAfter.some(
        (b) =>
          b.start.getTime() <= slot.blockStart.getTime() &&
          b.end.getTime() >= slot.blockEnd.getTime()
      );
      expect(
        covers,
        `no busy range covers the padded block ` +
          `${slot.blockStart.toISOString()}–${slot.blockEnd.toISOString()}; ` +
          `Google returned ${JSON.stringify(
            busyAfter.map((b) => [b.start.toISOString(), b.end.toISOString()])
          )}`
      ).toBe(true);

      // And the slot the agent would have offered is now correctly withheld.
      expect(filterByBusy([slot], busyAfter)).toHaveLength(0);
    } finally {
      await deleteCalendarEvent(live.token, live.calendarId, eventId);
      strandedEventId = null;
    }

    // Deleting frees it again — proves cancellation actually releases the time.
    const busyFinal = await fetchBusyRanges(
      live.token,
      live.calendarId,
      slot.blockStart.toISOString(),
      slot.blockEnd.toISOString()
    );
    expect(filterByBusy([slot], busyFinal)).toHaveLength(1);

    console.log(
      `[live] verified padded block for "${live.tenantName}" at ` +
        `${describeSlot(slot, live.timeZone)} (${live.timeZone})`
    );
  });
});
