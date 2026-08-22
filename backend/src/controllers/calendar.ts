import { getAuth } from "@clerk/hono";
import type { AppContext } from "../types.js";
import { getTenantById, updateTenant } from "../services/tenants.js";
import { listCalendars } from "../services/calendar.js";
import { getGoogleOAuthToken, forgetGoogleOAuthToken } from "../services/googleAuth.js";
import { calendarSelectSchema } from "../schemas.js";

/**
 * GET /admin/calendar/list
 *
 * The calendars the signed-in user's Google account can write to.
 *
 * Granting calendar scopes and choosing a calendar are two separate acts, and
 * only the first was ever built — which is why `tenants.google_calendar_id` was
 * never written by anything and the agent always reported "calendar not
 * connected". This endpoint is the missing half.
 */
export async function list(c: AppContext) {
  const auth = getAuth(c);
  const token = await getGoogleOAuthToken(auth!.userId!);

  // Not an error state: it just means they have not granted calendar access
  // yet. The dashboard shows the Connect button rather than a failure.
  if (!token) return c.json({ connected: false, calendars: [] });

  return c.json({ connected: true, calendars: await listCalendars(token) });
}

/**
 * PATCH /admin/calendar
 *
 * Records which calendar holds this tenant's appointments. The display name is
 * stored alongside the id so Settings can render "Bookings" rather than a raw
 * Google address, without a round trip on every page load.
 */
export async function select(c: AppContext) {
  const tenantId = c.get("tenantId");
  const parsed = calendarSelectSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { calendarId, summary, timeZone } = parsed.data;

  await updateTenant(tenantId, {
    calendarProvider: "google",
    calendarExternalId: calendarId,
    calendarPayload: { summary, ...(timeZone ? { timeZone } : {}) },
  });

  return c.json({ connected: true, calendarExternalId: calendarId });
}

/**
 * DELETE /admin/calendar
 *
 * Forgets the calendar. Deliberately does NOT cancel existing appointments —
 * they are real commitments to real callers and live in the calendar the user
 * still owns. The agent simply stops offering to book new ones.
 */
export async function disconnect(c: AppContext) {
  const auth = getAuth(c);
  const tenantId = c.get("tenantId");

  const tenant = await getTenantById(tenantId);
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  await updateTenant(tenantId, {
    calendarProvider: null,
    calendarExternalId: null,
    calendarPayload: null,
  });

  // The Google grant may be revoked from Google's side too; a cached token would
  // otherwise keep looking valid here for up to 50 minutes.
  forgetGoogleOAuthToken(auth!.userId!);

  return c.json({ connected: false });
}
