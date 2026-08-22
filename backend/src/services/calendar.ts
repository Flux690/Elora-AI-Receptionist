import type { CalendarOption } from "@receptionist/shared";

const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export type BusyRange = { start: Date; end: Date };

/**
 * The calendars the connected Google account can write to.
 *
 * Exists because nothing ever wrote `tenants.google_calendar_id`: the dashboard
 * granted calendar scopes and then stopped, so the agent always saw "calendar
 * not connected" and the entire booking path was unreachable. Granting access
 * and choosing a calendar are two different acts, and only the first was built.
 *
 * Filtered to calendars the account can actually create events on — a read-only
 * subscription like "Holidays in the United States" is offerable but would fail
 * at the first booking, which is the worst moment to find out.
 */
export async function listCalendars(accessToken: string): Promise<CalendarOption[]> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/users/me/calendarList?minAccessRole=writer`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[calendar] calendarList failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      timeZone?: string;
      primary?: boolean;
    }>;
  };

  return (data.items ?? []).map((item) => ({
    id: item.id,
    summary: item.summary ?? item.id,
    timeZone: item.timeZone,
    primary: item.primary === true,
  }));
}

/**
 * What is already taken on the calendar, in a window.
 *
 * Deliberately only a fetch. This used to *generate* slots as well — fixed
 * 60-minute steps from an arbitrary start, returning whatever freeBusy did not
 * mark busy — which is how a caller could be offered 3 a.m. for a two-hour
 * appointment. Deciding which times exist belongs in `agent/scheduling.ts`,
 * which has the opening hours and the service duration to do it properly.
 * All Google can tell us is what is unavailable.
 */
export async function fetchBusyRanges(
  accessToken: string,
  calendarId: string,
  timeMinIso: string,
  timeMaxIso: string
): Promise<BusyRange[]> {
  const res = await fetch(`${GOOGLE_CALENDAR_BASE}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: timeMinIso,
      timeMax: timeMaxIso,
      items: [{ id: calendarId }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[calendar] freeBusy failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    calendars: Record<string, { busy: { start: string; end: string }[] }>;
  };

  return (data.calendars[calendarId]?.busy ?? []).map((b) => ({
    start: new Date(b.start),
    end: new Date(b.end),
  }));
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    /**
     * The whole block, padding included.
     *
     * The event has to cover setup and cleanup, not just the appointment —
     * otherwise freeBusy reports that time free and the next booking lands on
     * top of the cleanup for this one.
     */
    startIso: string;
    endIso: string;
    timezone: string;
    description?: string;
  }
): Promise<string> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description ?? "Booked via AI Receptionist",
        start: { dateTime: event.startIso, timeZone: event.timezone },
        end: { dateTime: event.endIso, timeZone: event.timezone },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[calendar] createEvent failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok && res.status !== 410) {
    const body = await res.text();
    throw new Error(`[calendar] deleteEvent failed: ${res.status} ${body}`);
  }
}
